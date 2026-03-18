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