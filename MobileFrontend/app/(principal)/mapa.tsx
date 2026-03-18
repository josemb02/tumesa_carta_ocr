import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
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

// ─────────────────────────────────────────────────────────────────────────────

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
        ? {
            latitude: Number(checkins[0].lat),
            longitude: Number(checkins[0].lng),
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }
        : { latitude: 40.4168, longitude: -3.7038, latitudeDelta: 0.5, longitudeDelta: 0.5 };

    return (
        <SafeAreaView style={s.root}>

            {/* ── Cabecera ── */}
            <View style={s.header}>
                <View>
                    <Text style={s.headerNombre}>{usuario?.username}</Text>
                    <Text style={s.headerSub}>Tu mapa de cervezas</Text>
                </View>
                <View style={s.headerPts}>
                    <Text style={s.headerPtsNum}>{checkins.length}</Text>
                    <Text style={s.headerPtsLabel}> pts</Text>
                </View>
            </View>

            {/* ── Stats ── */}
            <View style={s.statsRow}>
                <View style={s.statItem}>
                    <Text style={s.statNum}>{checkins.length}</Text>
                    <Text style={s.statLabel}>CERVEZAS</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.statItem}>
                    <Text style={s.statNum}>{totalGastado.toFixed(2)}€</Text>
                    <Text style={s.statLabel}>GASTADO</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.statItem}>
                    <Text style={s.statNum}>
                        {new Set(checkins.map(c => `${Number(c.lat).toFixed(2)},${Number(c.lng).toFixed(2)}`)).size}
                    </Text>
                    <Text style={s.statLabel}>LUGARES</Text>
                </View>
            </View>

            {/* ── Mapa ── */}
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
                                    <Text style={s.markerText}>🍺</Text>
                                </View>
                            </Marker>
                        ))}
                    </MapView>

                    {checkins.length === 0 && (
                        <View style={s.mapaEmpty}>
                            <Text style={s.mapaEmptyText}>Sin registros aún</Text>
                        </View>
                    )}
                </View>
            )}

            {/* ── FAB ── */}
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
    const [enviando, setEnviando] = useState(false);
    const [faseEnvio, setFaseEnvio] = useState("");

    useEffect(() => {
        if (visible && token) cargarGrupos();
    }, [visible]);

    async function cargarGrupos() {
        try {
            const datos = await hacerPeticion("/groups/my", { metodo: "GET", token });
            setGrupos(datos);
        } catch { setGrupos([]); }
    }

    async function enviar() {
        if (!token) return;
        setEnviando(true);
        try {
            setFaseEnvio("Obteniendo ubicación...");
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== "granted") {
                Alert.alert("Permiso denegado", "Necesitamos acceso a tu ubicación para registrar la cerveza.");
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
            onExito();
        } catch (e: any) {
            Alert.alert("Error", e?.message || "No se pudo registrar");
        } finally {
            setEnviando(false);
            setFaseEnvio("");
        }
    }

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={s.overlay}>
                <View style={s.sheet}>
                    <View style={s.handle} />
                    <View style={s.sheetHeader}>
                        <Text style={s.sheetTitulo}>Nueva cerveza</Text>
                        <Pressable onPress={onCerrar} disabled={enviando}>
                            <Ionicons name="close" size={22} color="#4E5968" />
                        </Pressable>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        <View style={s.ubicRow}>
                            <Ionicons name="location-outline" size={16} color="#6B85A8" />
                            <Text style={s.ubicTexto}>Se usará tu ubicación actual</Text>
                        </View>

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
                </View>
            </View>
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
    headerNombre: { fontSize: 20, fontWeight: "700", color: "#10233E", letterSpacing: -0.4 },
    headerSub: { fontSize: 12, color: "#6B85A8", marginTop: 2 },
    headerPts: { flexDirection: "row", alignItems: "baseline" },
    headerPtsNum: { fontSize: 20, fontWeight: "700", color: "#10233E" },
    headerPtsLabel: { fontSize: 13, color: "#6B85A8" },

    statsRow: {
        flexDirection: "row",
        marginHorizontal: 24,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: "#E2E8F0",
        paddingVertical: 14,
        marginBottom: 16,
    },
    statItem: { flex: 1, alignItems: "center" },
    statNum: { fontSize: 17, fontWeight: "700", color: "#10233E" },
    statLabel: { fontSize: 10, color: "#6B85A8", marginTop: 2, letterSpacing: 0.6 },
    statDivider: { width: 1, backgroundColor: "#E2E8F0" },

    mapaContenedor: { flex: 1, marginHorizontal: 16, marginBottom: 16, borderRadius: 16, overflow: "hidden" },
    mapa: { flex: 1 },
    mapaPlaceholder: { flex: 1, justifyContent: "center", alignItems: "center" },
    mapaEmpty: {
        position: "absolute",
        bottom: 16,
        left: 16,
        right: 16,
        backgroundColor: "rgba(255,255,255,0.92)",
        borderRadius: 10,
        padding: 12,
        alignItems: "center",
    },
    mapaEmptyText: { fontSize: 13, color: "#6B85A8" },

    marker: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "#FFFFFF",
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    markerText: { fontSize: 18 },

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
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 24,
        paddingTop: 12,
        maxHeight: "85%",
    },
    handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#D8DEE8", alignSelf: "center", marginBottom: 16 },
    sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
    sheetTitulo: { fontSize: 17, fontWeight: "700", color: "#10233E" },

    ubicRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 20 },
    ubicTexto: { fontSize: 13, color: "#6B85A8" },

    fieldLabel: { fontSize: 13, fontWeight: "600", color: "#10233E", marginBottom: 8, marginTop: 4 },
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
        height: 50,
        backgroundColor: "#10233E",
        borderRadius: 10,
        justifyContent: "center",
        alignItems: "center",
        marginTop: 8,
        marginBottom: 8,
    },
    btnDisabled: { opacity: 0.6 },
    btnPressed: { opacity: 0.85 },
    btnLabel: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});