# routers/icons_router.py
# =========================================================
# BeerMap - Router de Iconos
# =========================================================
# Gestiona el catálogo de iconos, compras con puntos
# y el icono activo del usuario.
#
# Endpoints:
#   GET  /icons          — catálogo completo con flags por usuario
#   GET  /icons/my       — iconos en posesión del usuario
#   POST /icons/{id}/buy — comprar icono con puntos (transaccional)
#   PATCH /icons/active  — cambiar icono activo
#
# Seguridad:
# - OWASP A01: todos los endpoints requieren JWT válido
# - OWASP A03: solo ORM, sin SQL concatenado
# - OWASP A04: la compra es atómica (rollback si falla)
# =========================================================

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    User,
    IconCatalog,
    UserOwnedIcon,
    PointsLedger,
    UserPointsTotal,
)
from ..auth import get_current_user

router = APIRouter(prefix="/icons", tags=["icons"])


# ─── Schemas locales ──────────────────────────────────────────────────────────

class ActiveIconRequest(BaseModel):
    """Payload para cambiar el icono activo del usuario."""
    icon_id: UUID


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _puntos_actuales(user_id, db: Session) -> int:
    """
    Devuelve los puntos actuales del usuario desde la tabla resumen.
    Devuelve 0 si el usuario aún no tiene fila (nunca ha hecho check-in).
    """
    resumen = db.query(UserPointsTotal).filter(
        UserPointsTotal.user_id == user_id
    ).first()
    return resumen.total_points if resumen else 0


def _registrar_gasto_puntos(user_id, delta_negativo: int, icono_id, db: Session):
    """
    Anota el gasto de puntos en el ledger y actualiza la tabla resumen.

    delta_negativo debe ser un entero negativo (ej: -500).
    No hace commit — el llamador es responsable de comitear o hacer rollback.
    """
    # Anotación en el ledger para trazabilidad completa
    entrada_ledger = PointsLedger(
        user_id=user_id,
        delta=delta_negativo,
        reason="buy_icon",
        ref_type="icon",
        ref_id=icono_id,
    )
    db.add(entrada_ledger)

    # Actualización del resumen rápido (para rankings y stats)
    resumen = db.query(UserPointsTotal).filter(
        UserPointsTotal.user_id == user_id
    ).first()

    if resumen is None:
        # El usuario nunca ha tenido puntos — creamos la fila desde negativo
        resumen = UserPointsTotal(
            user_id=user_id,
            total_points=delta_negativo
        )
        db.add(resumen)
    else:
        resumen.total_points = resumen.total_points + delta_negativo
        resumen.updated_at = datetime.now(timezone.utc)


def _ids_iconos_poseidos(user_id, db: Session) -> set:
    """
    Devuelve un set con los UUIDs de los iconos que posee el usuario
    (solo los premium comprados; los gratis se manejan aparte).
    """
    return {
        row.icon_id
        for row in db.query(UserOwnedIcon.icon_id).filter(
            UserOwnedIcon.user_id == user_id
        ).all()
    }


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("")
def listar_catalogo(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Devuelve el catálogo completo de iconos activos.

    Cada icono incluye:
    - poseido: true si el usuario lo tiene (o es gratis)
    - activo: true si es el icono actualmente seleccionado
    """
    poseidos = _ids_iconos_poseidos(current_user.id, db)

    iconos = (
        db.query(IconCatalog)
        .filter(IconCatalog.activo == True)
        .order_by(IconCatalog.coste_puntos)
        .all()
    )

    return [
        {
            "id":           str(ic.id),
            "nombre":       ic.nombre,
            "emoji":        ic.emoji,
            "descripcion":  ic.descripcion,
            "coste_puntos": ic.coste_puntos,
            "tipo":         ic.tipo,
            # Los gratis los tiene todo el mundo
            "poseido": ic.coste_puntos == 0 or ic.id in poseidos,
            "activo":  (
                current_user.active_icon_id is not None
                and current_user.active_icon_id == ic.id
            ),
        }
        for ic in iconos
    ]


@router.get("/my")
def mis_iconos(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Devuelve los iconos disponibles para el usuario:
    - Todos los gratis (coste_puntos == 0)
    - Los premium que ha comprado
    """
    # Iconos gratis del catálogo
    gratis = (
        db.query(IconCatalog)
        .filter(IconCatalog.coste_puntos == 0, IconCatalog.activo == True)
        .all()
    )

    # Iconos premium comprados por el usuario
    comprados = (
        db.query(IconCatalog)
        .join(UserOwnedIcon, UserOwnedIcon.icon_id == IconCatalog.id)
        .filter(
            UserOwnedIcon.user_id == current_user.id,
            IconCatalog.activo == True
        )
        .all()
    )

    # Unión sin duplicados manteniendo orden gratis → comprados
    vistos = set()
    todos = []
    for ic in gratis + comprados:
        if ic.id not in vistos:
            vistos.add(ic.id)
            todos.append(ic)

    return [
        {
            "id":     str(ic.id),
            "nombre": ic.nombre,
            "emoji":  ic.emoji,
            "activo": (
                current_user.active_icon_id is not None
                and current_user.active_icon_id == ic.id
            ),
        }
        for ic in todos
    ]


@router.post("/{icon_id}/buy", status_code=status.HTTP_201_CREATED)
def comprar_icono(
    icon_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Compra un icono con puntos.

    Qué hace:
    1. Verifica que el icono existe y está activo
    2. Rechaza si el icono es gratis (no necesita comprarse)
    3. Rechaza si el usuario ya lo tiene
    4. Verifica puntos suficientes
    5. Descuenta puntos en ledger y resumen (atómico)
    6. Añade el icono al inventario del usuario

    Si falla cualquier paso después del descuento,
    hace rollback para no dejar puntos descontados sin icono.

    Seguridad:
    - OWASP A04: operación atómica con rollback
    """
    # ── Verificar que el icono existe ──────────────────────
    icono = db.query(IconCatalog).filter(
        IconCatalog.id == icon_id,
        IconCatalog.activo == True
    ).first()

    if icono is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Icono no encontrado"
        )

    # ── Rechazar si es gratis ──────────────────────────────
    if icono.coste_puntos == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este icono es gratuito, no necesita comprarse"
        )

    # ── Rechazar si ya lo tiene ────────────────────────────
    ya_poseido = db.query(UserOwnedIcon).filter(
        UserOwnedIcon.user_id == current_user.id,
        UserOwnedIcon.icon_id == icon_id
    ).first()

    if ya_poseido is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya posees este icono"
        )

    # ── Verificar puntos suficientes ───────────────────────
    puntos_antes = _puntos_actuales(current_user.id, db)

    if puntos_antes < icono.coste_puntos:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"Puntos insuficientes: tienes {puntos_antes} "
                f"y necesitas {icono.coste_puntos}"
            )
        )

    # ── Operación atómica: descontar + asignar ─────────────
    try:
        _registrar_gasto_puntos(
            user_id=current_user.id,
            delta_negativo=-icono.coste_puntos,
            icono_id=icono.id,
            db=db
        )

        db.add(UserOwnedIcon(
            user_id=current_user.id,
            icon_id=icono.id
        ))

        db.commit()

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error procesando la compra. Tus puntos no han sido descontados."
        )

    puntos_despues = _puntos_actuales(current_user.id, db)

    return {
        "detail": f"¡{icono.nombre} adquirido!",
        "icono": {
            "id":     str(icono.id),
            "nombre": icono.nombre,
            "emoji":  icono.emoji,
        },
        "puntos_gastados":   icono.coste_puntos,
        "puntos_restantes":  puntos_despues,
    }


@router.patch("/active")
def cambiar_icono_activo(
    payload: ActiveIconRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cambia el icono activo del usuario.

    El icono debe estar en posesión del usuario
    (bien sea gratis o ya comprado).
    """
    # ── Verificar que el icono existe ──────────────────────
    icono = db.query(IconCatalog).filter(
        IconCatalog.id == payload.icon_id,
        IconCatalog.activo == True
    ).first()

    if icono is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Icono no encontrado"
        )

    # ── Verificar posesión (solo para premium) ─────────────
    if icono.coste_puntos > 0:
        poseido = db.query(UserOwnedIcon).filter(
            UserOwnedIcon.user_id == current_user.id,
            UserOwnedIcon.icon_id == payload.icon_id
        ).first()

        if poseido is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No posees este icono"
            )

    # ── Actualizar icono activo ────────────────────────────
    current_user.active_icon_id = payload.icon_id
    current_user.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "detail": "Icono activo actualizado",
        "icono_activo": {
            "id":     str(icono.id),
            "nombre": icono.nombre,
            "emoji":  icono.emoji,
        },
    }
