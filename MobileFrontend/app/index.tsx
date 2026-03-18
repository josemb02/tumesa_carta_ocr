import { useEffect, useRef } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { usarAuth } from "../contexto/ContextoAuth";

export default function Index() {
    const { usuario, cargando } = usarAuth();
    const router = useRouter();
    const redirigido = useRef(false);

    // Redirección cuando cargando termine
    useEffect(() => {
        if (cargando) return;
        if (redirigido.current) return;
        redirigido.current = true;

        if (usuario) {
            router.replace("/(principal)/mapa");
        } else {
            router.replace("/login");
        }
    }, [cargando, usuario]);

    // Fallback: si pasan 3 segundos y sigue cargando, manda a login
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (redirigido.current) return;
            redirigido.current = true;
            router.replace("/login");
        }, 3000);

        return () => clearTimeout(timeout);
    }, []);

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