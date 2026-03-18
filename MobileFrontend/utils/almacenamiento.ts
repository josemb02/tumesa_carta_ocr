import AsyncStorage from "@react-native-async-storage/async-storage";
import { CLAVE_TOKEN } from "./constantes";

/*
 * Este archivo se encarga del almacenamiento local
 * relacionado con la sesión del usuario.
 *
 * Aquí centralizamos el guardado del token para:
 * - no repetir lógica
 * - no tocar AsyncStorage desde muchas pantallas
 * - mantener el proyecto más limpio
 */

/*
 * Guarda el token de sesión en almacenamiento local.
 */
export const guardarToken = async (token: string) => {
    await AsyncStorage.setItem(CLAVE_TOKEN, token);
};

/*
 * Devuelve el token guardado si existe.
 * Si no existe, devuelve null.
 */
export const obtenerToken = async () => {
    const token = await AsyncStorage.getItem(CLAVE_TOKEN);
    return token;
};

/*
 * Elimina el token guardado.
 * Se usará al cerrar sesión.
 */
export const borrarToken = async () => {
    await AsyncStorage.removeItem(CLAVE_TOKEN);
};