import { useState } from "react";
import {
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
    Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { API_URL } from "../utils/constantes";
import { useT } from "../i18n";

export default function ResetPassword() {
    const router = useRouter();
    const t = useT();
    const { token } = useLocalSearchParams<{ token: string }>();
    const [password, setPassword] = useState("");
    const [passwordRepetida, setPasswordRepetida] = useState("");
    const [cargando, setCargando] = useState(false);

    const manejarReset = async () => {
        if (!token) {
            Alert.alert(t("general.error"), t("reset.error_enlace"));
            return;
        }
        if (password.length < 8) {
            Alert.alert(t("general.error"), t("reset.error_corta"));
            return;
        }
        if (password !== passwordRepetida) {
            Alert.alert(t("general.error"), t("reset.error_coincide"));
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
                Alert.alert(t("general.error"), data.detail || t("reset.error_expirado"));
                return;
            }
            Alert.alert(t("reset.exito_titulo"), t("reset.exito_sub"), [
                { text: t("general.ok"), onPress: () => router.replace("/login") }
            ]);
        } catch {
            Alert.alert(t("general.error"), t("reset.error_red"));
        } finally {
            setCargando(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
                <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                    <Text style={styles.titulo}>{t("reset.titulo")}</Text>
                    <Text style={styles.subtitulo}>{t("reset.subtitulo")}</Text>
                    <View style={styles.campo}>
                        <Text style={styles.label}>{t("reset.nueva_password")}</Text>
                        <TextInput
                            value={password}
                            onChangeText={setPassword}
                            placeholder={t("reset.nueva_placeholder")}
                            placeholderTextColor="#8A8A8A"
                            secureTextEntry
                            autoCapitalize="none"
                            style={styles.input}
                        />
                    </View>
                    <View style={styles.campo}>
                        <Text style={styles.label}>{t("reset.repetir_password")}</Text>
                        <TextInput
                            value={passwordRepetida}
                            onChangeText={setPasswordRepetida}
                            placeholder={t("reset.repetir_placeholder")}
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
                        {cargando
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.textoBoton}>{t("reset.guardar")}</Text>
                        }
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
