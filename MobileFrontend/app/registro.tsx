import { useState } from "react";
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
import { usarAuth } from "../contexto/ContextoAuth";

/*
 * Pantalla de registro de BeerMap.
 *
 * Campos:
 * - username (3-30 chars, sin espacios)
 * - email (formato válido)
 * - password (mínimo 8 chars)
 * - confirmar password
 * - fecha de nacimiento (YYYY-MM-DD)
 * - país (2-80 chars)
 * - ciudad (2-80 chars)
 *
 * Seguridad aplicada en cliente:
 * - validación de todos los campos antes de llamar al backend
 * - password nunca se muestra en claro por defecto
 * - se verifica que las dos passwords coincidan
 * - se limitan longitudes según el schema del backend
 * - el backend ya aplica rate limiting, hashing y audit logs
 */

// ─── Helpers de validación ───────────────────────────────────────────────────

function validarEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function validarFecha(fecha: string): boolean {
    if (!fecha) return true; // campo opcional
    return /^\d{4}-\d{2}-\d{2}$/.test(fecha.trim());
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function Registro() {
    const router = useRouter();
    const { registrarNuevoUsuario } = usarAuth();

    // Campos del formulario
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmarPassword, setConfirmarPassword] = useState("");
    const [fechaNacimiento, setFechaNacimiento] = useState("");
    const [pais, setPais] = useState("");
    const [ciudad, setCiudad] = useState("");

    // UI
    const [cargando, setCargando] = useState(false);
    const [mostrarPassword, setMostrarPassword] = useState(false);
    const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
    const [paso, setPaso] = useState<1 | 2>(1); // registro en 2 pasos

    // ─── Validación paso 1 ────────────────────────────────────────────────────

    const validarPaso1 = (): boolean => {
        const u = username.trim();
        const e = email.trim();
        const p = password;
        const c = confirmarPassword;

        if (u.length < 3 || u.length > 30) {
            Alert.alert("Error", "El nombre de usuario debe tener entre 3 y 30 caracteres");
            return false;
        }

        if (/\s/.test(u)) {
            Alert.alert("Error", "El nombre de usuario no puede contener espacios");
            return false;
        }

        if (!validarEmail(e)) {
            Alert.alert("Error", "El email no tiene un formato válido");
            return false;
        }

        if (p.length < 8 || p.length > 128) {
            Alert.alert("Error", "La contraseña debe tener entre 8 y 128 caracteres");
            return false;
        }

        if (p !== c) {
            Alert.alert("Error", "Las contraseñas no coinciden");
            return false;
        }

        return true;
    };

    // ─── Validación paso 2 ────────────────────────────────────────────────────

    const validarPaso2 = (): boolean => {
        const p = pais.trim();
        const c = ciudad.trim();
        const f = fechaNacimiento.trim();

        if (p.length < 2 || p.length > 80) {
            Alert.alert("Error", "El país debe tener entre 2 y 80 caracteres");
            return false;
        }

        if (c.length < 2 || c.length > 80) {
            Alert.alert("Error", "La ciudad debe tener entre 2 y 80 caracteres");
            return false;
        }

        if (f && !validarFecha(f)) {
            Alert.alert("Error", "La fecha debe tener el formato AAAA-MM-DD");
            return false;
        }

        return true;
    };

    // ─── Avanzar al paso 2 ────────────────────────────────────────────────────

    const manejarSiguiente = () => {
        if (validarPaso1()) {
            setPaso(2);
        }
    };

    // ─── Envío final ──────────────────────────────────────────────────────────

    const manejarRegistro = async () => {
        if (!validarPaso2()) return;

        try {
            setCargando(true);

            await registrarNuevoUsuario(
                username.trim(),
                email.trim(),
                password,
                fechaNacimiento.trim() || undefined,
                pais.trim(),
                ciudad.trim()
            );

            // El contexto ya hace login automático tras el registro
            router.replace("/mapa" as never);
        } catch (error: any) {
            let mensaje = "No se ha podido crear la cuenta";
            if (error?.message) {
                mensaje = error.message;
            }
            Alert.alert("Error", mensaje);
        } finally {
            setCargando(false);
        }
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                style={styles.keyboard}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.scroll}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* ── Cabecera ── */}
                    <View style={styles.cabecera}>
                        <Image
                            source={require("../assets/imagenes/BeerMap_marca_Logo.png")}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                        <Text style={styles.titulo}>Crea tu cuenta</Text>
                        <Text style={styles.subtitulo}>
                            Únete a BeerMap y empieza a registrar tus cervezas
                        </Text>
                    </View>

                    {/* ── Indicador de pasos ── */}
                    <View style={styles.pasos}>
                        <View style={styles.filaPasos}>
                            <View style={[styles.circuloPaso, styles.circuloActivo]}>
                                <Text style={styles.textoPasoActivo}>1</Text>
                            </View>
                            <View style={[styles.lineaPaso, paso === 2 && styles.lineaActiva]} />
                            <View style={[styles.circuloPaso, paso === 2 && styles.circuloActivo]}>
                                <Text style={[styles.textoPaso, paso === 2 && styles.textoPasoActivo]}>2</Text>
                            </View>
                        </View>
                        <View style={styles.filaEtiquetas}>
                            <Text style={styles.etiquetaPaso}>Tu cuenta</Text>
                            <Text style={styles.etiquetaPaso}>Tu perfil</Text>
                        </View>
                    </View>

                    {/* ── Tarjeta formulario ── */}
                    <View style={styles.tarjeta}>

                        {paso === 1 ? (
                            <>
                                {/* PASO 1: credenciales */}
                                <Campo label="Nombre de usuario">
                                    <TextInput
                                        value={username}
                                        onChangeText={setUsername}
                                        placeholder="ej: hopmaster99"
                                        placeholderTextColor="#8A8A8A"
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        maxLength={30}
                                        style={styles.input}
                                    />
                                </Campo>

                                <Campo label="Email">
                                    <TextInput
                                        value={email}
                                        onChangeText={setEmail}
                                        placeholder="tu@email.com"
                                        placeholderTextColor="#8A8A8A"
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        style={styles.input}
                                    />
                                </Campo>

                                <Campo label="Contraseña">
                                    <View style={styles.inputConBoton}>
                                        <TextInput
                                            value={password}
                                            onChangeText={setPassword}
                                            placeholder="Mínimo 8 caracteres"
                                            placeholderTextColor="#8A8A8A"
                                            secureTextEntry={!mostrarPassword}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                            maxLength={128}
                                            style={[styles.input, styles.inputFlex]}
                                        />
                                        <Pressable
                                            onPress={() => setMostrarPassword(!mostrarPassword)}
                                            style={styles.botonOjo}
                                        >
                                            <Text style={styles.iconoOjo}>
                                                {mostrarPassword ? "🙈" : "👁️"}
                                            </Text>
                                        </Pressable>
                                    </View>
                                </Campo>

                                <Campo label="Confirmar contraseña">
                                    <View style={styles.inputConBoton}>
                                        <TextInput
                                            value={confirmarPassword}
                                            onChangeText={setConfirmarPassword}
                                            placeholder="Repite la contraseña"
                                            placeholderTextColor="#8A8A8A"
                                            secureTextEntry={!mostrarConfirmar}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                            maxLength={128}
                                            style={[styles.input, styles.inputFlex]}
                                        />
                                        <Pressable
                                            onPress={() => setMostrarConfirmar(!mostrarConfirmar)}
                                            style={styles.botonOjo}
                                        >
                                            <Text style={styles.iconoOjo}>
                                                {mostrarConfirmar ? "🙈" : "👁️"}
                                            </Text>
                                        </Pressable>
                                    </View>
                                </Campo>

                                {/* Indicador de fuerza de contraseña */}
                                {password.length > 0 && (
                                    <FuerzaPassword password={password} />
                                )}

                                <Pressable
                                    style={({ pressed }) => [
                                        styles.boton,
                                        pressed && styles.botonPulsado
                                    ]}
                                    onPress={manejarSiguiente}
                                >
                                    <Text style={styles.textoBoton}>Siguiente →</Text>
                                </Pressable>
                            </>
                        ) : (
                            <>
                                {/* PASO 2: perfil */}
                                <Campo label="País" requerido>
                                    <TextInput
                                        value={pais}
                                        onChangeText={setPais}
                                        placeholder="ej: España"
                                        placeholderTextColor="#8A8A8A"
                                        autoCorrect={false}
                                        maxLength={80}
                                        style={styles.input}
                                    />
                                </Campo>

                                <Campo label="Ciudad" requerido>
                                    <TextInput
                                        value={ciudad}
                                        onChangeText={setCiudad}
                                        placeholder="ej: Sevilla"
                                        placeholderTextColor="#8A8A8A"
                                        autoCorrect={false}
                                        maxLength={80}
                                        style={styles.input}
                                    />
                                </Campo>

                                <Campo label="Fecha de nacimiento (opcional)">
                                    <TextInput
                                        value={fechaNacimiento}
                                        onChangeText={setFechaNacimiento}
                                        placeholder="AAAA-MM-DD"
                                        placeholderTextColor="#8A8A8A"
                                        keyboardType="numeric"
                                        maxLength={10}
                                        style={styles.input}
                                    />
                                </Campo>

                                <View style={styles.filaFinal}>
                                    <Pressable
                                        style={({ pressed }) => [
                                            styles.botonSecundario,
                                            pressed && styles.botonPulsado
                                        ]}
                                        onPress={() => setPaso(1)}
                                        disabled={cargando}
                                    >
                                        <Text style={styles.textoBotonSecundario}>← Atrás</Text>
                                    </Pressable>

                                    <Pressable
                                        style={({ pressed }) => [
                                            styles.boton,
                                            styles.botonFlex,
                                            cargando && styles.botonDeshabilitado,
                                            pressed && styles.botonPulsado
                                        ]}
                                        onPress={manejarRegistro}
                                        disabled={cargando}
                                    >
                                        {cargando ? (
                                            <ActivityIndicator color="#FFFFFF" />
                                        ) : (
                                            <Text style={styles.textoBoton}>Crear cuenta 🍺</Text>
                                        )}
                                    </Pressable>
                                </View>
                            </>
                        )}
                    </View>

                    {/* ── Enlace a login ── */}
                    <View style={styles.bloqueLogin}>
                        <Text style={styles.textoSecundario}>¿Ya tienes cuenta? </Text>
                        <Link href="/login" asChild>
                            <Pressable>
                                <Text style={styles.enlace}>Inicia sesión</Text>
                            </Pressable>
                        </Link>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

// ─── Subcomponente: Campo ────────────────────────────────────────────────────

function Campo({
    label,
    requerido,
    children
}: {
    label: string;
    requerido?: boolean;
    children: React.ReactNode;
}) {
    return (
        <View style={styles.bloqueCampo}>
            <Text style={styles.label}>
                {label}
                {requerido && <Text style={styles.asterisco}> *</Text>}
            </Text>
            {children}
        </View>
    );
}

// ─── Subcomponente: FuerzaPassword ──────────────────────────────────────────

function FuerzaPassword({ password }: { password: string }) {
    const calcularFuerza = (): { nivel: number; texto: string; color: string } => {
        let puntos = 0;
        if (password.length >= 8) puntos++;
        if (password.length >= 12) puntos++;
        if (/[A-Z]/.test(password)) puntos++;
        if (/[0-9]/.test(password)) puntos++;
        if (/[^A-Za-z0-9]/.test(password)) puntos++;

        if (puntos <= 1) return { nivel: 1, texto: "Débil", color: "#E53E3E" };
        if (puntos <= 3) return { nivel: 2, texto: "Media", color: "#D69E2E" };
        return { nivel: 3, texto: "Fuerte", color: "#38A169" };
    };

    const { nivel, texto, color } = calcularFuerza();

    return (
        <View style={styles.fuerzaContenedor}>
            <View style={styles.fuerzaBarra}>
                {[1, 2, 3].map((i) => (
                    <View
                        key={i}
                        style={[
                            styles.fuerzaSegmento,
                            { backgroundColor: i <= nivel ? color : "#D8DEE8" }
                        ]}
                    />
                ))}
            </View>
            <Text style={[styles.fuerzaTexto, { color }]}>{texto}</Text>
        </View>
    );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: "#F7F4EC"
    },
    keyboard: {
        flex: 1
    },
    scroll: {
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 40
    },

    // Cabecera
    cabecera: {
        alignItems: "center",
        marginBottom: 24
    },
    logo: {
        width: 200,
        height: 80,
        marginBottom: 12
    },
    titulo: {
        fontSize: 26,
        fontWeight: "700",
        color: "#10233E",
        marginBottom: 6
    },
    subtitulo: {
        fontSize: 14,
        color: "#4E5968",
        textAlign: "center",
        lineHeight: 20
    },

    // Indicador de pasos
    pasos: {
        marginBottom: 20
    },
    filaPasos: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 8
    },
    circuloPaso: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "#D8DEE8",
        justifyContent: "center",
        alignItems: "center"
    },
    circuloActivo: {
        backgroundColor: "#10233E"
    },
    textoPaso: {
        fontSize: 14,
        fontWeight: "700",
        color: "#8A8A8A"
    },
    textoPasoActivo: {
        fontSize: 14,
        fontWeight: "700",
        color: "#FFFFFF"
    },
    lineaPaso: {
        flex: 1,
        height: 2,
        backgroundColor: "#D8DEE8",
        marginHorizontal: 8,
        maxWidth: 80
    },
    lineaActiva: {
        backgroundColor: "#10233E"
    },
    filaEtiquetas: {
        flexDirection: "row",
        justifyContent: "space-around"
    },
    etiquetaPaso: {
        fontSize: 12,
        color: "#4E5968",
        fontWeight: "600"
    },

    // Tarjeta
    tarjeta: {
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        padding: 20,
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 3,
        marginBottom: 20
    },

    // Campos
    bloqueCampo: {
        marginBottom: 16
    },
    label: {
        fontSize: 14,
        fontWeight: "600",
        color: "#10233E",
        marginBottom: 8
    },
    asterisco: {
        color: "#E53E3E"
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
    inputConBoton: {
        flexDirection: "row",
        alignItems: "center"
    },
    inputFlex: {
        flex: 1
    },
    botonOjo: {
        position: "absolute",
        right: 14,
        height: 52,
        justifyContent: "center"
    },
    iconoOjo: {
        fontSize: 18
    },

    // Fuerza de contraseña
    fuerzaContenedor: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: -8,
        marginBottom: 16,
        gap: 10
    },
    fuerzaBarra: {
        flexDirection: "row",
        gap: 4,
        flex: 1
    },
    fuerzaSegmento: {
        flex: 1,
        height: 4,
        borderRadius: 2
    },
    fuerzaTexto: {
        fontSize: 12,
        fontWeight: "700",
        minWidth: 44
    },

    // Botones
    boton: {
        height: 54,
        backgroundColor: "#10233E",
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        marginTop: 4
    },
    botonFlex: {
        flex: 1,
        marginLeft: 10
    },
    botonDeshabilitado: {
        opacity: 0.7
    },
    botonPulsado: {
        opacity: 0.85
    },
    textoBoton: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "700"
    },
    botonSecundario: {
        height: 54,
        borderWidth: 1.5,
        borderColor: "#10233E",
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 18,
        marginTop: 4
    },
    textoBotonSecundario: {
        color: "#10233E",
        fontSize: 15,
        fontWeight: "700"
    },
    filaFinal: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 4
    },

    // Enlace login
    bloqueLogin: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center"
    },
    textoSecundario: {
        fontSize: 14,
        color: "#5E6877"
    },
    enlace: {
        fontSize: 14,
        fontWeight: "700",
        color: "#10233E"
    }
});