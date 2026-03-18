import React, { createContext, useContext, useEffect, useState } from "react";
import { guardarToken, obtenerToken, borrarToken } from "../utils/almacenamiento";
import { loginUsuario, obtenerMiPerfil, registrarUsuario } from "../servicios/servicioAuth";

/*
 * Este archivo se encarga de gestionar la autenticación
 * global de toda la aplicación.
 *
 * Aquí centralizamos:
 * - token de sesión
 * - usuario autenticado
 * - carga inicial de sesión
 * - login
 * - registro
 * - logout
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
        cargarSesionInicial();
    }, []);

    /*
     * Este método intenta restaurar una sesión anterior
     * usando el token guardado en el dispositivo.
     */
    async function cargarSesionInicial() {
        try {
            const tokenGuardado = await obtenerToken();

            if (!tokenGuardado) {
                setCargando(false);
                return;
            }

            const perfil = await obtenerMiPerfil(tokenGuardado);

            setToken(tokenGuardado);
            setUsuario(perfil);
        } catch (error) {
            await borrarToken();
            setToken(null);
            setUsuario(null);
        } finally {
            setCargando(false);
        }
    }

    /*
     * Este método hace login completo.
     */
    async function iniciarSesion(email: string, password: string) {
        const respuestaLogin = await loginUsuario(email, password);
        const nuevoToken = respuestaLogin.access_token;

        await guardarToken(nuevoToken);

        const perfil = await obtenerMiPerfil(nuevoToken);

        setToken(nuevoToken);
        setUsuario(perfil);
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
     * Este método cierra la sesión local del usuario.
     */
    async function cerrarSesion() {
        await borrarToken();
        setToken(null);
        setUsuario(null);
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

    return (
        <ContextoAuth.Provider
            value={{
                usuario,
                token,
                cargando,
                iniciarSesion,
                registrarNuevoUsuario,
                cerrarSesion,
                recargarUsuario
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