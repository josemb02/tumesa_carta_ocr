import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Linking,
    Modal,
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
import { Ionicons } from "@expo/vector-icons";
import { usarAuth } from "../contexto/ContextoAuth";

// ─── Lista de países ──────────────────────────────────────────────────────────

const PAISES = [
    "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Argentina",
    "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain",
    "Bangladesh", "Belarus", "Belgium", "Belize", "Bolivia",
    "Bosnia and Herzegovina", "Botswana", "Brazil", "Bulgaria",
    "Cambodia", "Cameroon", "Canada", "Chile", "China", "Colombia",
    "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic",
    "Denmark", "Dominican Republic", "Ecuador", "Egypt", "El Salvador",
    "Estonia", "Ethiopia", "Finland", "France", "Georgia", "Germany",
    "Ghana", "Greece", "Guatemala", "Haiti", "Honduras", "Hungary",
    "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland",
    "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan",
    "Kenya", "Kuwait", "Latvia", "Lebanon", "Lithuania", "Luxembourg",
    "Madagascar", "Malaysia", "Mali", "Malta", "Mexico", "Moldova",
    "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique",
    "Myanmar", "Nepal", "Netherlands", "New Zealand", "Nicaragua",
    "Nigeria", "Norway", "Oman", "Pakistan", "Panama", "Paraguay",
    "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania",
    "Russia", "Rwanda", "Saudi Arabia", "Senegal", "Serbia",
    "Singapore", "Slovakia", "Slovenia", "Somalia", "South Africa",
    "South Korea", "España", "Sri Lanka", "Sweden", "Switzerland",
    "Syria", "Taiwan", "Tanzania", "Thailand", "Tunisia", "Turkey",
    "Ukraine", "United Arab Emirates", "United Kingdom", "United States",
    "Uruguay", "Venezuela", "Vietnam", "Yemen", "Zimbabwe"
].sort();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/*
 * Traduce errores técnicos del backend a mensajes en español natural.
 */
function mensajeAmigable(e: any): string {
    const raw = (e?.message ?? "").toLowerCase();
    if (raw.includes("network request failed") || raw.includes("failed to fetch") || raw.includes("network error")) {
        return "Sin conexión. Comprueba tu internet";
    }
    if (raw.includes("ya existe") || raw.includes("already") || raw.includes("duplicate")) {
        return "Este email ya está registrado";
    }
    return e?.message || "No se ha podido crear la cuenta";
}

function validarEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function formatearFecha(fecha: Date): string {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, "0");
    const d = String(fecha.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function formatearFechaVisible(fecha: Date): string {
    return fecha.toLocaleDateString("es-ES", {
        day: "2-digit", month: "long", year: "numeric"
    });
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Registro() {
    const router = useRouter();
    const { registrarNuevoUsuario } = usarAuth();

    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmarPassword, setConfirmarPassword] = useState("");
    const [pais, setPais] = useState("");
    const [ciudad, setCiudad] = useState("");
    const [fechaNacimiento, setFechaNacimiento] = useState<Date | null>(null);

    const [cargando, setCargando] = useState(false);
    const [mostrarPassword, setMostrarPassword] = useState(false);
    const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
    const [paso, setPaso] = useState<1 | 2>(1);
    const [modalPais, setModalPais] = useState(false);
    const [busquedaPais, setBusquedaPais] = useState("");
    const [modalFecha, setModalFecha] = useState(false);

    const hoy = new Date();
    const [fechaTemporal, setFechaTemporal] = useState({
        dia: hoy.getDate(),
        mes: hoy.getMonth() + 1,
        anio: hoy.getFullYear() - 20
    });

    const validarPaso1 = (): boolean => {
        const u = username.trim();
        if (u.length < 3 || u.length > 30) {
            Alert.alert("Error", "El username debe tener entre 3 y 30 caracteres");
            return false;
        }
        if (/\s/.test(u)) {
            Alert.alert("Error", "El username no puede contener espacios");
            return false;
        }
        if (!validarEmail(email.trim())) {
            Alert.alert("Error", "El email no tiene un formato válido");
            return false;
        }
        if (password.length < 8) {
            Alert.alert("Error", "La contraseña debe tener al menos 8 caracteres");
            return false;
        }
        if (password !== confirmarPassword) {
            Alert.alert("Error", "Las contraseñas no coinciden");
            return false;
        }
        return true;
    };

    const validarPaso2 = (): boolean => {
        if (!pais) {
            Alert.alert("Error", "Debes seleccionar un país");
            return false;
        }
        if (ciudad.trim().length < 2) {
            Alert.alert("Error", "Introduce tu ciudad");
            return false;
        }
        return true;
    };

    const confirmarFecha = () => {
        const { dia, mes, anio } = fechaTemporal;
        setFechaNacimiento(new Date(anio, mes - 1, dia));
        setModalFecha(false);
    };

    const manejarRegistro = async () => {
        if (!validarPaso2()) return;
        try {
            setCargando(true);
            await registrarNuevoUsuario(
                username.trim(),
                email.trim(),
                password,
                fechaNacimiento ? formatearFecha(fechaNacimiento) : undefined,
                pais,
                ciudad.trim()
            );
            router.replace("/(principal)/mapa");
        } catch (error: any) {
            Alert.alert("Error", mensajeAmigable(error));
        } finally {
            setCargando(false);
        }
    };

    const paisesFiltrados = PAISES.filter(p =>
        p.toLowerCase().includes(busquedaPais.toLowerCase())
    );

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
                    <View style={styles.cabecera}>
                        <Image
                            source={require("../assets/imagenes/BeerNow_marca_Logo.png")}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                        <Text style={styles.titulo}>Crea tu cuenta</Text>
                        <Text style={styles.subtitulo}>
                            Únete a BeerMap y empieza a registrar tus cervezas
                        </Text>
                    </View>

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

                    <View style={styles.tarjeta}>
                        {paso === 1 ? (
                            <>
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
                                        <Pressable onPress={() => setMostrarPassword(!mostrarPassword)} style={styles.botonOjo}>
                                            {mostrarPassword ? <Ionicons name="eye-off" size={20} color="#10233E" /> : <Ionicons name="eye" size={20} color="#10233E" />}
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
                                        <Pressable onPress={() => setMostrarConfirmar(!mostrarConfirmar)} style={styles.botonOjo}>
                                            {mostrarConfirmar ? <Ionicons name="eye-off" size={20} color="#10233E" /> : <Ionicons name="eye" size={20} color="#10233E" />}
                                        </Pressable>
                                    </View>
                                </Campo>

                                {password.length > 0 && <FuerzaPassword password={password} />}

                                <Pressable
                                    style={({ pressed }) => [styles.boton, pressed && styles.botonPulsado]}
                                    onPress={() => { if (validarPaso1()) setPaso(2); }}
                                >
                                    <Text style={styles.textoBoton}>Siguiente →</Text>
                                </Pressable>
                            </>
                        ) : (
                            <>
                                <Campo label="País *">
                                    <Pressable
                                        style={[styles.input, styles.selector]}
                                        onPress={() => setModalPais(true)}
                                    >
                                        <Text style={pais ? styles.selectorTexto : styles.selectorPlaceholder}>
                                            {pais || "Selecciona tu país"}
                                        </Text>
                                        <Text style={styles.selectorChevron}>▾</Text>
                                    </Pressable>
                                </Campo>

                                <Campo label="Ciudad *">
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
                                    <Pressable
                                        style={[styles.input, styles.selector]}
                                        onPress={() => setModalFecha(true)}
                                    >
                                        <Text style={fechaNacimiento ? styles.selectorTexto : styles.selectorPlaceholder}>
                                            {fechaNacimiento ? formatearFechaVisible(fechaNacimiento) : "Selecciona tu fecha"}
                                        </Text>
                                        <Text style={styles.selectorChevron}>▾</Text>
                                    </Pressable>
                                </Campo>

                                {/* Aviso legal obligatorio para stores */}
                                <View style={styles.avisoLegal}>
                                    <Text style={styles.avisoTexto}>
                                        Al registrarte aceptas los{" "}
                                    </Text>
                                    <Pressable onPress={() => Linking.openURL("https://beer-now.com/terminos.html")}>
                                        <Text style={[styles.avisoTexto, styles.avisoEnlace]}>Términos de uso</Text>
                                    </Pressable>
                                    <Text style={styles.avisoTexto}> y la </Text>
                                    <Pressable onPress={() => Linking.openURL("https://beer-now.com/privacidad.html")}>
                                        <Text style={[styles.avisoTexto, styles.avisoEnlace]}>Política de privacidad</Text>
                                    </Pressable>
                                </View>

                                <View style={styles.filaFinal}>
                                    <Pressable
                                        style={({ pressed }) => [styles.botonSecundario, pressed && styles.botonPulsado]}
                                        onPress={() => setPaso(1)}
                                        disabled={cargando}
                                    >
                                        <Text style={styles.textoBotonSecundario}>← Atrás</Text>
                                    </Pressable>

                                    <Pressable
                                        style={({ pressed }) => [
                                            styles.boton, styles.botonFlex,
                                            cargando && styles.botonDeshabilitado,
                                            pressed && styles.botonPulsado
                                        ]}
                                        onPress={manejarRegistro}
                                        disabled={cargando}
                                    >
                                        {cargando
                                            ? <ActivityIndicator color="#FFFFFF" />
                                            : <Text style={styles.textoBoton}>Crear cuenta 🍺</Text>
                                        }
                                    </Pressable>
                                </View>
                            </>
                        )}
                    </View>

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

            {/* Modal país */}
            <Modal visible={modalPais} animationType="slide" transparent>
                {/* KeyboardAvoidingView empuja el modal hacia arriba cuando
                    el teclado aparece, evitando que tape el buscador */}
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContenedor}>
                            <View style={styles.modalCabecera}>
                                <Text style={styles.modalTitulo}>Selecciona tu país</Text>
                                <Pressable onPress={() => { setModalPais(false); setBusquedaPais(""); }}>
                                    <Text style={styles.modalCerrar}>✕</Text>
                                </Pressable>
                            </View>
                            <TextInput
                                value={busquedaPais}
                                onChangeText={setBusquedaPais}
                                placeholder="Buscar país..."
                                placeholderTextColor="#8A8A8A"
                                style={styles.busquedaInput}
                                autoFocus
                            />
                            <FlatList
                                data={paisesFiltrados}
                                keyExtractor={(item) => item}
                                renderItem={({ item }) => (
                                    <Pressable
                                        style={({ pressed }) => [
                                            styles.itemPais,
                                            item === pais && styles.itemPaisSeleccionado,
                                            pressed && styles.itemPaisPulsado
                                        ]}
                                        onPress={() => {
                                            setPais(item);
                                            setBusquedaPais("");
                                            setModalPais(false);
                                        }}
                                    >
                                        <Text style={[styles.itemPaisTexto, item === pais && styles.itemPaisTextoSeleccionado]}>
                                            {item}
                                        </Text>
                                        {item === pais && <Text style={styles.checkmark}>✓</Text>}
                                    </Pressable>
                                )}
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={false}
                            />
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Modal fecha */}
            <Modal visible={modalFecha} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContenedor, styles.modalFechaContenedor]}>
                        <View style={styles.modalCabecera}>
                            <Text style={styles.modalTitulo}>Fecha de nacimiento</Text>
                            <Pressable onPress={() => setModalFecha(false)}>
                                <Text style={styles.modalCerrar}>✕</Text>
                            </Pressable>
                        </View>

                        <View style={styles.fechaFila}>
                            <View style={styles.fechaColumna}>
                                <Text style={styles.fechaEtiqueta}>Día</Text>
                                <ScrollView style={styles.fechaScroll} showsVerticalScrollIndicator={false}>
                                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                        <Pressable
                                            key={d}
                                            style={[styles.fechaItem, fechaTemporal.dia === d && styles.fechaItemActivo]}
                                            onPress={() => setFechaTemporal(f => ({ ...f, dia: d }))}
                                        >
                                            <Text style={[styles.fechaItemTexto, fechaTemporal.dia === d && styles.fechaItemTextoActivo]}>
                                                {String(d).padStart(2, "0")}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </ScrollView>
                            </View>

                            <View style={styles.fechaColumna}>
                                <Text style={styles.fechaEtiqueta}>Mes</Text>
                                <ScrollView style={styles.fechaScroll} showsVerticalScrollIndicator={false}>
                                    {["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"].map((m, i) => (
                                        <Pressable
                                            key={m}
                                            style={[styles.fechaItem, fechaTemporal.mes === i + 1 && styles.fechaItemActivo]}
                                            onPress={() => setFechaTemporal(f => ({ ...f, mes: i + 1 }))}
                                        >
                                            <Text style={[styles.fechaItemTexto, fechaTemporal.mes === i + 1 && styles.fechaItemTextoActivo]}>
                                                {m}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </ScrollView>
                            </View>

                            <View style={styles.fechaColumna}>
                                <Text style={styles.fechaEtiqueta}>Año</Text>
                                <ScrollView style={styles.fechaScroll} showsVerticalScrollIndicator={false}>
                                    {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - 10 - i).map(a => (
                                        <Pressable
                                            key={a}
                                            style={[styles.fechaItem, fechaTemporal.anio === a && styles.fechaItemActivo]}
                                            onPress={() => setFechaTemporal(f => ({ ...f, anio: a }))}
                                        >
                                            <Text style={[styles.fechaItemTexto, fechaTemporal.anio === a && styles.fechaItemTextoActivo]}>
                                                {a}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </ScrollView>
                            </View>
                        </View>

                        <Pressable style={[styles.boton, { marginTop: 16 }]} onPress={confirmarFecha}>
                            <Text style={styles.textoBoton}>Confirmar fecha</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <View style={styles.bloqueCampo}>
            <Text style={styles.label}>{label}</Text>
            {children}
        </View>
    );
}

function FuerzaPassword({ password }: { password: string }) {
    const calcular = () => {
        let p = 0;
        if (password.length >= 8) p++;
        if (password.length >= 12) p++;
        if (/[A-Z]/.test(password)) p++;
        if (/[0-9]/.test(password)) p++;
        if (/[^A-Za-z0-9]/.test(password)) p++;
        if (p <= 1) return { nivel: 1, texto: "Débil", color: "#E53E3E" };
        if (p <= 3) return { nivel: 2, texto: "Media", color: "#D69E2E" };
        return { nivel: 3, texto: "Fuerte", color: "#38A169" };
    };
    const { nivel, texto, color } = calcular();
    return (
        <View style={styles.fuerzaContenedor}>
            <View style={styles.fuerzaBarra}>
                {[1, 2, 3].map(i => (
                    <View key={i} style={[styles.fuerzaSegmento, { backgroundColor: i <= nivel ? color : "#D8DEE8" }]} />
                ))}
            </View>
            <Text style={[styles.fuerzaTexto, { color }]}>{texto}</Text>
        </View>
    );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: "#F7F4EC" },
    keyboard: { flex: 1 },
    scroll: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
    cabecera: { alignItems: "center", marginBottom: 24 },
    logo: { width: 200, height: 80, marginBottom: 12 },
    titulo: { fontSize: 26, fontWeight: "700", color: "#10233E", marginBottom: 6 },
    subtitulo: { fontSize: 14, color: "#4E5968", textAlign: "center", lineHeight: 20 },
    pasos: { marginBottom: 20 },
    filaPasos: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 8 },
    circuloPaso: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#D8DEE8", justifyContent: "center", alignItems: "center" },
    circuloActivo: { backgroundColor: "#10233E" },
    textoPaso: { fontSize: 14, fontWeight: "700", color: "#8A8A8A" },
    textoPasoActivo: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
    lineaPaso: { flex: 1, height: 2, backgroundColor: "#D8DEE8", marginHorizontal: 8, maxWidth: 80 },
    lineaActiva: { backgroundColor: "#10233E" },
    filaEtiquetas: { flexDirection: "row", justifyContent: "space-around" },
    etiquetaPaso: { fontSize: 12, color: "#4E5968", fontWeight: "600" },
    tarjeta: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3, marginBottom: 20 },
    bloqueCampo: { marginBottom: 16 },
    label: { fontSize: 14, fontWeight: "600", color: "#10233E", marginBottom: 8 },
    input: { height: 52, borderWidth: 1, borderColor: "#D8DEE8", borderRadius: 12, paddingHorizontal: 14, fontSize: 15, color: "#10233E", backgroundColor: "#FFFFFF" },
    inputConBoton: { flexDirection: "row", alignItems: "center" },
    inputFlex: { flex: 1 },
    botonOjo: { position: "absolute", right: 14, height: 52, justifyContent: "center", paddingHorizontal: 4 },
    iconoOjo: { fontSize: 20, color: "#10233E" },
    selector: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    selectorTexto: { fontSize: 15, color: "#10233E" },
    selectorPlaceholder: { fontSize: 15, color: "#8A8A8A" },
    selectorChevron: { fontSize: 16, color: "#4E5968" },
    fuerzaContenedor: { flexDirection: "row", alignItems: "center", marginTop: -8, marginBottom: 16, gap: 10 },
    fuerzaBarra: { flexDirection: "row", gap: 4, flex: 1 },
    fuerzaSegmento: { flex: 1, height: 4, borderRadius: 2 },
    fuerzaTexto: { fontSize: 12, fontWeight: "700", minWidth: 44 },
    boton: { height: 54, backgroundColor: "#10233E", borderRadius: 12, justifyContent: "center", alignItems: "center", marginTop: 4 },
    botonFlex: { flex: 1, marginLeft: 10 },
    botonDeshabilitado: { opacity: 0.7 },
    botonPulsado: { opacity: 0.85 },
    textoBoton: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
    botonSecundario: { height: 54, borderWidth: 1.5, borderColor: "#10233E", borderRadius: 12, justifyContent: "center", alignItems: "center", paddingHorizontal: 18, marginTop: 4 },
    textoBotonSecundario: { color: "#10233E", fontSize: 15, fontWeight: "700" },
    filaFinal: { flexDirection: "row", alignItems: "center", marginTop: 4 },
    bloqueLogin: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
    textoSecundario: { fontSize: 14, color: "#5E6877" },
    enlace: { fontSize: 14, fontWeight: "700", color: "#10233E" },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalContenedor: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "80%" },
    modalFechaContenedor: { maxHeight: "72%" },
    modalCabecera: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
    modalTitulo: { fontSize: 18, fontWeight: "700", color: "#10233E" },
    modalCerrar: { fontSize: 18, color: "#4E5968", padding: 4 },
    busquedaInput: { height: 44, borderWidth: 1, borderColor: "#D8DEE8", borderRadius: 10, paddingHorizontal: 12, fontSize: 15, color: "#10233E", marginBottom: 12 },
    itemPais: { paddingVertical: 14, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: "#F0F0F0", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    itemPaisSeleccionado: { backgroundColor: "#F0F4FF" },
    itemPaisPulsado: { backgroundColor: "#F7F4EC" },
    itemPaisTexto: { fontSize: 15, color: "#10233E" },
    itemPaisTextoSeleccionado: { fontWeight: "700" },
    checkmark: { fontSize: 16, color: "#10233E" },
    fechaFila: { flexDirection: "row", gap: 8, marginBottom: 8 },
    fechaColumna: { flex: 1 },
    fechaEtiqueta: { fontSize: 13, fontWeight: "600", color: "#4E5968", textAlign: "center", marginBottom: 8 },
    fechaScroll: { height: 200, borderWidth: 1, borderColor: "#D8DEE8", borderRadius: 10 },
    fechaItem: { paddingVertical: 10, alignItems: "center" },
    fechaItemActivo: { backgroundColor: "#10233E", borderRadius: 8, marginHorizontal: 4 },
    fechaItemTexto: { fontSize: 15, color: "#10233E" },
    fechaItemTextoActivo: { color: "#FFFFFF", fontWeight: "700" },
    avisoLegal: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "center",
        marginBottom: 16,
        paddingHorizontal: 8,
    },
    avisoTexto: {
        fontSize: 12,
        color: "#6B85A8",
        lineHeight: 18,
    },
    avisoEnlace: {
        fontWeight: "700",
    },
});