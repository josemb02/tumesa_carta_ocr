import React, { createContext, useContext, useEffect, useState } from "react";
import {
    guardarToken,
    obtenerToken,
    borrarToken,
    guardarRefreshToken,
    obtenerRefreshToken,
    borrarRefreshToken,
} from "../utils/almacenamiento";
import {
    loginUsuario,
    loginConGoogle,
    obtenerMiPerfil,
    registrarUsuario,
    refrescarToken,
    cerrarSesionBackend,
    actualizarAvatar,
} from "../servicios/servicioAuth";
import { configurarCallbacksAuth } from "../servicios/api";
import { registrarTokenPush } from "../servicios/servicioNotificaciones";

/*
 * Este archivo se encarga de gestionar la autenticación
 * global de toda la aplicación.
 *
 * Aquí centralizamos:
 * - token de sesión (access token + refresh token)
 * - usuario autenticado
 * - carga inicial de sesión
 * - login
 * - registro
 * - logout (revoca el refresh token en el backend)
 * - renovación automática de tokens al recibir un 401
 *
 * La idea es que las pantallas no tengan que gestionar
 * por su cuenta toda esta lógica.
 */

/*
 * Tipo base del usuario autenticado según lo que devuelve
 * el backend en /auth/me.
 */
type UsuarioAuth = {
    id: string;
    username: string;
    email: string;
    fecha_nacimiento?: string | null;
    pais?: string | null;
    ciudad?: string | null;
    role?: string;
    // URL pública de Cloudinary. Null si aún no ha subido foto.
    avatar_url?: string | null;
};

/*
 * Tipo que define todo lo que va a exponer el contexto.
 */
type TipoContextoAuth = {
    usuario: UsuarioAuth | null;
    token: string | null;
    cargando: boolean;
    iniciarSesion: (email: string, password: string) => Promise<void>;
    registrarNuevoUsuario: (
        username: string,
        email: string,
        password: string,
        fechaNacimiento?: string,
        pais?: string,
        ciudad?: string
    ) => Promise<void>;
    cerrarSesion: () => Promise<void>;
    recargarUsuario: () => Promise<void>;
    iniciarSesionConGoogle: (idToken: string) => Promise<void>;
    /*
     * Guarda la URL del avatar en el backend y actualiza el estado local.
     * Se llama desde perfil.tsx tras subir la imagen a Cloudinary.
     */
    guardarAvatar: (avatarUrl: string) => Promise<void>;
    /*
     * Actualiza parcialmente los datos del usuario en el contexto.
     * Se usa después de editar el perfil para que el nombre y ciudad
     * se reflejen inmediatamente en toda la app sin cerrar sesión.
     */
    actualizarUsuario: (datos: Partial<UsuarioAuth>) => void;
};

/*
 * Se crea el contexto.
 */
const ContextoAuth = createContext<TipoContextoAuth | undefined>(undefined);

/*
 * Este provider envuelve la app y deja disponible
 * el estado de autenticación en cualquier pantalla.
 */
function ProveedorAuth({ children }: { children: React.ReactNode }) {
    const [usuario, setUsuario] = useState<UsuarioAuth | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        /*
         * Registramos los callbacks antes de cargar la sesión.
         * Así, si el access token guardado ha expirado,
         * el interceptor de api.ts puede renovarlo automáticamente
         * durante la carga inicial.
         */
        configurarCallbacksAuth(intentarRefrescar, cerrarSesion);
        cargarSesionInicial();
    }, []);

    /*
     * Este método intenta restaurar una sesión anterior
     * usando el token guardado en el dispositivo.
     *
     * Si el access token ha expirado, el interceptor de api.ts
     * llama automáticamente a intentarRefrescar. Si tiene éxito,
     * setToken ya habrá sido llamado con el nuevo token, así que
     * leemos el token actualizado del almacenamiento al terminar.
     */
    async function cargarSesionInicial() {
        try {
            const tokenGuardado = await obtenerToken();

            if (!tokenGuardado) {
                setCargando(false);
                return;
            }

            const perfil = await obtenerMiPerfil(tokenGuardado);

            /*
             * El token puede haberse renovado durante la petición anterior
             * si el access token estaba expirado y el interceptor lo refrescó.
             * Leemos el valor actualizado del almacenamiento para no
             * sobreescribir el estado con un token antiguo.
             */
            const tokenActual = await obtenerToken();
            setToken(tokenActual);
            setUsuario(perfil);
        } catch (error) {
            /*
             * Si todo falla (access token inválido y refresh también),
             * limpiamos la sesión para que el usuario vuelva al login.
             */
            await borrarToken();
            await borrarRefreshToken();
            setToken(null);
            setUsuario(null);
        } finally {
            setCargando(false);
        }
    }

    /*
     * Este método intenta renovar el access token usando
     * el refresh token guardado en el dispositivo.
     *
     * Lo usa el interceptor de api.ts cuando recibe un 401.
     *
     * Devuelve:
     * - el nuevo access token si el refresco tiene éxito
     * - null si el refresh token no existe o ya no es válido
     */
    async function intentarRefrescar(): Promise<string | null> {
        try {
            const refreshTokenGuardado = await obtenerRefreshToken();

            if (!refreshTokenGuardado) {
                return null;
            }

            const respuesta = await refrescarToken(refreshTokenGuardado);

            const nuevoAccessToken = respuesta.access_token;
            const nuevoRefreshToken = respuesta.refresh_token;

            /*
             * Guardamos los nuevos tokens y actualizamos el estado.
             * El refresh token anterior ya fue revocado en el backend
             * (rotación de tokens).
             */
            await guardarToken(nuevoAccessToken);
            await guardarRefreshToken(nuevoRefreshToken);
            setToken(nuevoAccessToken);

            return nuevoAccessToken;
        } catch {
            return null;
        }
    }

    /*
     * Este método hace login completo.
     * Guarda access token y refresh token.
     */
    async function iniciarSesion(email: string, password: string) {
        const respuestaLogin = await loginUsuario(email, password);
        const nuevoToken = respuestaLogin.access_token;
        const nuevoRefreshToken = respuestaLogin.refresh_token;

        await guardarToken(nuevoToken);
        await guardarRefreshToken(nuevoRefreshToken);

        const perfil = await obtenerMiPerfil(nuevoToken);

        setToken(nuevoToken);
        setUsuario(perfil);

        // Registrar token push en segundo plano (fallo silencioso)
        registrarTokenPush(nuevoToken);
    }

    /*
     * Este método registra un usuario nuevo y después
     * inicia sesión automáticamente.
     */
    async function registrarNuevoUsuario(
        username: string,
        email: string,
        password: string,
        fechaNacimiento?: string,
        pais?: string,
        ciudad?: string
    ) {
        await registrarUsuario(
            username,
            email,
            password,
            fechaNacimiento,
            pais,
            ciudad
        );

        await iniciarSesion(email, password);
    }

    /*
     * Este método cierra la sesión del usuario.
     *
     * Qué hace:
     * 1. Revoca el refresh token en el backend (POST /auth/logout)
     * 2. Elimina ambos tokens del dispositivo
     * 3. Limpia el estado local
     *
     * Si la llamada al backend falla (sin conexión, token ya revocado...),
     * igual limpiamos la sesión local para no dejar al usuario bloqueado.
     */
    async function cerrarSesion() {
        try {
            const refreshTokenGuardado = await obtenerRefreshToken();

            if (refreshTokenGuardado) {
                await cerrarSesionBackend(refreshTokenGuardado);
            }
        } catch {
            /*
             * Silenciamos errores de red en el logout.
             * Lo importante es limpiar la sesión local.
             */
        } finally {
            await borrarToken();
            await borrarRefreshToken();
            setToken(null);
            setUsuario(null);
        }
    }

    /*
     * Este método vuelve a pedir el perfil al backend
     * usando el token actual.
     */
    async function recargarUsuario() {
        if (!token) {
            return;
        }

        const perfil = await obtenerMiPerfil(token);
        setUsuario(perfil);
    }

    /*
     * Este método envía la URL del avatar al backend y actualiza
     * el estado local del usuario para que todos los componentes
     * vean la foto nueva inmediatamente sin recargar sesión.
     *
     * La subida a Cloudinary la hace el frontend antes de llamar aquí.
     */
    async function iniciarSesionConGoogle(idToken: string) {
        const respuesta = await loginConGoogle(idToken);
        const nuevoToken = respuesta.access_token;
        const nuevoRefreshToken = respuesta.refresh_token;

        await guardarToken(nuevoToken);
        await guardarRefreshToken(nuevoRefreshToken);

        const perfil = await obtenerMiPerfil(nuevoToken);

        setToken(nuevoToken);
        setUsuario(perfil);

        registrarTokenPush(nuevoToken);
    }

    async function guardarAvatar(avatarUrl: string) {
        if (!token) return;

        const perfilActualizado = await actualizarAvatar(token, avatarUrl);

        // Actualizamos solo el campo avatar_url manteniendo el resto del perfil
        setUsuario(prev => prev ? { ...prev, avatar_url: perfilActualizado.avatar_url } : prev);
    }

    /*
     * Actualiza parcialmente los datos del usuario en el contexto.
     * Se usa después de editar el perfil para que el nombre y ciudad
     * se reflejen inmediatamente en toda la app sin cerrar sesión.
     */
    function actualizarUsuario(datos: Partial<UsuarioAuth>) {
        setUsuario(prev => prev ? { ...prev, ...datos } : prev);
    }

    return (
        <ContextoAuth.Provider
            value={{
                usuario,
                token,
                cargando,
                iniciarSesion,
                registrarNuevoUsuario,
                cerrarSesion,
                recargarUsuario,
                iniciarSesionConGoogle,
                guardarAvatar,
                actualizarUsuario,
            }}
        >
            {children}
        </ContextoAuth.Provider>
    );
}

/*
 * Este hook personalizado facilita usar el contexto
 * desde cualquier pantalla o componente.
 */
function usarAuth() {
    const contexto = useContext(ContextoAuth);

    if (!contexto) {
        throw new Error("usarAuth debe usarse dentro de ProveedorAuth");
    }

    return contexto;
}

export { ProveedorAuth, usarAuth };
