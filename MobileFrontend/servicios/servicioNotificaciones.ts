/**
 * servicioNotificaciones.ts
 *
 * Gestiona los permisos y el registro del token push de Expo.
 * Se llama una vez tras el login para que el backend pueda
 * enviar notificaciones a este dispositivo.
 */

import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { hacerPeticion } from "./api";

/**
 * Pide permisos, obtiene el token Expo y lo registra en el backend.
 *
 * Silencioso: si algo falla (simulador, permisos denegados, red)
 * simplemente no hace nada para no bloquear el login.
 */
export async function registrarTokenPush(token: string): Promise<void> {
    try {
        // Las notificaciones solo funcionan en dispositivos físicos
        if (!Device.isDevice) return;

        const { status: estadoActual } = await Notifications.getPermissionsAsync();
        let estadoFinal = estadoActual;

        if (estadoActual !== "granted") {
            const { status } = await Notifications.requestPermissionsAsync();
            estadoFinal = status;
        }

        if (estadoFinal !== "granted") return;

        const tokenPush = await Notifications.getExpoPushTokenAsync();

        await hacerPeticion("/notifications/register-token", {
            metodo: "POST",
            token,
            body: {
                push_token: tokenPush.data,
                platform: Platform.OS === "ios" ? "ios" : "android",
            },
        });
    } catch (e) {
        console.warn("[notificaciones] No se pudo registrar el token push:", e);
    }
}

/**
 * Configura cómo se muestran las notificaciones cuando la app
 * está en primer plano (se muestra banner, sonido y badge).
 *
 * Llamar una vez al arrancar la app (en _layout.tsx).
 */
export function configurarComportamientoNotificaciones(): void {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
        }),
    });
}
