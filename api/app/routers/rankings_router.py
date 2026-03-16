# app/routers/rankings_router.py
# -------------------------------------------------------------------
# Router de rankings
# -------------------------------------------------------------------
# Este archivo contiene los endpoints relacionados con los rankings
# de BeerMap.
#
# Rankings disponibles:
# - ranking dentro de un grupo
# - ranking global de usuarios
# - ranking por país
# - ranking por ciudad
#
# Importante:
# Antes el ranking se calculaba sumando points_ledger en cada consulta.
# Ahora se usa la tabla user_points_total, que guarda el total de puntos
# de cada usuario ya resumido.
#
# Esto sirve para:
# - que el ranking cargue más rápido
# - evitar castigar la base de datos cuando haya muchos check-ins
# - mantener points_ledger como historial real de movimientos
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

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models import Group, GroupMember, User, UserPointsTotal
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


def construir_respuesta_ranking(filas) -> list[RankingEntry]:
    """
    Construye la respuesta final del ranking.

    Qué hace:
    - recorre las filas devueltas por la consulta
    - transforma cada fila en un objeto RankingEntry
    - devuelve la lista final lista para la API
    """
    resultado = []

    for fila in filas:
        resultado.append(
            RankingEntry(
                user_id=fila.user_id,
                username=fila.username,
                points=int(fila.points)
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
        puntos_total.label("points")
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
        puntos_total.label("points")
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
        puntos_total.label("points")
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
        puntos_total.label("points")
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