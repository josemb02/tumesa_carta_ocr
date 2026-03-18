import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    View
} from "react-native";
import { Link, useRouter } from "expo-router";
import { usarAuth } from "../contexto/ContextoAuth";

/*
 * Esta pantalla se encarga del inicio de sesión del usuario.
 *
 * Qué hace:
 * - recoge email y contraseña
 * - valida que no estén vacíos
 * - llama al contexto de autenticación
 * - muestra estado de carga
 * - muestra error si algo falla
 *
 * Importante:
 * - aquí no se habla directamente con el backend
 * - toda la lógica real de auth está centralizada en ContextoAuth
 */
export default function Login() {
    const router = useRouter();
    const { iniciarSesion } = usarAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [cargando, setCargando] = useState(false);

    /*
     * Este método intenta iniciar sesión con los datos introducidos.
     */
    const manejarLogin = async () => {
        const emailLimpio = email.trim();
        const passwordLimpia = password.trim();

        if (emailLimpio === "" || passwordLimpia === "") {
            Alert.alert("Error", "Debes completar email y contraseña");
            return;
        }

        try {
            setCargando(true);

            await iniciarSesion(emailLimpio, passwordLimpia);

            /*
             * Si el login va bien, mandamos al usuario
             * a la zona principal de la app.
             */
            router.replace("/mapa" as never);
        } catch (error: any) {
            let mensaje = "No se ha podido iniciar sesión";

            if (error && error.message) {
                mensaje = error.message;
            }

            Alert.alert("Error", mensaje);
        } finally {
            setCargando(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                style={styles.keyboard}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <View style={styles.contenedor}>
                    <View style={styles.bloqueSuperior}>
                        <Image
                            source={require("../assets/imagenes/BeerMap_marca_Logo.png")}
                            style={styles.logo}
                            resizeMode="contain"
                        />

                        <Text style={styles.titulo}>Inicia sesión</Text>

                        <Text style={styles.subtitulo}>
                            Accede a tu mapa de cervezas, registra tus check-ins
                            y sigue sumando puntos con tus amigos.
                        </Text>
                    </View>

                    <View style={styles.tarjeta}>
                        <View style={styles.bloqueCampo}>
                            <Text style={styles.label}>Email</Text>

                            <TextInput
                                value={email}
                                onChangeText={setEmail}
                                placeholder="Introduce tu email"
                                placeholderTextColor="#8A8A8A"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                style={styles.input}
                            />
                        </View>

                        <View style={styles.bloqueCampo}>
                            <Text style={styles.label}>Contraseña</Text>

                            <TextInput
                                value={password}
                                onChangeText={setPassword}
                                placeholder="Introduce tu contraseña"
                                placeholderTextColor="#8A8A8A"
                                secureTextEntry={true}
                                autoCapitalize="none"
                                autoCorrect={false}
                                style={styles.input}
                            />
                        </View>

                        <Pressable
                            style={({ pressed }) => [
                                styles.boton,
                                cargando ? styles.botonDeshabilitado : null,
                                pressed ? styles.botonPulsado : null
                            ]}
                            onPress={manejarLogin}
                            disabled={cargando}
                        >
                            {cargando ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.textoBoton}>Entrar</Text>
                            )}
                        </Pressable>

                        <View style={styles.bloqueRegistro}>
                            <Text style={styles.textoSecundario}>
                                ¿No tienes cuenta?
                            </Text>

                            <Link href="/registro" asChild>
                                <Pressable>
                                    <Text style={styles.enlace}>
                                        Crear cuenta
                                    </Text>
                                </Pressable>
                            </Link>
                        </View>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: "#F7F4EC"
    },
    keyboard: {
        flex: 1
    },
    contenedor: {
        flex: 1,
        justifyContent: "center",
        paddingHorizontal: 24
    },
    bloqueSuperior: {
        alignItems: "center",
        marginBottom: 28
    },
    logo: {
        width: 240,
        height: 150,
        marginBottom: 10
    },
    titulo: {
        fontSize: 28,
        fontWeight: "700",
        color: "#10233E",
        marginBottom: 8
    },
    subtitulo: {
        fontSize: 15,
        color: "#4E5968",
        textAlign: "center",
        lineHeight: 22,
        paddingHorizontal: 10
    },
    tarjeta: {
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        padding: 20,
        shadowColor: "#000000",
        shadowOffset: {
            width: 0,
            height: 4
        },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 3
    },
    bloqueCampo: {
        marginBottom: 16
    },
    label: {
        fontSize: 14,
        fontWeight: "600",
        color: "#10233E",
        marginBottom: 8
    },
    input: {
        height: 52,
        borderWidth: 1,
        borderColor: "#D8DEE8",
        borderRadius: 12,
        paddingHorizontal: 14,
        fontSize: 15,
        color: "#10233E",
        backgroundColor: "#FFFFFF"
    },
    boton: {
        height: 54,
        backgroundColor: "#10233E",
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        marginTop: 8
    },
    botonDeshabilitado: {
        opacity: 0.7
    },
    botonPulsado: {
        opacity: 0.9
    },
    textoBoton: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "700"
    },
    bloqueRegistro: {
        marginTop: 18,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center"
    },
    textoSecundario: {
        fontSize: 14,
        color: "#5E6877",
        marginRight: 6
    },
    enlace: {
        fontSize: 14,
        fontWeight: "700",
        color: "#10233E"
    }
});