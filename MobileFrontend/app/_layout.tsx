import { useEffect } from "react";
import { Slot, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { ProveedorAuth } from "../contexto/ContextoAuth";
import { configurarComportamientoNotificaciones } from "../servicios/servicioNotificaciones";
import { inicializarIdioma } from "../i18n";

// Comportamiento en primer plano (módulo, no componente)
configurarComportamientoNotificaciones();

/**
 * Escucha los taps en notificaciones y navega a la pantalla
 * correspondiente. Se monta dentro de ProveedorAuth para que
 * useRouter() tenga acceso al contexto de navegación.
 */
function GestorNotificaciones() {
    const router = useRouter();

    useEffect(() => {
        const suscripcion = Notifications.addNotificationResponseReceivedListener(
            (respuesta: Notifications.NotificationResponse) => {
                const datos = respuesta.notification.request.content.data as Record<string, string>;
                const tipo = datos?.tipo;

                if (tipo === "mensaje_grupo" || tipo === "nuevo_miembro") {
                    router.push("/(principal)/grupos");
                } else if (tipo === "superado") {
                    router.push("/(principal)/ranking");
                } else if (tipo === "cooldown") {
                    router.push("/(principal)/mapa");
                }
            }
        );

        return () => suscripcion.remove();
    }, []);

    return null;
}

export default function RootLayout() {
    // Inicializar idioma al arrancar: lee la preferencia guardada o detecta el sistema
    useEffect(() => {
        inicializarIdioma();
    }, []);

    return (
        <ProveedorAuth>
            <GestorNotificaciones />
            <Slot />
        </ProveedorAuth>
    );
}
