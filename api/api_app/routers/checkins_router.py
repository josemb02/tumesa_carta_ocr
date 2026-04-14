# app/routers/checkins_router.py
# -------------------------------------------------------------------
# Router de check-ins
# -------------------------------------------------------------------
# Este archivo concentra la lógica relacionada con los check-ins.
#
# Equivalencia mental con Spring Boot:
# - esto sería como tu CheckinController
#
# Qué vamos a gestionar aquí:
# - crear check-in
# - validar cooldown de 5 minutos
# - sumar puntos al usuario
# - actualizar la tabla resumen de puntos
# - devolver los check-ins del usuario para pintar su mapa
#
# Seguridad:
# - solo usuarios autenticados pueden hacer check-in
# - solo usuarios autenticados pueden ver su mapa
# - se registra auditoría en acciones importantes
# - se valida pertenencia al grupo si el check-in va asociado a grupo
# -------------------------------------------------------------------

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import desc
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from ..audit import write_audit_log
from ..auth import get_current_user
from ..config import settings
from ..database import get_db
from ..models import Checkin, GroupMember, PointsLedger, User, UserDevice, UserPointsTotal
from ..notificaciones import enviar_notificacion_a_usuario, programar_notificacion_cooldown
from ..schemas import CreateCheckinRequest, CheckinResponse, MapCheckinResponse


# -------------------------------------------------------------------
# Router de check-ins
# -------------------------------------------------------------------
router = APIRouter(
    prefix="/checkins",
    tags=["Checkins"]
)


def actualizar_resumen_puntos_usuario(
    user_id,
    delta_puntos: int,
    db: Session
):
    """
    Actualiza la tabla resumen user_points_total.

    Qué hace:
    - busca si el usuario ya tiene fila en la tabla resumen
    - si no la tiene, la crea
    - si ya la tiene, suma los puntos nuevos
    - actualiza la fecha de modificación

    Esto sirve para:
    - seguir guardando el historial real en points_ledger
    - tener además un total rápido para rankings
    """
    resumen = db.query(UserPointsTotal).filter(
        UserPointsTotal.user_id == user_id
    ).first()

    # Si el usuario todavía no tiene fila en la tabla resumen,
    # se crea con los puntos iniciales.
    if resumen is None:
        resumen = UserPointsTotal(
            user_id=user_id,
            total_points=delta_puntos
        )
        db.add(resumen)

    # Si ya existe, simplemente se suma el nuevo delta.
    else:
        resumen.total_points = resumen.total_points + delta_puntos
        resumen.updated_at = datetime.now(timezone.utc)


@router.post("", response_model=CheckinResponse, status_code=status.HTTP_201_CREATED)
def crear_checkin(
    payload: CreateCheckinRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Crea un check-in nuevo para el usuario autenticado.

    Flujo:
    1) comprueba cooldown de 5 minutos
    2) si viene group_id, valida que el usuario pertenezca al grupo
    3) valida lat/lng y precio si vienen informados
    4) crea el check-in
    5) suma +1 punto en el ledger
    6) actualiza la tabla resumen user_points_total
    7) guarda audit log
    8) devuelve el check-in creado

    Seguridad:
    - OWASP A01 Broken Access Control:
      solo usuarios autenticados pueden hacer check-in
    - OWASP A03 Injection:
      se usa SQLAlchemy ORM y no SQL manual
    - OWASP A09 Logging and Monitoring Failures:
      se registra la acción en audit_logs
    """
    # ---------------------------------------------------------------
    # 1) Se busca el último check-in del usuario para aplicar cooldown
    # ---------------------------------------------------------------
    ultimo_checkin = db.query(Checkin).filter(
        Checkin.user_id == current_user.id
    ).order_by(
        desc(Checkin.created_at)
    ).first()

    if ultimo_checkin is not None:
        ahora = datetime.now(timezone.utc)
        limite = ahora - timedelta(seconds=settings.CHECKIN_COOLDOWN_SECONDS)

        # Si el último check-in sigue dentro del cooldown,
        # no se permite crear otro todavía.
        if ultimo_checkin.created_at > limite:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Debes esperar antes de hacer otro check-in",
            )

    # ---------------------------------------------------------------
    # 2) Se valida latitud y longitud para devolver un error claro
    # antes de que lo tenga que rechazar la base de datos.
    # ---------------------------------------------------------------
    if payload.lat < -90 or payload.lat > 90:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La latitud no es válida",
        )

    if payload.lng < -180 or payload.lng > 180:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La longitud no es válida",
        )

    # ---------------------------------------------------------------
    # 3) Si viene group_id, se comprueba que el usuario pertenezca
    #    a ese grupo
    #
    # Esto evita que un usuario meta un check-in en un grupo ajeno.
    # ---------------------------------------------------------------
    if payload.group_id is not None:
        pertenece = db.query(GroupMember).filter(
            GroupMember.group_id == payload.group_id,
            GroupMember.user_id == current_user.id
        ).first()

        if pertenece is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No perteneces al grupo indicado",
            )

    # ---------------------------------------------------------------
    # 4) Si viene precio, se valida que no sea negativo
    # ---------------------------------------------------------------
    if payload.precio is not None:
        if payload.precio < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El precio no puede ser negativo",
            )

    # ---------------------------------------------------------------
    # 4b) Si viene foto_url, se valida que sea de nuestro Cloudinary
    #     para evitar que se guarden URLs arbitrarias de terceros
    # ---------------------------------------------------------------
    CLOUDINARY_PREFIX = "https://res.cloudinary.com/dxfvlrxaw/"
    if payload.foto_url is not None:
        if not payload.foto_url.startswith(CLOUDINARY_PREFIX):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="La URL de la foto no pertenece al servicio permitido",
            )

    # ---------------------------------------------------------------
    # 5) Se crea el check-in
    # ---------------------------------------------------------------
    checkin = Checkin(
        user_id=current_user.id,
        group_id=payload.group_id,
        icon_id=payload.icon_id,
        lat=payload.lat,
        lng=payload.lng,
        precio=payload.precio,
        note=payload.note,
        foto_url=payload.foto_url,
        icon_emoji=payload.icon_emoji,
    )

    db.add(checkin)

    # Capturamos errores de BD aquí para devolver un mensaje claro al frontend
    # en lugar del genérico "Ha ocurrido un error en la petición".
    # El caso más habitual es que una columna nueva no exista aún en producción.
    try:
        # flush() fuerza el INSERT para que ya exista checkin.id
        # antes de crear el movimiento en points_ledger.
        db.flush()
    except SQLAlchemyError as exc:
        db.rollback()
        logger.error("[crear_checkin] Error al insertar check-in: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"No se pudo guardar el check-in. Detalle técnico: {exc}",
        )

    # ---------------------------------------------------------------
    # 6) Se suma +1 punto en el historial real de puntos
    # ---------------------------------------------------------------
    movimiento_puntos = PointsLedger(
        user_id=current_user.id,
        delta=1,
        reason="checkin",
        ref_type="checkin",
        ref_id=checkin.id,
    )

    db.add(movimiento_puntos)

    # ---------------------------------------------------------------
    # 7) Se actualiza también la tabla resumen de puntos
    # ---------------------------------------------------------------
    actualizar_resumen_puntos_usuario(
        user_id=current_user.id,
        delta_puntos=1,
        db=db
    )

    # ---------------------------------------------------------------
    # 8) Se guarda todo en base de datos
    # ---------------------------------------------------------------
    try:
        db.commit()
        db.refresh(checkin)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.error("[crear_checkin] Error al hacer commit: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"No se pudo confirmar el check-in. Detalle técnico: {exc}",
        )

    # ---------------------------------------------------------------
    # 9) Notificaciones push (silenciosas si fallan)
    # ---------------------------------------------------------------
    # 9a) Notificar a los usuarios que el current_user acaba de superar.
    #     Son los que tenían exactamente (nuevo_total - 1) puntos.
    resumen_actual = db.query(UserPointsTotal).filter(
        UserPointsTotal.user_id == current_user.id
    ).first()

    if resumen_actual is not None:
        nuevo_total = resumen_actual.total_points
        superados = db.query(UserPointsTotal).filter(
            UserPointsTotal.total_points == nuevo_total - 1,
            UserPointsTotal.user_id != current_user.id,
        ).limit(10).all()

        for superado in superados:
            enviar_notificacion_a_usuario(
                user_id=superado.user_id,
                titulo="¡Te han superado! 📈",
                mensaje=f"{current_user.username} te ha adelantado en el ranking.",
                datos={"tipo": "superado"},
                db=db,
            )

    # 9b) Programar aviso de cooldown (5 minutos)
    tokens_usuario = [
        d.push_token
        for d in db.query(UserDevice).filter(UserDevice.user_id == current_user.id).all()
    ]
    programar_notificacion_cooldown(tokens_usuario, segundos=300)

    # ---------------------------------------------------------------
    # 10) Se guarda auditoría
    # ---------------------------------------------------------------
    write_audit_log(
        db=db,
        action="checkin_create",
        request=request,
        user_id=current_user.id
    )

    # ---------------------------------------------------------------
    # 10) Se devuelve respuesta
    # ---------------------------------------------------------------
    return CheckinResponse(
        id=checkin.id,
        lat=checkin.lat,
        lng=checkin.lng,
        precio=checkin.precio,
        note=checkin.note,
        foto_url=checkin.foto_url,
        icon_emoji=checkin.icon_emoji,
    )


@router.get("/my-map", response_model=list[MapCheckinResponse])
def obtener_mi_mapa(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Devuelve todos los check-ins del usuario autenticado para pintar
    su mapa personal.

    Qué hace:
    - busca todos los check-ins del usuario actual
    - los ordena del más reciente al más antiguo
    - devuelve los datos necesarios para colocar chinchetas

    Seguridad:
    - cada usuario solo puede ver su propio mapa
    - se usa SQLAlchemy ORM y no SQL manual
    """
    # Si la consulta falla (p.ej. columna nueva no existe aún en producción),
    # devolvemos lista vacía en lugar de un 500 que rompe la pantalla del mapa.
    try:
        checkins = db.query(Checkin).filter(
            Checkin.user_id == current_user.id
        ).order_by(
            desc(Checkin.created_at)
        ).limit(500).all()
    except SQLAlchemyError as exc:
        logger.error("[my-map] Error al consultar check-ins: %s", exc)
        return []

    respuesta = []

    for checkin in checkins:
        try:
            respuesta.append(
                MapCheckinResponse(
                    id=checkin.id,
                    lat=checkin.lat,
                    lng=checkin.lng,
                    precio=checkin.precio,
                    note=getattr(checkin, "note", None),
                    foto_url=getattr(checkin, "foto_url", None),
                    icon_emoji=getattr(checkin, "icon_emoji", None),
                )
            )
        except Exception as exc:
            # Si un check-in individual tiene un campo roto, lo ignoramos
            logger.warning("[my-map] Check-in %s ignorado por error: %s", checkin.id, exc)

    return respuesta


@router.get("/my-history", response_model=list[CheckinResponse])
def obtener_mi_historial(
    limite: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Devuelve el historial paginado de check-ins del usuario autenticado,
    ordenado del más reciente al más antiguo.
    Usado para la vista de lista en el perfil.
    """
    checkins = db.query(Checkin).filter(
        Checkin.user_id == current_user.id
    ).order_by(
        desc(Checkin.created_at)
    ).offset(offset).limit(limite).all()

    return [
        CheckinResponse(
            id=c.id,
            lat=c.lat,
            lng=c.lng,
            precio=c.precio,
            note=c.note,
            foto_url=c.foto_url,
            icon_emoji=c.icon_emoji,
            created_at=c.created_at,
        )
        for c in checkins
    ]