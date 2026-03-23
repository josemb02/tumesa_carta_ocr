import { hacerPeticion } from "./api";

/*
 * Este archivo centraliza las llamadas al backend
 * relacionadas con el sistema de iconos/emoticonos.
 *
 * Separamos esta lógica del servicioAuth para mantener
 * cada módulo enfocado en un único dominio.
 */

/*
 * Devuelve el catálogo completo de iconos activos.
 *
 * Cada icono incluye:
 * - id, nombre, emoji, descripcion, coste_puntos, tipo
 * - poseido: true si el usuario lo tiene (o es gratis)
 * - activo: true si es el icono seleccionado actualmente
 */
export const obtenerCatalogo = async (token: string) => {
    return await hacerPeticion("/icons", {
        metodo: "GET",
        token
    });
};

/*
 * Devuelve solo los iconos disponibles para el usuario:
 * - todos los gratis
 * - los premium que ha comprado
 *
 * Se usa en el selector del modal de check-in.
 */
export const obtenerMisIconos = async (token: string) => {
    return await hacerPeticion("/icons/my", {
        metodo: "GET",
        token
    });
};

/*
 * Compra un icono con puntos.
 * El backend verifica puntos suficientes y aplica el descuento
 * de forma atómica.
 *
 * Devuelve: icono comprado, puntos gastados, puntos restantes.
 */
export const comprarIcono = async (token: string, iconId: string) => {
    return await hacerPeticion(`/icons/${iconId}/buy`, {
        metodo: "POST",
        token
    });
};

/*
 * Cambia el icono activo del usuario.
 * El icono debe estar en posesión del usuario (gratis o comprado).
 */
export const cambiarIconoActivo = async (token: string, iconId: string) => {
    return await hacerPeticion("/icons/active", {
        metodo: "PATCH",
        token,
        body: { icon_id: iconId }
    });
};
