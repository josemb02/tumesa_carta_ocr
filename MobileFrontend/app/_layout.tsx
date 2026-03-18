import { Slot } from "expo-router";
import { ProveedorAuth } from "../contexto/ContextoAuth";

export default function RootLayout() {
    return (
        <ProveedorAuth>
            <Slot />
        </ProveedorAuth>
    );
}