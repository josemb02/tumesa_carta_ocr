import { useState } from "react";
import {
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
    Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View
} from "react-native";
import { useRouter } from "expo-router";
import { API_URL } from "../utils/constantes";

export default function RecuperarPassword() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [cargando, setCargando] = useState(false);
    const [enviado, setEnviado] = useState(false);

    const manejarEnvio = async () => {
        const emailLimpio = email.trim().toLowerCase();
        if (!emailLimpio) {
            Alert.alert("Error", "Introduce tu email");
            return;
        }
        try {
            setCargando(true);
            const res = await fetch(`${API_URL}/auth/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: emailLimpio }),
            });
            if (res.status === 429) {
                Alert.alert(
                    "Demasiados intentos",
                    "Has solicitado demasiados enlaces seguidos. Espera 1 hora antes de volver a intentarlo."
                );
                return;
            }
            setEnviado(true);
        } catch (error: any) {
            if (error?.status === 429 || (typeof error?.message === 'string' && error.message.includes('429'))) {
                Alert.alert(
                    "Demasiados intentos",
                    "Has solicitado demasiados enlaces seguidos. Espera 1 hora antes de volver a intentarlo."
                );
            } else {
                Alert.alert("Error", "Sin conexión. Comprueba tu internet");
            }
        } finally {
            setCargando(false);
        }
    };

    if (enviado) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.centrado}>
                    <Text style={styles.emoji}>📬</Text>
                    <Text style={styles.titulo}>Revisa tu email</Text>
                    <Text style={styles.subtitulo}>
                        Si el email está registrado recibirás un enlace para restablecer tu contraseña.
                        El enlace caduca en 1 hora.
                    </Text>
                    <Pressable style={styles.boton} onPress={() => router.back()}>
                        <Text style={styles.textoBoton}>Volver al login</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
                <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                    <Pressable style={styles.volver} onPress={() => router.back()}>
                        <Text style={styles.volverTexto}>← Volver</Text>
                    </Pressable>
                    <Text style={styles.titulo}>¿Olvidaste tu contraseña?</Text>
                    <Text style={styles.subtitulo}>
                        Introduce tu email y te enviaremos un enlace para restablecerla.
                    </Text>
                    <View style={styles.campo}>
                        <Text style={styles.label}>Email</Text>
                        <TextInput
                            value={email}
                            onChangeText={setEmail}
                            placeholder="Tu email"
                            placeholderTextColor="#8A8A8A"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            style={styles.input}
                        />
                    </View>
                    <Pressable
                        style={[styles.boton, cargando && styles.botonDeshabilitado]}
                        onPress={manejarEnvio}
                        disabled={cargando}
                    >
                        {cargando ? <ActivityIndicator color="#fff" /> : <Text style={styles.textoBoton}>Enviar enlace</Text>}
                    </Pressable>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: "#F7F4EC" },
    scroll: { flexGrow: 1, padding: 24, paddingTop: 48 },
    centrado: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
    volver: { marginBottom: 32 },
    volverTexto: { fontSize: 15, color: "#6B85A8", fontWeight: "500" },
    emoji: { fontSize: 48, marginBottom: 16 },
    titulo: { fontSize: 26, fontWeight: "700", color: "#10233E", marginBottom: 12 },
    subtitulo: { fontSize: 15, color: "#6B85A8", lineHeight: 22, marginBottom: 32 },
    campo: { marginBottom: 20 },
    label: { fontSize: 14, fontWeight: "600", color: "#10233E", marginBottom: 8 },
    input: {
        height: 52, borderWidth: 1, borderColor: "#E2E8F0",
        borderRadius: 12, paddingHorizontal: 14,
        fontSize: 15, color: "#10233E", backgroundColor: "#F8F9FB"
    },
    boton: { height: 54, backgroundColor: "#10233E", borderRadius: 12, justifyContent: "center", alignItems: "center" },
    botonDeshabilitado: { opacity: 0.65 },
    textoBoton: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
