import { API_URL } from "../utils/constantes";

/*
 * Este archivo centraliza la función base para hacer
 * peticiones HTTP al backend.
 *
 * Se deja aquí para:
 * - no repetir fetch en todos los servicios
 * - centralizar headers comunes
 * - poder añadir mejoras globales más adelante
 * - mantener una arquitectura más limpia
 */

type OpcionesPeticion = {
    metodo?: "GET" | "POST" | "PUT" | "DELETE";
    token?: string | null;
    body?: any;
};

/*
 * Este método hace una petición genérica al backend.
 *
 * Parámetros:
 * - ruta: endpoint relativo, por ejemplo "/auth/login"
 * - metodo: GET, POST, PUT o DELETE
 * - token: JWT si la ruta necesita autorización
 * - body: datos a enviar en el cuerpo de la petición
 *
 * Qué hace:
 * - construye la URL final
 * - añade cabeceras necesarias
 * - añade token si existe
 * - convierte el body a JSON si hace falta
 * - intenta leer la respuesta del backend
 * - si hay error, lanza un Error con mensaje claro
 */
export const hacerPeticion = async (
    ruta: string,
    opciones: OpcionesPeticion = {}
) => {
    const metodo = opciones.metodo || "GET";
    const token = opciones.token || null;
    const body = opciones.body;

    const headers: Record<string, string> = {
        "Content-Type": "application/json"
    };

    /*
     * Si la petición necesita autenticación,
     * se añade el token JWT en la cabecera Authorization.
     */
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const configuracion: RequestInit = {
        method: metodo,
        headers: headers
    };

    /*
     * Si hay body, se convierte a JSON.
     * En GET normalmente no se manda body.
     */
    if (body) {
        configuracion.body = JSON.stringify(body);
    }

    const respuesta = await fetch(`${API_URL}${ruta}`, configuracion);

    /*
     * Se intenta leer la respuesta como JSON.
     * Si el backend no devuelve JSON válido, se deja null.
     */
    let datos = null;

    try {
        datos = await respuesta.json();
    } catch (error) {
        datos = null;
    }

    /*
     * Si la respuesta no ha ido bien, se intenta sacar
     * un mensaje útil del backend.
     */
    if (!respuesta.ok) {
        let mensajeError = "Ha ocurrido un error en la petición";

        if (datos) {
            if (datos.error) {
                if (datos.error.message) {
                    mensajeError = datos.error.message;
                }
            } else if (datos.detail) {
                mensajeError = datos.detail;
            }
        }

        throw new Error(mensajeError);
    }

    return datos;
};