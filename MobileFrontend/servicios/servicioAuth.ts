import { hacerPeticion } from "./api";

/*
 * Este archivo se encarga de comunicarse con el backend
 * para todo lo relacionado con autenticación.
 *
 * Se centraliza aquí para:
 * - no repetir lógica en login y registro
 * - dejar el código más limpio
 * - separar la capa visual de la capa de acceso a datos
 */

/*
 * Este método hace login contra el backend.
 *
 * Recibe:
 * - email del usuario
 * - password en texto plano
 *
 * Devuelve:
 * - access_token
 * - token_type
 */
export const loginUsuario = async (email: string, password: string) => {
    const respuesta = await hacerPeticion("/auth/login", {
        metodo: "POST",
        body: {
            email: email,
            password: password
        }
    });

    return respuesta;
};

/*
 * Este método registra un usuario nuevo en el backend.
 *
 * Recibe los datos mínimos del registro.
 *
 * Nota:
 * - Se dejan también país, ciudad y fecha_nacimiento
 *   porque tu API ya los soporta.
 */
export const registrarUsuario = async (
    username: string,
    email: string,
    password: string,
    fechaNacimiento?: string,
    pais?: string,
    ciudad?: string
) => {
    const body: any = {
        username: username,
        email: email,
        password: password
    };

    /*
     * Solo se envían los campos opcionales si tienen valor.
     * Así no mandamos basura innecesaria al backend.
     */
    if (fechaNacimiento) {
        body.fecha_nacimiento = fechaNacimiento;
    }

    if (pais) {
        body.pais = pais;
    }

    if (ciudad) {
        body.ciudad = ciudad;
    }

    const respuesta = await hacerPeticion("/auth/register", {
        metodo: "POST",
        body: body
    });

    return respuesta;
};

/*
 * Este método renueva el access token enviando el refresh token al backend.
 *
 * Devuelve:
 * - access_token nuevo
 * - refresh_token nuevo (rotación de tokens)
 */
export const refrescarToken = async (refreshToken: string) => {
    const respuesta = await hacerPeticion("/auth/refresh", {
        metodo: "POST",
        body: {
            refresh_token: refreshToken
        }
    });

    return respuesta;
};

/*
 * Este método cierra la sesión en el backend revocando
 * el refresh token del dispositivo actual.
 *
 * Si falla (por ejemplo, el token ya no existía), lo ignoramos
 * porque el objetivo es limpiar la sesión local igualmente.
 */
export const cerrarSesionBackend = async (refreshToken: string) => {
    await hacerPeticion("/auth/logout", {
        metodo: "POST",
        body: {
            refresh_token: refreshToken
        }
    });
};

/*
 * Este método pide al backend las estadísticas de actividad
 * del usuario autenticado.
 *
 * Devuelve:
 * - total_checkins, total_gastado, total_puntos, total_grupos
 * - checkins_esta_semana, checkins_este_mes
 * - ultimo_checkin (ISO string o null)
 */
export const obtenerMisStats = async (token: string) => {
    const respuesta = await hacerPeticion("/auth/me/stats", {
        metodo: "GET",
        token: token
    });

    return respuesta;
};

/*
 * Este método envía al backend la URL pública de Cloudinary
 * para actualizar la foto de perfil del usuario.
 *
 * El frontend sube la imagen directamente a Cloudinary ANTES
 * de llamar a esta función. Aquí solo guardamos la URL resultante.
 *
 * Devuelve el perfil actualizado con el nuevo avatar_url.
 */
export const actualizarAvatar = async (token: string, avatarUrl: string) => {
    const respuesta = await hacerPeticion("/auth/me/avatar", {
        metodo: "PATCH",
        token: token,
        body: { avatar_url: avatarUrl }
    });

    return respuesta;
};

/*
 * Pide al backend las rachas de check-ins del usuario autenticado.
 *
 * Devuelve:
 * - racha_actual: días consecutivos activos (0 si no hay racha viva)
 * - racha_maxima: mejor racha histórica
 * - ultimo_checkin: fecha ISO del último check-in o null
 */
export const obtenerMisRachas = async (token: string) => {
    const respuesta = await hacerPeticion("/auth/me/streaks", {
        metodo: "GET",
        token,
    });
    return respuesta;
};

/*
 * Cambia la contraseña del usuario autenticado.
 * Envía la contraseña actual (para verificar identidad) y la nueva.
 */
export const cambiarContrasena = async (
    token: string,
    passwordActual: string,
    passwordNuevo: string
) => {
    const respuesta = await hacerPeticion("/auth/me/change-password", {
        metodo: "POST",
        token,
        body: {
            password_actual: passwordActual,
            password_nuevo: passwordNuevo,
        },
    });
    return respuesta;
};

/*
 * Intercambia un id_token de Google por nuestro propio JWT.
 * El backend verifica el token con Google y devuelve access + refresh token.
 */
export const loginConGoogle = async (idToken: string) => {
    const respuesta = await hacerPeticion("/auth/google", {
        metodo: "POST",
        body: { id_token: idToken },
    });
    return respuesta;
};

/*
 * Este método pide al backend los datos del usuario autenticado.
 *
 * Necesita:
 * - token JWT válido
 *
 * Usa el endpoint /auth/me para recuperar
 * el perfil del usuario que ha iniciado sesión.
 */
export const obtenerMiPerfil = async (token: string) => {
    const respuesta = await hacerPeticion("/auth/me", {
        metodo: "GET",
        token: token
    });

    return respuesta;
};