# app/routers/rankings_router.py
# -------------------------------------------------------------------
# Router de rankings
# -------------------------------------------------------------------
# Este archivo contiene los endpoints relacionados con los rankings
# de BeerMap.
#
# Rankings disponibles:
# - ranking dentro de un grupo
# - ranking global de usuarios (histórico, semanal, mensual)
# - ranking por país
# - ranking por ciudad
#
# Importante:
# - El ranking histórico usa user_points_total (tabla resumen) para
#   ser rápido aunque haya millones de check-ins.
# - Los rankings por período (semanal/mensual) suman directamente
#   desde points_ledger filtrando por fecha, porque no existe tabla
#   resumen por período.
# - Solo aparecen en los rankings de período los usuarios que han
#   tenido al menos un check-in en ese intervalo de tiempo.
#
# Seguridad OWASP aplicada:
#
# - OWASP A01 Broken Access Control
#     * comprobación de pertenencia al grupo
#
# - OWASP A03 Injection
#     * uso de SQLAlchemy ORM
#
# - OWASP A09 Logging and Monitoring Failures
#     * el sistema ya tiene audit logs disponibles
# -------------------------------------------------------------------

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models import Group, GroupMember, PointsLedger, User, UserPointsTotal
from ..schemas import RankingEntry
from ..auth import get_current_user


# -------------------------------------------------------------------
# Creación del router
# -------------------------------------------------------------------
# Todas las rutas de este archivo empezarán por /rankings
# -------------------------------------------------------------------
router = APIRouter(
    prefix="/rankings",
    tags=["Rankings"]
)


def _ranking_por_periodo(
    db: Session,
    dias: int,
    pais: str | None = None,
    ciudad: str | None = None,
) -> list[RankingEntry]:
    """
    Función interna reutilizable para rankings de período.

    Parámetros:
    - dias: ventana de tiempo hacia atrás (7 para semana, 30 para mes)
    - pais: si se indica, filtra solo usuarios de ese país
    - ciudad: si se indica, filtra solo usuarios de esa ciudad

    Qué hace:
    - calcula la fecha de corte
    - suma deltas de points_ledger con reason='checkin' dentro del período
    - aplica filtros de país/ciudad si se indican
    - devuelve top 100 ordenado por puntos
    """
    fecha_corte = datetime.now(timezone.utc) - timedelta(days=dias)
    puntos_periodo = func.sum(PointsLedger.delta)

    consulta = db.query(
        User.id.label("user_id"),
        User.username.label("username"),
        func.coalesce(puntos_periodo, 0).label("points"),
        User.avatar_url.label("avatar_url"),
        User.ciudad.label("ciudad"),
        User.pais.label("pais"),
    ).join(
        PointsLedger,
        PointsLedger.user_id == User.id
    ).filter(
        User.is_active == True,
        PointsLedger.reason == "checkin",
        PointsLedger.created_at >= fecha_corte
    )

    # Filtros opcionales de localización
    if pais is not None:
        consulta = consulta.filter(User.pais == pais)
    if ciudad is not None:
        consulta = consulta.filter(User.ciudad == ciudad)

    filas = consulta.group_by(
        User.id,
        User.username
    ).order_by(
        puntos_periodo.desc(),
        User.username.asc()
    ).limit(100).all()

    return construir_respuesta_ranking(filas)


def construir_respuesta_ranking(filas) -> list[RankingEntry]:
    """
    Construye la respuesta final del ranking.

    Qué hace:
    - recorre las filas devueltas por la consulta
    - transforma cada fila en un objeto RankingEntry
    - incluye avatar_url, ciudad y pais para el mini-perfil público
    - devuelve la lista final lista para la API
    """
    resultado = []

    for fila in filas:
        resultado.append(
            RankingEntry(
                user_id=fila.user_id,
                username=fila.username,
                points=int(fila.points),
                avatar_url=getattr(fila, "avatar_url", None),
                ciudad=getattr(fila, "ciudad", None),
                pais=getattr(fila, "pais", None),
            )
        )

    return resultado


def comprobar_pertenencia_grupo(
    group_id: UUID,
    current_user: User,
    db: Session
):
    """
    Comprueba dos cosas:
    1) que el grupo exista
    2) que el usuario autenticado pertenezca a ese grupo

    Esto evita que un usuario pueda ver el ranking
    de un grupo que no es suyo.
    """
    # ---------------------------------------------------------------
    # 1) Se comprueba que el grupo exista
    # ---------------------------------------------------------------
    grupo = db.query(Group).filter(Group.id == group_id).first()

    if grupo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grupo no encontrado",
        )

    # ---------------------------------------------------------------
    # 2) Se comprueba que el usuario pertenezca al grupo
    # ---------------------------------------------------------------
    pertenencia = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == current_user.id
    ).first()

    if pertenencia is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No perteneces a este grupo",
        )


# -------------------------------------------------------------------
# ENDPOINT: ranking de un grupo
# -------------------------------------------------------------------
@router.get("/group/{group_id}", response_model=list[RankingEntry])
def obtener_ranking_grupo(
    group_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Devuelve el ranking de puntos de un grupo.

    Flujo:
    1) comprueba que el grupo exista
    2) comprueba que el usuario pertenezca al grupo
    3) obtiene los miembros activos del grupo
    4) lee los puntos desde user_points_total
    5) ordena de mayor a menor
    6) devuelve la lista final
    """
    # ---------------------------------------------------------------
    # Seguridad: solo miembros del grupo pueden ver este ranking
    # ---------------------------------------------------------------
    comprobar_pertenencia_grupo(
        group_id=group_id,
        current_user=current_user,
        db=db
    )

    # ---------------------------------------------------------------
    # Se usa coalesce para que, si un usuario todavía no tiene fila
    # en user_points_total, devuelva 0 en lugar de NULL.
    # ---------------------------------------------------------------
    puntos_total = func.coalesce(UserPointsTotal.total_points, 0)

    filas = db.query(
        User.id.label("user_id"),
        User.username.label("username"),
        puntos_total.label("points"),
        User.avatar_url.label("avatar_url"),
        User.ciudad.label("ciudad"),
        User.pais.label("pais"),
    ).join(
        GroupMember,
        GroupMember.user_id == User.id
    ).outerjoin(
        UserPointsTotal,
        UserPointsTotal.user_id == User.id
    ).filter(
        GroupMember.group_id == group_id,
        User.is_active == True
    ).order_by(
        puntos_total.desc(),
        User.username.asc()
    ).all()

    return construir_respuesta_ranking(filas)


# -------------------------------------------------------------------
# ENDPOINT: ranking global
# -------------------------------------------------------------------
@router.get("/global", response_model=list[RankingEntry])
def obtener_ranking_global(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Devuelve el ranking global de BeerMap.

    Qué hace:
    - trae usuarios activos
    - lee sus puntos desde user_points_total
    - ordena de mayor a menor
    - limita a los 100 primeros
    """
    puntos_total = func.coalesce(UserPointsTotal.total_points, 0)

    filas = db.query(
        User.id.label("user_id"),
        User.username.label("username"),
        puntos_total.label("points"),
        User.avatar_url.label("avatar_url"),
        User.ciudad.label("ciudad"),
        User.pais.label("pais"),
    ).outerjoin(
        UserPointsTotal,
        UserPointsTotal.user_id == User.id
    ).filter(
        User.is_active == True
    ).order_by(
        puntos_total.desc(),
        User.username.asc()
    ).limit(100).all()

    return construir_respuesta_ranking(filas)


# -------------------------------------------------------------------
# ENDPOINT: ranking global semanal
# -------------------------------------------------------------------
# Suma los puntos ganados por check-ins en los últimos 7 días.
# Solo aparecen usuarios con al menos un check-in en ese período.
# -------------------------------------------------------------------
@router.get("/global/weekly", response_model=list[RankingEntry])
def obtener_ranking_semanal(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Ranking global de los últimos 7 días."""
    return _ranking_por_periodo(db, dias=7)


# -------------------------------------------------------------------
# ENDPOINT: ranking global mensual
# -------------------------------------------------------------------
@router.get("/global/monthly", response_model=list[RankingEntry])
def obtener_ranking_mensual(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Ranking global de los últimos 30 días."""
    return _ranking_por_periodo(db, dias=30)


# -------------------------------------------------------------------
# ENDPOINT: ranking por país — semanal
# -------------------------------------------------------------------
@router.get("/country/{pais}/weekly", response_model=list[RankingEntry])
def obtener_ranking_pais_semanal(
    pais: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Ranking de un país en los últimos 7 días."""
    return _ranking_por_periodo(db, dias=7, pais=pais.strip())


# -------------------------------------------------------------------
# ENDPOINT: ranking por país — mensual
# -------------------------------------------------------------------
@router.get("/country/{pais}/monthly", response_model=list[RankingEntry])
def obtener_ranking_pais_mensual(
    pais: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Ranking de un país en los últimos 30 días."""
    return _ranking_por_periodo(db, dias=30, pais=pais.strip())


# -------------------------------------------------------------------
# ENDPOINT: ranking por ciudad — semanal
# -------------------------------------------------------------------
@router.get("/city/{ciudad}/weekly", response_model=list[RankingEntry])
def obtener_ranking_ciudad_semanal(
    ciudad: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Ranking de una ciudad en los últimos 7 días."""
    return _ranking_por_periodo(db, dias=7, ciudad=ciudad.strip())


# -------------------------------------------------------------------
# ENDPOINT: ranking por ciudad — mensual
# -------------------------------------------------------------------
@router.get("/city/{ciudad}/monthly", response_model=list[RankingEntry])
def obtener_ranking_ciudad_mensual(
    ciudad: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Ranking de una ciudad en los últimos 30 días."""
    return _ranking_por_periodo(db, dias=30, ciudad=ciudad.strip())


# -------------------------------------------------------------------
# ENDPOINT: ranking por país
# -------------------------------------------------------------------
@router.get("/country/{pais}", response_model=list[RankingEntry])
def obtener_ranking_pais(
    pais: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Devuelve el ranking de usuarios dentro de un país.

    Qué hace:
    - limpia el país recibido
    - filtra usuarios activos por país
    - lee puntos desde user_points_total
    - ordena de mayor a menor
    - limita a los 100 primeros
    """
    pais_limpio = pais.strip()
    puntos_total = func.coalesce(UserPointsTotal.total_points, 0)

    filas = db.query(
        User.id.label("user_id"),
        User.username.label("username"),
        puntos_total.label("points"),
        User.avatar_url.label("avatar_url"),
        User.ciudad.label("ciudad"),
        User.pais.label("pais"),
    ).outerjoin(
        UserPointsTotal,
        UserPointsTotal.user_id == User.id
    ).filter(
        User.is_active == True,
        User.pais == pais_limpio
    ).order_by(
        puntos_total.desc(),
        User.username.asc()
    ).limit(100).all()

    return construir_respuesta_ranking(filas)


# -------------------------------------------------------------------
# ENDPOINT: ranking por ciudad
# -------------------------------------------------------------------
@router.get("/city/{ciudad}", response_model=list[RankingEntry])
def obtener_ranking_ciudad(
    ciudad: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Devuelve el ranking de usuarios dentro de una ciudad.

    Qué hace:
    - limpia la ciudad recibida
    - filtra usuarios activos por ciudad
    - lee puntos desde user_points_total
    - ordena de mayor a menor
    - limita a los 100 primeros
    """
    ciudad_limpia = ciudad.strip()
    puntos_total = func.coalesce(UserPointsTotal.total_points, 0)

    filas = db.query(
        User.id.label("user_id"),
        User.username.label("username"),
        puntos_total.label("points"),
        User.avatar_url.label("avatar_url"),
        User.ciudad.label("ciudad"),
        User.pais.label("pais"),
    ).outerjoin(
        UserPointsTotal,
        UserPointsTotal.user_id == User.id
    ).filter(
        User.is_active == True,
        User.ciudad == ciudad_limpia
    ).order_by(
        puntos_total.desc(),
        User.username.asc()
    ).limit(100).all()

    return construir_respuesta_ranking(filas)