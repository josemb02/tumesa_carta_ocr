// servicios/admob.ts
// Gestiona la carga y visualización del anuncio recompensado de AdMob

import { Platform } from "react-native";
import {
    RewardedAd,
    RewardedAdEventType,
    TestIds,
    AdEventType,
} from "react-native-google-mobile-ads";
import { hacerPeticion } from "./peticion";

// ID real según plataforma, ID de prueba en desarrollo
const AD_UNIT_ID = __DEV__
    ? TestIds.REWARDED
    : Platform.OS === "ios"
        ? "ca-app-pub-6211707002961230/6608941884"
        : "ca-app-pub-6211707002961230/8100940770";

let rewardedAd: RewardedAd | null = null;

/**
 * Precarga el anuncio recompensado.
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
 * Muestra el anuncio y llama al backend para sumar los puntos al completarlo.
 */
export async function mostrarAnuncioRecompensado(
    token: string,
    userId: string
): Promise<{ puntosGanados: number; totalPuntos: number }> {
    return new Promise((resolve, reject) => {
        if (!rewardedAd) {
            reject(new Error("Anuncio no cargado"));
            return;
        }

        const limpiarRecompensa = rewardedAd!.addAdEventListener(
            RewardedAdEventType.EARNED_REWARD,
            async (reward) => {
                limpiarRecompensa();
                try {
                    const respuesta = await hacerPeticion("/rewards/video", {
                        metodo: "POST",
                        token,
                        body: {
                            key_id: "1",
                            signature: "dev",
                            user_id: userId,
                            reward_item: reward.type,
                            reward_amount: reward.amount,
                            transaction_id: `${userId}_${Date.now()}`,
                        },
                    });
                    resolve({
                        puntosGanados: respuesta.puntos_ganados,
                        totalPuntos: respuesta.total_puntos,
                    });
                } catch (error) {
                    reject(error);
                }
            }
        );

        rewardedAd!.show().catch(reject);
    });
}
