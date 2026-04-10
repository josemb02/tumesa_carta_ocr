// servicios/admob.ts
// Gestiona la carga y visualización del anuncio recompensado de AdMob.
//
// FLUJO SSV (Server-Side Verification):
// 1. El usuario pulsa "Ver vídeo" → se muestra el anuncio
// 2. El usuario completa el vídeo → AdMob llama directamente al backend
//    vía SSV callback con firma criptográfica verificada
// 3. El backend verifica la firma y suma los puntos
// 4. El frontend refresca los puntos del usuario llamando a /auth/me/stats

import { Platform } from "react-native";
import {
    RewardedAd,
    RewardedAdEventType,
    TestIds,
    AdEventType,
} from "react-native-google-mobile-ads";

// ID real según plataforma, ID de prueba en desarrollo
const AD_UNIT_ID = __DEV__
    ? TestIds.REWARDED
    : Platform.OS === "ios"
        ? "ca-app-pub-6211707002961230/6608941884"
        : "ca-app-pub-6211707002961230/8100940770";

let rewardedAd: RewardedAd | null = null;

/**
 * Precarga el anuncio recompensado para que esté listo al instante.
 * Llamar al montar la pantalla de tienda.
 * Devuelve función de limpieza para el useEffect.
 */
export function precargarAnuncioRecompensado(): () => void {
    rewardedAd = RewardedAd.createForAdRequest(AD_UNIT_ID, {
        requestNonPersonalizedAdsOnly: true,
    });

    const limpiarCargado = rewardedAd.addAdEventListener(
        RewardedAdEventType.LOADED,
        () => console.log("[AdMob] Anuncio recompensado listo")
    );

    const limpiarError = rewardedAd.addAdEventListener(
        AdEventType.ERROR,
        (error) => console.warn("[AdMob] Error cargando anuncio:", error)
    );

    rewardedAd.load();

    return () => {
        limpiarCargado();
        limpiarError();
    };
}

/**
 * Muestra el anuncio recompensado.
 * Cuando el usuario completa el vídeo, AdMob llama automáticamente
 * al backend vía SSV para verificar y sumar los puntos.
 * El frontend solo necesita saber que el usuario completó el vídeo
 * para refrescar los puntos desde la API.
 *
 * @returns Promise que resuelve true si el usuario completó el vídeo
 */
export async function mostrarAnuncioRecompensado(): Promise<boolean> {
    return new Promise((resolve, reject) => {
        if (!rewardedAd) {
            reject(new Error("Anuncio no cargado"));
            return;
        }

        // El usuario completó el vídeo — AdMob se encarga del SSV al backend
        const limpiarRecompensa = rewardedAd!.addAdEventListener(
            RewardedAdEventType.EARNED_REWARD,
            () => {
                limpiarRecompensa();
                resolve(true);
            }
        );

        // El usuario cerró el anuncio sin completarlo
        const limpiarCerrado = rewardedAd!.addAdEventListener(
            AdEventType.CLOSED,
            () => {
                limpiarCerrado();
                resolve(false);
            }
        );

        rewardedAd!.show().catch(reject);
    });
}
