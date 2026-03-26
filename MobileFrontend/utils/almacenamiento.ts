// SEGURIDAD: Se usa expo-secure-store en lugar de AsyncStorage.
// AsyncStorage no está cifrado en Android (cualquier app con root puede leerlo).
// SecureStore usa Keychain en iOS y EncryptedSharedPreferences en Android.
//
// Límite: 2048 bytes por clave — los JWT de BeerMap caben perfectamente.
//
// Para instalar (si no está ya): npx expo install expo-secure-store

import * as SecureStore from "expo-secure-store";
import { CLAVE_TOKEN, CLAVE_REFRESH_TOKEN } from "./constantes";

/*
 * Este archivo se encarga del almacenamiento local seguro
 * relacionado con la sesión del usuario.
 *
 * Aquí centralizamos el guardado del token para:
 * - no repetir lógica
 * - no tocar SecureStore desde muchas pantallas
 * - mantener el proyecto más limpio
 */

/*
 * Guarda el token de sesión en almacenamiento cifrado.
 */
export const guardarToken = async (token: string) => {
    await SecureStore.setItemAsync(CLAVE_TOKEN, token);
};

/*
 * Devuelve el token guardado si existe.
 * Si no existe, devuelve null.
 */
export const obtenerToken = async () => {
    const token = await SecureStore.getItemAsync(CLAVE_TOKEN);
    return token;
};

/*
 * Elimina el token guardado.
 * Se usará al cerrar sesión.
 */
export const borrarToken = async () => {
    await SecureStore.deleteItemAsync(CLAVE_TOKEN);
};

// =========================================================
// REFRESH TOKEN
// =========================================================

/*
 * Guarda el refresh token en almacenamiento cifrado.
 */
export const guardarRefreshToken = async (token: string) => {
    await SecureStore.setItemAsync(CLAVE_REFRESH_TOKEN, token);
};

/*
 * Devuelve el refresh token guardado si existe.
 * Si no existe, devuelve null.
 */
export const obtenerRefreshToken = async () => {
    const token = await SecureStore.getItemAsync(CLAVE_REFRESH_TOKEN);
    return token;
};

/*
 * Elimina el refresh token guardado.
 * Se usará al cerrar sesión o cuando el refresh falle.
 */
export const borrarRefreshToken = async () => {
    await SecureStore.deleteItemAsync(CLAVE_REFRESH_TOKEN);
};
