import { View, Text, StyleSheet } from "react-native";

/*
 * Pantalla temporal de registro.
 *
 * Se deja simple para comprobar que Expo Router
 * reconoce bien la ruta y el export por defecto.
 */
export default function Registro() {
    return (
        <View style={styles.contenedor}>
            <Text style={styles.texto}>Pantalla registro</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    contenedor: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#F7F4EC"
    },
    texto: {
        fontSize: 18,
        color: "#10233E",
        fontWeight: "600"
    }
});