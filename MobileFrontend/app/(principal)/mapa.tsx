import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import * as Location from "expo-location";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { usarAuth } from "../../contexto/ContextoAuth";
import { hacerPeticion } from "../../servicios/api";
import { obtenerMisRachas } from "../../servicios/servicioAuth";
import { obtenerMisIconos } from "../../servicios/servicioIconos";
import { AvatarCirculo } from "../../componentes/AvatarCirculo";

type CheckinMapa = {
    id: string;
    lat: number;
    lng: number;
    precio: number | null;
    note: string | null;
    foto_url: string | null;
    icon_emoji: string | null;
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


// ─── Mensajes de error amigables ─────────────────────────────────────────────

/*
 * Convierte errores técnicos de la API en mensajes comprensibles para el usuario.
 * Compara el texto del error con patrones conocidos y devuelve el texto amigable.
 */
function mensajeAmigable(e: any): string {
    const raw = (e?.message ?? "").toLowerCase();
    if (raw.includes("network request failed") || raw.includes("failed to fetch") || raw.includes("network error")) {
        return "Sin conexión. Comprueba tu internet";
    }
    if (raw.includes("esperar") || raw.includes("cooldown") || raw.includes("check-in")) {
        return "Espera 5 minutos entre cervezas 🍺";
    }
    return e?.message || "Algo ha ido mal. Inténtalo de nuevo";
}

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
    // Racha actual del usuario (0 si no hay racha viva)
    const [rachaActual, setRachaActual] = useState(0);
    // Check-in seleccionado al pulsar un marker → abre el modal de detalle
    const [checkinSeleccionado, setCheckinSeleccionado] = useState<CheckinMapa | null>(null);

    useFocusEffect(
        useCallback(() => {
            cargarMapa();
            obtenerUbicacion();
            cargarRacha();
        }, [token])
    );

    async function cargarRacha() {
        if (!token) return;
        try {
            const datos = await obtenerMisRachas(token);
            setRachaActual(datos.racha_actual ?? 0);
        } catch {
            // Fallo silencioso: el badge simplemente no se muestra
        }
    }

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
        } catch (e: any) {
            console.error("[Mapa] Error al cargar check-ins:", e?.message);
            // Solo alertamos si es un error de autenticación — en cualquier otro caso
            // mostramos el mapa vacío para que el botón "Registrar cerveza" siga funcionando.
            const esAuth = (e?.message ?? "").toLowerCase().includes("sesión expirada");
            if (esAuth) {
                Alert.alert("Sesión expirada", "Inicia sesión de nuevo");
            } else {
                // Cargamos lista vacía silenciosamente; el usuario puede registrar igualmente
                setCheckins([]);
            }
        } finally {
            setCargando(false);
        }
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
                        {rachaActual >= 3 ? (
                            <Text style={s.headerSub}>🔥 {rachaActual} días de racha</Text>
                        ) : (
                            <Text style={s.headerSub}>Tu mapa de cervezas</Text>
                        )}
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

            {/* Mapa — ocupa todo el espacio restante */}
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
                        {checkins.map((c) => (
                            // Sin title/description para que el onPress no compita
                            // con el callout nativo de iOS
                            <Marker
                                key={c.id}
                                coordinate={{
                                    latitude: Number(c.lat),
                                    longitude: Number(c.lng),
                                }}
                                onPress={() => setCheckinSeleccionado(c)}
                                tracksViewChanges={false}
                            >
                                <View style={s.marker}>
                                    {/* Usamos el emoji guardado; 🍺 como fallback */}
                                    <Text style={s.markerEmoji}>
                                        {c.icon_emoji ?? "🍺"}
                                    </Text>
                                    {/* Punto naranja si el check-in tiene foto */}
                                    {c.foto_url && (
                                        <View style={s.markerFotoBadge} />
                                    )}
                                </View>
                            </Marker>
                        ))}
                    </MapView>

                    {/* Botón "Registrar cerveza" flotando sobre el mapa en la parte inferior */}
                    <Pressable
                        style={({ pressed }) => [s.btnRegistrar, pressed && s.btnPressed]}
                        onPress={() => setModalCheckin(true)}
                    >
                        <Text style={s.btnRegistrarTexto}>Registrar cerveza</Text>
                    </Pressable>
                </View>
            )}

            <ModalCheckin
                visible={modalCheckin}
                token={token}
                onCerrar={() => setModalCheckin(false)}
                onExito={() => { setModalCheckin(false); cargarMapa(); }}
            />

            {/* Modal de detalle: se abre al pulsar un marker */}
            <ModalDetalle
                checkin={checkinSeleccionado}
                onCerrar={() => setCheckinSeleccionado(null)}
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
    const [misIconos, setMisIconos] = useState<IconoDisponible[]>([]);
    const [iconoSeleccionado, setIconoSeleccionado] = useState<string | null>(null);
    const [enviando, setEnviando] = useState(false);
    const [faseEnvio, setFaseEnvio] = useState("");

    useEffect(() => {
        if (visible && token) {
            cargarIconos();
        }
    }, [visible]);

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
                // Mensaje motivador en vez del técnico "Permiso denegado"
                Alert.alert("GPS desactivado", "Activa el GPS para registrar tu cerveza");
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

            // Siempre enviamos el emoji del icono seleccionado.
            // Si la carga de iconos falló y no hay selección, usamos 🍺 como fallback
            // para que el marcador en el mapa siempre muestre algo coherente.
            const ic = iconoSeleccionado ? misIconos.find(x => x.id === iconoSeleccionado) : null;
            body.icon_emoji = ic?.emoji ?? "🍺";

            console.log("[Checkin] body:", JSON.stringify(body));
            await hacerPeticion("/checkins", { metodo: "POST", token, body });

            // Vibración corta de éxito al registrar la cerveza
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            setPrecio(""); setNota("");
            // Restauramos al icono activo (o al primero de la lista)
            const activo = misIconos.find(ic => ic.activo);
            setIconoSeleccionado(activo ? activo.id : (misIconos[0]?.id ?? null));
            onExito();
        } catch (e: any) {
            // Mostramos el detalle exacto del backend para poder diagnosticar
            Alert.alert("Error al registrar", `${mensajeAmigable(e)}\n\nIntenta de nuevo`);
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

// ─── Modal detalle de check-in ────────────────────────────────────────────────

/*
 * Se muestra al pulsar un marker en el mapa.
 * Enseña la foto (si la tiene), el precio y la nota del check-in.
 */
function ModalDetalle({
    checkin,
    onCerrar,
}: {
    checkin: CheckinMapa | null;
    onCerrar: () => void;
}) {
    if (!checkin) return null;

    const tieneFoto   = !!checkin.foto_url;
    const tienePrecio = checkin.precio !== null;
    const tieneNota   = !!checkin.note;

    return (
        <Modal
            visible={!!checkin}
            animationType="slide"
            transparent
            onRequestClose={onCerrar}
            statusBarTranslucent
        >
            <Pressable style={s.overlay} onPress={onCerrar}>
                {/* stopPropagation: evita que el tap dentro del sheet lo cierre */}
                <Pressable style={s.sheet} onPress={() => {}}>
                    <View style={s.handle} />

                    <View style={s.sheetHeader}>
                        <Text style={s.sheetTitulo}>🍺 Detalle</Text>
                        <Pressable onPress={onCerrar} style={s.closeBtn}>
                            <Ionicons name="close" size={20} color="#4E5968" />
                        </Pressable>
                    </View>

                    {/* Foto del check-in */}
                    {tieneFoto && (
                        <Image
                            source={{ uri: checkin.foto_url! }}
                            style={s.detalleFoto}
                            resizeMode="cover"
                        />
                    )}

                    {/* Precio y nota */}
                    {(tienePrecio || tieneNota) && (
                        <View style={s.detalleInfo}>
                            {tienePrecio && (
                                <View style={s.detalleFilaPrecio}>
                                    <Ionicons name="cash-outline" size={16} color="#6B85A8" />
                                    <Text style={s.detallePrecio}>
                                        {Number(checkin.precio).toFixed(2)} €
                                    </Text>
                                </View>
                            )}
                            {tieneNota && (
                                <Text style={s.detalleNota}>{checkin.note}</Text>
                            )}
                        </View>
                    )}

                    {/* Mensaje cuando no hay info extra */}
                    {!tieneFoto && !tienePrecio && !tieneNota && (
                        <Text style={s.detalleSinInfo}>Sin información adicional</Text>
                    )}
                </Pressable>
            </Pressable>
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

    // El contenedor ocupa todo el espacio disponible y aplica el border radius al mapa
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
    // Punto naranja en la esquina del marker si tiene foto
    markerFotoBadge: {
        position: "absolute", top: 2, right: 2,
        width: 8, height: 8, borderRadius: 4,
        backgroundColor: "#F6AD55",
        borderWidth: 1, borderColor: "#FFFFFF",
    },

    // Botón flotante sobre el mapa — posición absoluta en la esquina inferior
    // Ligera transparencia para que no tape tanto el mapa debajo
    btnRegistrar: {
        position: "absolute",
        bottom: 16,
        left: 16,
        right: 16,
        height: 52,
        backgroundColor: "rgba(16, 35, 62, 0.78)",
        borderRadius: 14,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 10,
    },
    btnRegistrarTexto: { color: "#FFFFFF", fontSize: 15, fontWeight: "700", letterSpacing: 0.2 },

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

    // ── Modal detalle de check-in ──────────────────────────────────────────────
    detalleFoto: {
        width: "100%",
        height: 200,
        borderRadius: 12,
        backgroundColor: "#E2E8F0",
        marginBottom: 16,
    },
    detalleInfo: {
        gap: 10,
        marginBottom: 8,
    },
    detalleFilaPrecio: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    detallePrecio: {
        fontSize: 16,
        fontWeight: "700",
        color: "#10233E",
    },
    detalleNota: {
        fontSize: 15,
        color: "#4E5968",
        lineHeight: 22,
    },
    detalleSinInfo: {
        fontSize: 14,
        color: "#9AAABB",
        textAlign: "center",
        paddingVertical: 12,
    },
});