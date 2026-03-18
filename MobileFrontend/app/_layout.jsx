import { Slot } from "expo-router";
import { ProveedorAuth } from "../contexto/ContextoAuth";

/*
 * Este archivo es el layout raíz de toda la aplicación.
 *
 * Qué hace:
 * - envuelve toda la app con el provider de autenticación
 * - deja disponible el contexto auth en cualquier pantalla
 * - renderiza la ruta activa usando Slot
 */
export default function RootLayout() {
    return (
        <ProveedorAuth>
            <Slot />
        </ProveedorAuth>
    );
}