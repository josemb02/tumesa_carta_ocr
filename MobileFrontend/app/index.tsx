import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { usarAuth } from "../contexto/ContextoAuth";

/*
 * Esta pantalla es la puerta de entrada real de la app.
 *
 * Qué hace:
 * - espera a que el contexto termine de comprobar si había sesión guardada
 * - si el usuario ya tiene sesión, lo manda a la zona principal
 * - si no tiene sesión, lo manda a login
 */
export default function Index() {
    const auth = usarAuth();
    const router = useRouter();

    const usuario = auth.usuario;
    const cargando = auth.cargando;

    useEffect(() => {
        if (cargando) {
            return;
        }
        if (usuario) {
            router.replace("/(principal)/mapa" as never);
        } else {
            router.replace("/login" as never);
        }
    }, [cargando, usuario]);

    return (
        <View style={styles.contenedor}>
            <ActivityIndicator size="large" color="#10233E" />
        </View>
    );
}

const styles = StyleSheet.create({
    contenedor: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#F7F4EC"
    }
});