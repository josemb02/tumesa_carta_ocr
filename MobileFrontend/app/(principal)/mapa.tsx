import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import * as Location from "expo-location";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { usarAuth } from "../../contexto/ContextoAuth";
import { hacerPeticion } from "../../servicios/api";
import { obtenerMisIconos } from "../../servicios/servicioIconos";
import { AvatarCirculo } from "../../componentes/AvatarCirculo";

type CheckinMapa = {
    id: string;
    lat: number;
    lng: number;
    precio: number | null;
};

type Grupo = {
    id: string;
    name: string;
    join_code: string;
};

/*
 * Tipo para los iconos cargados desde el API.
 * Sustituye al array ICONOS hardcodeado.
 */
type IconoDisponible = {
    id: string;
    nombre: string;
    emoji: string;
    activo: boolean;
};


// ─── Estilo mapa mudo ─────────────────────────────────────────────────────────

const MAPA_ESTILO = [
    { elementType: "geometry",             stylers: [{ color: "#ebe8e0" }] },
    { elementType: "labels",               stylers: [{ visibility: "off" }] },
    { elementType: "labels.icon",          stylers: [{ visibility: "off" }] },
    { featureType: "administrative",       elementType: "geometry", stylers: [{ visibility: "off" }] },
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ visibility: "on" }, { color: "#8A9BB0" }] },
    { featureType: "administrative.locality", elementType: "labels.text.stroke", stylers: [{ color: "#ebe8e0" }] },
    { featureType: "poi",                  stylers: [{ visibility: "off" }] },
    { featureType: "road",                 elementType: "geometry", stylers: [{ color: "#ffffff" }] },
    { featureType: "road",                 elementType: "geometry.stroke", stylers: [{ color: "#ddd9d0" }] },
    { featureType: "road",                 elementType: "labels", stylers: [{ visibility: "off" }] },
    { featureType: "road.highway",         elementType: "geometry", stylers: [{ color: "#f0ece4" }] },
    { featureType: "transit",              stylers: [{ visibility: "off" }] },
    { featureType: "water",                elementType: "geometry", stylers: [{ color: "#c5d5e8" }] },
    { featureType: "landscape.natural",    elementType: "geometry", stylers: [{ color: "#e4e0d8" }] },
];

export default function Mapa() {
    const { token, usuario } = usarAuth();
    const [checkins, setCheckins] = useState<CheckinMapa[]>([]);
    const [cargando, setCargando] = useState(true);
    const [modalCheckin, setModalCheckin] = useState(false);
    const [ubicacionActual, setUbicacionActual] = useState<{
        latitude: number;
        longitude: number;
    } | null>(null);

    useFocusEffect(
        useCallback(() => {
            cargarMapa();
            obtenerUbicacion();
        }, [token])
    );

    async function obtenerUbicacion() {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== "granted") return;
            const loc = await Location.getCurrentPositionAsync({});
            setUbicacionActual({
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
            });
        } catch {}
    }

    async function cargarMapa() {
        if (!token) return;
        try {
            setCargando(true);
            const datos = await hacerPeticion("/checkins/my-map", { metodo: "GET", token });
            setCheckins(datos);
        } catch {}
        finally { setCargando(false); }
    }

    const totalGastado = checkins
        .filter(c => c.precio !== null)
        .reduce((acc, c) => acc + Number(c.precio), 0);

    const region = ubicacionActual
        ? { ...ubicacionActual, latitudeDelta: 0.05, longitudeDelta: 0.05 }
        : checkins.length > 0
        ? { latitude: Number(checkins[0].lat), longitude: Number(checkins[0].lng), latitudeDelta: 0.05, longitudeDelta: 0.05 }
        : { latitude: 40.4168, longitude: -3.7038, latitudeDelta: 0.5, longitudeDelta: 0.5 };

    return (
        <SafeAreaView style={s.root}>

            {/* Cabecera */}
            <View style={s.header}>
                <View style={s.headerUsuario}>
                    <AvatarCirculo
                        uri={usuario?.avatar_url}
                        username={usuario?.username ?? "?"}
                        size={36}
                        colorFondo="#10233E"
                        colorTexto="#FFFFFF"
                    />
                    <View>
                        <Text style={s.headerNombre}>{usuario?.username}</Text>
                        <Text style={s.headerSub}>Tu mapa de cervezas</Text>
                    </View>
                </View>
                <View style={s.headerPts}>
                    <Text style={s.headerPtsNum}>{checkins.length}</Text>
                    <Text style={s.headerPtsLabel}> pts</Text>
                </View>
            </View>

            {/* Stats */}
            <View style={s.statsRow}>
                <View style={s.statItem}>
                    <Text style={s.statNum}>{checkins.length}</Text>
                    <Text style={s.statLabel}>cervezas</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.statItem}>
                    <Text style={s.statNum}>{totalGastado.toFixed(2)}<Text style={s.statNumSuffix}>€</Text></Text>
                    <Text style={s.statLabel}>gastado</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.statItem}>
                    <Text style={s.statNum}>
                        {new Set(checkins.map(c => `${Number(c.lat).toFixed(2)},${Number(c.lng).toFixed(2)}`)).size}
                    </Text>
                    <Text style={s.statLabel}>lugares</Text>
                </View>
            </View>

            {/* Mapa */}
            {cargando ? (
                <View style={s.mapaPlaceholder}>
                    <ActivityIndicator color="#10233E" />
                </View>
            ) : (
                <View style={s.mapaContenedor}>
                    <MapView
                        style={s.mapa}
                        provider={PROVIDER_DEFAULT}
                        initialRegion={region}
                        showsUserLocation
                        showsMyLocationButton={false}
                        showsPointsOfInterest={false}
                        showsBuildings={false}
                        showsTraffic={false}
                        customMapStyle={MAPA_ESTILO}
                    >
                        {checkins.map((c, i) => (
                            <Marker
                                key={c.id}
                                coordinate={{
                                    latitude: Number(c.lat),
                                    longitude: Number(c.lng),
                                }}
                                title={`Cerveza #${i + 1}`}
                                description={c.precio ? `${Number(c.precio).toFixed(2)}€` : undefined}
                            >
                                <View style={s.marker}>
                                    <Text style={s.markerEmoji}>🍺</Text>
                                </View>
                            </Marker>
                        ))}
                    </MapView>
                </View>
            )}

            {/* FAB */}
            <Pressable
                style={({ pressed }) => [s.fab, pressed && s.fabPressed]}
                onPress={() => setModalCheckin(true)}
            >
                <Ionicons name="add" size={28} color="#FFFFFF" />
            </Pressable>

            <ModalCheckin
                visible={modalCheckin}
                token={token}
                onCerrar={() => setModalCheckin(false)}
                onExito={() => { setModalCheckin(false); cargarMapa(); }}
            />
        </SafeAreaView>
    );
}

// ─── Modal check-in ───────────────────────────────────────────────────────────

function ModalCheckin({ visible, token, onCerrar, onExito }: {
    visible: boolean;
    token: string | null;
    onCerrar: () => void;
    onExito: () => void;
}) {
    const [precio, setPrecio] = useState("");
    const [nota, setNota] = useState("");
    const [grupos, setGrupos] = useState<Grupo[]>([]);
    const [grupoSeleccionado, setGrupoSeleccionado] = useState<string | null>(null);
    const [misIconos, setMisIconos] = useState<IconoDisponible[]>([]);
    const [iconoSeleccionado, setIconoSeleccionado] = useState<string | null>(null);
    const [enviando, setEnviando] = useState(false);
    const [faseEnvio, setFaseEnvio] = useState("");

    useEffect(() => {
        if (visible && token) {
            cargarGrupos();
            cargarIconos();
        }
    }, [visible]);

    async function cargarGrupos() {
        try {
            const datos = await hacerPeticion("/groups/my", { metodo: "GET", token });
            setGrupos(datos);
        } catch { setGrupos([]); }
    }

    /*
     * Carga los iconos que posee el usuario desde el backend.
     * Pre-selecciona el icono marcado como activo (si hay alguno).
     */
    async function cargarIconos() {
        try {
            const datos: IconoDisponible[] = await obtenerMisIconos(token!);
            setMisIconos(datos);
            // Pre-seleccionamos el icono activo, o el primero disponible
            const activo = datos.find(ic => ic.activo);
            setIconoSeleccionado(activo ? activo.id : (datos[0]?.id ?? null));
        } catch { setMisIconos([]); }
    }

    async function enviar() {
        if (!token) return;
        setEnviando(true);
        try {
            setFaseEnvio("Obteniendo ubicación...");
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== "granted") {
                Alert.alert("Permiso denegado", "Necesitamos acceso a tu ubicación.");
                setEnviando(false);
                return;
            }
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });

            setFaseEnvio("Registrando...");
            const body: any = {
                lat: loc.coords.latitude,
                lng: loc.coords.longitude,
            };

            if (precio.trim()) {
                const n = parseFloat(precio.replace(",", "."));
                if (isNaN(n) || n < 0) {
                    Alert.alert("Error", "Precio no válido");
                    setEnviando(false);
                    return;
                }
                body.precio = n;
            }
            if (nota.trim()) body.note = nota.trim();
            if (grupoSeleccionado) body.group_id = grupoSeleccionado;

            await hacerPeticion("/checkins", { metodo: "POST", token, body });

            setPrecio(""); setNota(""); setGrupoSeleccionado(null);
            // Restauramos al icono activo (o al primero de la lista)
            const activo = misIconos.find(ic => ic.activo);
            setIconoSeleccionado(activo ? activo.id : (misIconos[0]?.id ?? null));
            onExito();
        } catch (e: any) {
            Alert.alert("Error", e?.message || "No se pudo registrar");
        } finally {
            setEnviando(false);
            setFaseEnvio("");
        }
    }

    return (
        <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={0}
            >
                <Pressable style={s.overlay} onPress={onCerrar}>
                    <Pressable style={s.sheet} onPress={() => {}}>
                        <View style={s.handle} />

                        <View style={s.sheetHeader}>
                            <Text style={s.sheetTitulo}>Nueva cerveza</Text>
                            <Pressable onPress={onCerrar} disabled={enviando} style={s.closeBtn}>
                                <Ionicons name="close" size={20} color="#4E5968" />
                            </Pressable>
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            {/* Selector de icono — cargado desde el backend */}
                            {misIconos.length > 0 && (
                                <>
                                    <Text style={s.fieldLabel}>Elige tu icono</Text>
                                    <View style={s.iconosRow}>
                                        {misIconos.map(ic => (
                                            <Pressable
                                                key={ic.id}
                                                style={[s.iconoBtn, iconoSeleccionado === ic.id && s.iconoBtnActivo]}
                                                onPress={() => setIconoSeleccionado(ic.id)}
                                            >
                                                <Text style={s.iconoEmoji}>{ic.emoji}</Text>
                                                <Text style={[s.iconoLabel, iconoSeleccionado === ic.id && s.iconoLabelActivo]}>
                                                    {ic.nombre}
                                                </Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                </>
                            )}

                            {/* Precio */}
                            <Text style={s.fieldLabel}>Precio (opcional)</Text>
                            <View style={s.precioRow}>
                                <TextInput
                                    value={precio}
                                    onChangeText={setPrecio}
                                    placeholder="0.00"
                                    placeholderTextColor="#B0BAC8"
                                    keyboardType="decimal-pad"
                                    style={[s.input, { flex: 1 }]}
                                />
                                <Text style={s.euroSign}>€</Text>
                            </View>

                            {/* Nota */}
                            <Text style={s.fieldLabel}>Nota (opcional)</Text>
                            <TextInput
                                value={nota}
                                onChangeText={setNota}
                                placeholder="¿Qué cerveza es?"
                                placeholderTextColor="#B0BAC8"
                                maxLength={180}
                                multiline
                                style={[s.input, s.inputMulti]}
                            />

                            {/* Grupos */}
                            {grupos.length > 0 && (
                                <>
                                    <Text style={s.fieldLabel}>Asociar a grupo</Text>
                                    {grupos.map(g => (
                                        <Pressable
                                            key={g.id}
                                            style={[s.grupoRow, grupoSeleccionado === g.id && s.grupoRowActivo]}
                                            onPress={() => setGrupoSeleccionado(grupoSeleccionado === g.id ? null : g.id)}
                                        >
                                            <Text style={[s.grupoNombre, grupoSeleccionado === g.id && s.grupoNombreActivo]}>
                                                {g.name}
                                            </Text>
                                            {grupoSeleccionado === g.id &&
                                                <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                                        </Pressable>
                                    ))}
                                </>
                            )}

                            <Pressable
                                style={({ pressed }) => [s.btnPrimary, enviando && s.btnDisabled, pressed && s.btnPressed]}
                                onPress={enviar}
                                disabled={enviando}
                            >
                                {enviando
                                    ? <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                        <ActivityIndicator color="#fff" size="small" />
                                        <Text style={s.btnLabel}>{faseEnvio}</Text>
                                      </View>
                                    : <Text style={s.btnLabel}>Registrar</Text>
                                }
                            </Pressable>
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </KeyboardAvoidingView>
        </Modal>
    );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#F7F4EC" },

    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 16,
    },
    headerUsuario: { flexDirection: "row", alignItems: "center", gap: 10 },
    headerNombre: { fontSize: 20, fontWeight: "700", color: "#10233E", letterSpacing: -0.4 },
    headerSub: { fontSize: 12, color: "#6B85A8", marginTop: 2 },
    headerPts: { flexDirection: "row", alignItems: "baseline" },
    headerPtsNum: { fontSize: 20, fontWeight: "700", color: "#10233E" },
    headerPtsLabel: { fontSize: 13, color: "#6B85A8" },

    statsRow: {
        flexDirection: "row",
        marginHorizontal: 20,
        borderRadius: 14,
        backgroundColor: "#FFFFFF",
        paddingVertical: 16,
        marginBottom: 14,
        shadowColor: "#10233E",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    statItem: { flex: 1, alignItems: "center", gap: 2 },
    statNum: { fontSize: 22, fontWeight: "700", color: "#10233E", letterSpacing: -0.5 },
    statNumSuffix: { fontSize: 14, fontWeight: "500", color: "#6B85A8" },
    statLabel: { fontSize: 11, color: "#9AAABB", letterSpacing: 0.2 },
    statDivider: { width: 1, backgroundColor: "#E2E8F0", marginVertical: 4 },

    mapaContenedor: { flex: 1, marginHorizontal: 16, marginBottom: 16, borderRadius: 16, overflow: "hidden" },
    mapa: { flex: 1 },
    mapaPlaceholder: { flex: 1, justifyContent: "center", alignItems: "center" },

    marker: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: "#FFFFFF",
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 5,
        elevation: 5,
        borderWidth: 1.5,
        borderColor: "#E2E8F0",
    },
    markerEmoji: { fontSize: 22 },

    fab: {
        position: "absolute",
        bottom: 28,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: "#10233E",
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#10233E",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    fabPressed: { opacity: 0.8 },

    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
    sheet: {
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingTop: 12,
        maxHeight: "88%",
    },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E2E8F0", alignSelf: "center", marginBottom: 18 },
    sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
    sheetTitulo: { fontSize: 18, fontWeight: "700", color: "#10233E", letterSpacing: -0.3 },
    closeBtn: { padding: 4 },

    // Selector de icono
    iconosRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
    iconoBtn: {
        flex: 1,
        alignItems: "center",
        paddingVertical: 16,
        gap: 6,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: "#E2E8F0",
        backgroundColor: "#FAFAFA",
    },
    iconoBtnActivo: {
        borderColor: "#10233E",
        backgroundColor: "#10233E",
    },
    iconoEmoji: { fontSize: 22, marginBottom: 4 },
    iconoLabel: { fontSize: 11, fontWeight: "600", color: "#6B85A8" },
    iconoLabelActivo: { color: "#FFFFFF" },

    fieldLabel: { fontSize: 12, fontWeight: "600", color: "#6B85A8", marginBottom: 8, letterSpacing: 0.4, textTransform: "uppercase" },

    input: {
        height: 48,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 10,
        paddingHorizontal: 14,
        fontSize: 15,
        color: "#10233E",
        backgroundColor: "#FAFAFA",
        marginBottom: 16,
    },
    inputMulti: { height: 72, paddingTop: 12, textAlignVertical: "top" },
    precioRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
    euroSign: { fontSize: 16, color: "#6B85A8", marginLeft: 10, fontWeight: "500" },

    grupoRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
    },
    grupoRowActivo: { backgroundColor: "#10233E", borderColor: "#10233E" },
    grupoNombre: { fontSize: 14, color: "#10233E", fontWeight: "500" },
    grupoNombreActivo: { color: "#FFFFFF" },

    btnPrimary: {
        height: 52,
        backgroundColor: "#10233E",
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        marginTop: 8,
        marginBottom: 8,
    },
    btnDisabled: { opacity: 0.6 },
    btnPressed: { opacity: 0.85 },
    btnLabel: { color: "#FFFFFF", fontSize: 15, fontWeight: "700", letterSpacing: 0.2 },
});