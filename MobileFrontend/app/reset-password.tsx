import { useState } from "react";
import {
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
    Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { API_URL } from "../utils/constantes";

export default function ResetPassword() {
    const router = useRouter();
    const { token } = useLocalSearchParams<{ token: string }>();
    const [password, setPassword] = useState("");
    const [passwordRepetida, setPasswordRepetida] = useState("");
    const [cargando, setCargando] = useState(false);

    const manejarReset = async () => {
        if (!token) {
            Alert.alert("Error", "Enlace inválido");
            return;
        }
        if (password.length < 8) {
            Alert.alert("Error", "La contraseña debe tener al menos 8 caracteres");
            return;
        }
        if (password !== passwordRepetida) {
            Alert.alert("Error", "Las contraseñas no coinciden");
            return;
        }
        try {
            setCargando(true);
            const res = await fetch(`${API_URL}/auth/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password_nuevo: password }),
            });
            const data = await res.json();
            if (!res.ok) {
                Alert.alert("Error", data.detail || "Enlace inválido o expirado");
                return;
            }
            Alert.alert("Listo", "Contraseña actualizada. Ya puedes iniciar sesión.", [
                { text: "OK", onPress: () => router.replace("/login") }
            ]);
        } catch {
            Alert.alert("Error", "Sin conexión. Comprueba tu internet");
        } finally {
            setCargando(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
                <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                    <Text style={styles.titulo}>Nueva contraseña</Text>
                    <Text style={styles.subtitulo}>Elige una contraseña segura de al menos 8 caracteres.</Text>
                    <View style={styles.campo}>
                        <Text style={styles.label}>Nueva contraseña</Text>
                        <TextInput
                            value={password}
                            onChangeText={setPassword}
                            placeholder="Mínimo 8 caracteres"
                            placeholderTextColor="#8A8A8A"
                            secureTextEntry
                            autoCapitalize="none"
                            style={styles.input}
                        />
                    </View>
                    <View style={styles.campo}>
                        <Text style={styles.label}>Repetir contraseña</Text>
                        <TextInput
                            value={passwordRepetida}
                            onChangeText={setPasswordRepetida}
                            placeholder="Repite la contraseña"
                            placeholderTextColor="#8A8A8A"
                            secureTextEntry
                            autoCapitalize="none"
                            style={styles.input}
                        />
                    </View>
                    <Pressable
                        style={[styles.boton, cargando && styles.botonDeshabilitado]}
                        onPress={manejarReset}
                        disabled={cargando}
                    >
                        {cargando ? <ActivityIndicator color="#fff" /> : <Text style={styles.textoBoton}>Guardar contraseña</Text>}
                    </Pressable>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: "#F7F4EC" },
    scroll: { flexGrow: 1, padding: 24, paddingTop: 48 },
    titulo: { fontSize: 26, fontWeight: "700", color: "#10233E", marginBottom: 12 },
    subtitulo: { fontSize: 15, color: "#6B85A8", lineHeight: 22, marginBottom: 32 },
    campo: { marginBottom: 20 },
    label: { fontSize: 14, fontWeight: "600", color: "#10233E", marginBottom: 8 },
    input: {
        height: 52, borderWidth: 1, borderColor: "#E2E8F0",
        borderRadius: 12, paddingHorizontal: 14,
        fontSize: 15, color: "#10233E", backgroundColor: "#F8F9FB"
    },
    boton: { height: 54, backgroundColor: "#10233E", borderRadius: 12, justifyContent: "center", alignItems: "center", marginTop: 8 },
    botonDeshabilitado: { opacity: 0.65 },
    textoBoton: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
