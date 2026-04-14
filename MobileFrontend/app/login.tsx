import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from "react-native";
import { Link, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { Ionicons } from "@expo/vector-icons";
import { usarAuth } from "../contexto/ContextoAuth";
import { useT } from "../i18n";

// Necesario para que el navegador de OAuth cierre correctamente
WebBrowser.maybeCompleteAuthSession();

function mensajeAmigable(e: any, t: (key: string) => string): string {
    const raw = (e?.message ?? "").toLowerCase();
    if (raw.includes("network request failed") || raw.includes("failed to fetch") || raw.includes("network error")) {
        return t("login.error_red");
    }
    if (raw.includes("credencial") || raw.includes("inválid") || raw.includes("invalid") || raw.includes("incorrect")) {
        return t("login.error_credenciales");
    }
    return e?.message || t("login.error_generico");
}

export default function Login() {
    const router = useRouter();
    const t = useT();
    const { iniciarSesion, iniciarSesionConGoogle } = usarAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [cargando, setCargando] = useState(false);
    const [cargandoGoogle, setCargandoGoogle] = useState(false);
    const [mostrarPassword, setMostrarPassword] = useState(false);

    const [request, response, promptAsync] = Google.useAuthRequest({
        webClientId: "126657591225-eligeh84bvbs0hdrid4v6nn8v66fqcn0.apps.googleusercontent.com",
        androidClientId: "126657591225-au0kosadco1ppoo9sjk2b3b0gvtdcmc3.apps.googleusercontent.com",
        iosClientId: "126657591225-f6j99vupp2hoksup43athsb5ncqrdu64.apps.googleusercontent.com",
    });

    // Procesar respuesta de Google cuando vuelve el flujo OAuth
    useEffect(() => {
        if (response?.type !== "success") return;

        const idToken = response.params?.id_token;
        if (!idToken) {
            Alert.alert(t("general.error"), t("login.error_google"));
            return;
        }

        (async () => {
            try {
                setCargandoGoogle(true);
                await iniciarSesionConGoogle(idToken);
                router.replace("/(principal)/mapa");
            } catch (error: any) {
                Alert.alert(t("general.error"), mensajeAmigable(error, t));
            } finally {
                setCargandoGoogle(false);
            }
        })();
    }, [response]);

    const manejarLogin = async () => {
        const emailLimpio = email.trim();
        const passwordLimpia = password.trim();

        if (emailLimpio === "" || passwordLimpia === "") {
            Alert.alert(t("general.error"), t("login.error_campos"));
            return;
        }

        try {
            setCargando(true);
            await iniciarSesion(emailLimpio, passwordLimpia);
            router.replace("/mapa" as never);
        } catch (error: any) {
            Alert.alert(t("general.error"), mensajeAmigable(error, t));
        } finally {
            setCargando(false);
        }
    };

    const manejarLoginGoogle = () => {
        promptAsync();
    };

    const ocupado = cargando || cargandoGoogle;

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                style={styles.keyboard}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                {/* ScrollView para que pantallas pequeñas no corten el contenido */}
                <ScrollView
                    contentContainerStyle={styles.scroll}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.bloqueSuperior}>
                        <Image
                            source={require("../assets/imagenes/BeerNow_marca_Logo.png")}
                            style={styles.logo}
                            resizeMode="contain"
                        />

                        <Text style={styles.titulo}>{t("login.titulo")}</Text>

                        <Text style={styles.subtitulo}>{t("login.subtitulo")}</Text>
                    </View>

                    <View style={styles.tarjeta}>
                        <View style={styles.bloqueCampo}>
                            <Text style={styles.label}>{t("login.email")}</Text>
                            <TextInput
                                value={email}
                                onChangeText={setEmail}
                                placeholder={t("login.email_placeholder")}
                                placeholderTextColor="#8A8A8A"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                style={styles.input}
                            />
                        </View>

                        <View style={styles.bloqueCampo}>
                            <Text style={styles.label}>{t("login.password")}</Text>
                            {/* Wrapper relativo para posicionar el ojo sobre el input */}
                            <View style={styles.inputConBoton}>
                                <TextInput
                                    value={password}
                                    onChangeText={setPassword}
                                    placeholder={t("login.password_placeholder")}
                                    placeholderTextColor="#8A8A8A"
                                    secureTextEntry={!mostrarPassword}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    style={[styles.input, styles.inputFlex]}
                                />
                                <Pressable
                                    onPress={() => setMostrarPassword(!mostrarPassword)}
                                    style={styles.botonOjo}
                                    hitSlop={8}
                                >
                                    <Ionicons
                                        name={mostrarPassword ? "eye-off" : "eye"}
                                        size={20}
                                        color="#10233E"
                                    />
                                </Pressable>
                            </View>
                        </View>

                        {/* Enlace de recuperación de contraseña */}
                        <Pressable
                            style={styles.olvidaste}
                            onPress={() => router.push("/recuperar-password" as never)}
                        >
                            <Text style={styles.olvidasteTexto}>{t("login.olvidaste")}</Text>
                        </Pressable>

                        <Pressable
                            style={({ pressed }) => [
                                styles.boton,
                                ocupado ? styles.botonDeshabilitado : null,
                                pressed ? styles.botonPulsado : null
                            ]}
                            onPress={manejarLogin}
                            disabled={ocupado}
                        >
                            {cargando ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.textoBoton}>{t("login.entrar")}</Text>
                            )}
                        </Pressable>

                        {/* Separador */}
                        <View style={styles.separador}>
                            <View style={styles.separadorLinea} />
                            <Text style={styles.separadorTexto}>o</Text>
                            <View style={styles.separadorLinea} />
                        </View>

                        {/* Botón Google */}
                        <Pressable
                            style={({ pressed }) => [
                                styles.botonGoogle,
                                ocupado ? styles.botonDeshabilitado : null,
                                pressed ? styles.botonGooglePulsado : null
                            ]}
                            onPress={manejarLoginGoogle}
                            disabled={ocupado || !request}
                        >
                            {cargandoGoogle ? (
                                <ActivityIndicator color="#10233E" />
                            ) : (
                                <>
                                    {/* "G" con los colores reales de Google */}
                                    <Text style={styles.logoGoogle}>
                                        <Text style={{ color: "#4285F4" }}>G</Text>
                                        <Text style={{ color: "#EA4335" }}>o</Text>
                                        <Text style={{ color: "#FBBC05" }}>o</Text>
                                        <Text style={{ color: "#4285F4" }}>g</Text>
                                        <Text style={{ color: "#34A853" }}>l</Text>
                                        <Text style={{ color: "#EA4335" }}>e</Text>
                                    </Text>
                                    <Text style={styles.textoBotonGoogle}>{t("login.continuar_google")}</Text>
                                </>
                            )}
                        </Pressable>

                        <View style={styles.bloqueRegistro}>
                            <Text style={styles.textoSecundario}>{t("login.no_cuenta")} </Text>
                            <Link href="/registro" asChild>
                                <Pressable>
                                    <Text style={styles.enlace}>{t("login.crear_cuenta")}</Text>
                                </Pressable>
                            </Link>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: "#F7F4EC" },
    keyboard: { flex: 1 },
    // flexGrow+justifyContent centra el contenido cuando cabe en pantalla,
    // y permite scroll cuando no cabe (p.ej. iPhone SE con teclado abierto)
    scroll: {
        flexGrow: 1,
        justifyContent: "center",
        paddingHorizontal: 24,
        paddingVertical: 40
    },
    bloqueSuperior: { alignItems: "center", marginBottom: 28 },
    logo: { width: 220, height: 130, marginBottom: 12 },
    titulo: { fontSize: 28, fontWeight: "700", color: "#10233E", marginBottom: 8, letterSpacing: -0.5 },
    subtitulo: {
        fontSize: 14, color: "#6B85A8", textAlign: "center",
        lineHeight: 20, paddingHorizontal: 8
    },
    tarjeta: {
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        padding: 22,
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3
    },
    bloqueCampo: { marginBottom: 16 },
    label: { fontSize: 14, fontWeight: "600", color: "#10233E", marginBottom: 8 },
    input: {
        height: 52, borderWidth: 1, borderColor: "#E2E8F0",
        borderRadius: 12, paddingHorizontal: 14,
        fontSize: 15, color: "#10233E", backgroundColor: "#F8F9FB"
    },
    // Contenedor relativo para superponer el icono de ojo
    inputConBoton: { flexDirection: "row", alignItems: "center" },
    inputFlex: { flex: 1 },
    botonOjo: {
        position: "absolute", right: 14,
        height: 52, justifyContent: "center", paddingHorizontal: 4
    },
    // Enlace "¿Olvidaste tu contraseña?" alineado a la derecha
    olvidaste: { alignSelf: "flex-end", marginTop: -4, marginBottom: 16 },
    olvidasteTexto: { fontSize: 13, color: "#6B85A8", fontWeight: "500" },
    boton: {
        height: 54, backgroundColor: "#10233E", borderRadius: 12,
        justifyContent: "center", alignItems: "center"
    },
    botonDeshabilitado: { opacity: 0.65 },
    botonPulsado: { opacity: 0.85 },
    textoBoton: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },

    separador: {
        flexDirection: "row", alignItems: "center",
        marginVertical: 16, gap: 10
    },
    separadorLinea: { flex: 1, height: 1, backgroundColor: "#E8EBF0" },
    separadorTexto: { fontSize: 13, color: "#9AAABB", fontWeight: "500" },

    botonGoogle: {
        height: 54, backgroundColor: "#FFFFFF",
        borderRadius: 12, borderWidth: 1, borderColor: "#D8DEE8",
        flexDirection: "row", justifyContent: "center", alignItems: "center",
        gap: 10
    },
    botonGooglePulsado: { backgroundColor: "#F5F5F5" },
    logoGoogle: { fontSize: 17, fontWeight: "700" },
    textoBotonGoogle: { fontSize: 15, fontWeight: "600", color: "#10233E" },

    bloqueRegistro: {
        marginTop: 20, flexDirection: "row",
        justifyContent: "center", alignItems: "center"
    },
    textoSecundario: { fontSize: 14, color: "#5E6877", marginRight: 6 },
    enlace: { fontSize: 14, fontWeight: "700", color: "#10233E" }
});
