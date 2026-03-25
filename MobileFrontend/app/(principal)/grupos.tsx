import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { usarAuth } from "../../contexto/ContextoAuth";
import { hacerPeticion } from "../../servicios/api";
import { AvatarCirculo } from "../../componentes/AvatarCirculo";

type Grupo = { id: string; name: string; join_code: string };
type Miembro = { id: string; username: string; avatar_url: string | null };
type Mensaje = { id: string; user_id: string; message: string; created_at: string };
type RankingEntrada = { user_id: string; username: string; points: number; avatar_url: string | null };
type TabDetalle = "miembros" | "ranking" | "chat";
type ModalTipo = "crear" | "unirse" | null;

// ─── Utilidades ───────────────────────────────────────────────────────────────

/*
 * Formatea un ISO timestamp a "HH:MM" si el mensaje es de hoy,
 * o a "DD/MM HH:MM" si es de otro día.
 * Usa la zona horaria local del dispositivo.
 */
function formatearHora(iso: string): string {
    try {
        const d = new Date(iso);
        const hoy = new Date();
        const mismodia =
            d.getDate() === hoy.getDate() &&
            d.getMonth() === hoy.getMonth() &&
            d.getFullYear() === hoy.getFullYear();
        const hora = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
        if (mismodia) return hora;
        return (
            d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }) +
            " " +
            hora
        );
    } catch {
        return "";
    }
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Grupos() {
    const { token } = usarAuth();
    const [grupos, setGrupos] = useState<Grupo[]>([]);
    const [cargando, setCargando] = useState(true);
    // Spinner del pull-to-refresh (no tapa la pantalla como el de carga inicial)
    const [refrescando, setRefrescando] = useState(false);
    const [grupoActivo, setGrupoActivo] = useState<Grupo | null>(null);
    const [modal, setModal] = useState<ModalTipo>(null);

    useFocusEffect(useCallback(() => { cargarGrupos(); }, [token]));

    async function cargarGrupos() {
        if (!token) return;
        try {
            setCargando(true);
            const datos = await hacerPeticion("/groups/my", { metodo: "GET", token });
            setGrupos(datos);
        } catch { setGrupos([]); }
        finally { setCargando(false); }
    }

    // Versión silenciosa para pull-to-refresh
    async function onRefresh() {
        if (!token) return;
        setRefrescando(true);
        try {
            const datos = await hacerPeticion("/groups/my", { metodo: "GET", token });
            setGrupos(datos);
        } catch { setGrupos([]); }
        finally { setRefrescando(false); }
    }

    // Vista detalle grupo
    if (grupoActivo) {
        return (
            <DetalleGrupo
                grupo={grupoActivo}
                token={token}
                onVolver={() => setGrupoActivo(null)}
            />
        );
    }

    return (
        <SafeAreaView style={s.root}>
            <View style={s.header}>
                <Text style={s.headerTitulo}>Grupos</Text>
                <View style={s.headerBtns}>
                    <Pressable style={s.headerBtn} onPress={() => setModal("unirse")}>
                        <Ionicons name="enter-outline" size={18} color="#10233E" />
                    </Pressable>
                    <Pressable style={[s.headerBtn, s.headerBtnPrimary]} onPress={() => setModal("crear")}>
                        <Ionicons name="add" size={18} color="#FFFFFF" />
                    </Pressable>
                </View>
            </View>

            {cargando ? (
                <View style={s.centrado}><ActivityIndicator color="#10233E" /></View>
            ) : grupos.length === 0 ? (
                <View style={s.centrado}>
                    <View style={s.emptyIcono}>
                        <Ionicons name="people-outline" size={32} color="#9AAABB" />
                    </View>
                    <Text style={s.emptyTitulo}>Sin grupos aún</Text>
                    <Text style={s.emptyTexto}>Crea un grupo o únete con un código</Text>
                    <View style={s.emptyBtns}>
                        <Pressable style={s.emptyBtn} onPress={() => setModal("crear")}>
                            <Text style={s.emptyBtnTexto}>Crear grupo</Text>
                        </Pressable>
                        <Pressable style={[s.emptyBtn, s.emptyBtnSec]} onPress={() => setModal("unirse")}>
                            <Text style={[s.emptyBtnTexto, s.emptyBtnTextoSec]}>Unirse</Text>
                        </Pressable>
                    </View>
                </View>
            ) : (
                <FlatList
                    data={grupos}
                    keyExtractor={i => i.id}
                    contentContainerStyle={s.lista}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refrescando}
                            onRefresh={onRefresh}
                            tintColor="#10233E"
                            colors={["#10233E"]}
                        />
                    }
                    renderItem={({ item }) => (
                        <Pressable style={s.grupoCard} onPress={() => setGrupoActivo(item)}>
                            <View style={s.grupoAvatar}>
                                <Text style={s.grupoAvatarTexto}>{item.name.charAt(0).toUpperCase()}</Text>
                            </View>
                            <View style={s.grupoInfo}>
                                <Text style={s.grupoNombre}>{item.name}</Text>
                                <Text style={s.grupoCodigo}>{item.join_code}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color="#B0BAC8" />
                        </Pressable>
                    )}
                    ItemSeparatorComponent={() => <View style={s.sep} />}
                />
            )}

            <ModalCrear visible={modal === "crear"} token={token}
                onCerrar={() => setModal(null)}
                onExito={() => { setModal(null); cargarGrupos(); }} />
            <ModalUnirse visible={modal === "unirse"} token={token}
                onCerrar={() => setModal(null)}
                onExito={() => { setModal(null); cargarGrupos(); }} />
        </SafeAreaView>
    );
}

// ─── Detalle grupo ────────────────────────────────────────────────────────────

function DetalleGrupo({ grupo, token, onVolver }: {
    grupo: Grupo;
    token: string | null;
    onVolver: () => void;
}) {
    const { usuario } = usarAuth();
    const [tab, setTab] = useState<TabDetalle>("chat");
    const [miembros, setMiembros] = useState<Miembro[]>([]);
    const [ranking, setRanking] = useState<RankingEntrada[]>([]);
    const [mensajes, setMensajes] = useState<Mensaje[]>([]);
    const [mensaje, setMensaje] = useState("");
    const [cargando, setCargando] = useState(true);
    const [refrescando, setRefrescando] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const flatRef = useRef<FlatList>(null);

    useEffect(() => { cargarTodo(); }, []);

    // Pull-to-refresh silencioso para las tabs de miembros y ranking
    async function onRefresh() {
        setRefrescando(true);
        try {
            const [m, r] = await Promise.all([
                hacerPeticion(`/groups/${grupo.id}/members`, { metodo: "GET", token }),
                hacerPeticion(`/rankings/group/${grupo.id}`, { metodo: "GET", token }),
            ]);
            setMiembros(m);
            setRanking(r);
        } catch {}
        finally { setRefrescando(false); }
    }

    async function cargarTodo() {
        setCargando(true);
        try {
            const [m, r, c] = await Promise.all([
                hacerPeticion(`/groups/${grupo.id}/members`, { metodo: "GET", token }),
                hacerPeticion(`/rankings/group/${grupo.id}`, { metodo: "GET", token }),
                hacerPeticion(`/chat/group/${grupo.id}`, { metodo: "GET", token }),
            ]);
            setMiembros(m);
            setRanking(r);
            setMensajes([...c].reverse()); // más antiguos primero
        } catch {}
        finally { setCargando(false); }
    }

    async function enviarMensaje() {
        const texto = mensaje.trim();
        if (!texto || !token) return;
        setEnviando(true);
        try {
            const nuevo = await hacerPeticion(`/chat/group/${grupo.id}`, {
                metodo: "POST", token, body: { message: texto }
            });
            setMensajes(prev => [...prev, nuevo]);
            setMensaje("");
            setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
        } catch (e: any) {
            Alert.alert("Error", e?.message || "No se pudo enviar");
        } finally { setEnviando(false); }
    }

    return (
        <SafeAreaView style={s.root}>
            {/* Cabecera */}
            <View style={s.detalleHeader}>
                <Pressable onPress={onVolver} style={s.volverBtn}>
                    <Ionicons name="chevron-back" size={22} color="#10233E" />
                </Pressable>
                <View style={s.detalleHeaderInfo}>
                    <Text style={s.detalleTitulo}>{grupo.name}</Text>
                    {/* Al pulsar el código se abre el Share sheet nativo para copiarlo o compartirlo */}
                    <Pressable
                        style={({ pressed }) => [s.detalleCodigoRow, pressed && { opacity: 0.6 }]}
                        onPress={() => Share.share({ message: grupo.join_code })}
                        hitSlop={8}
                    >
                        <Text style={s.detalleCodigo}>{grupo.join_code}</Text>
                        <Ionicons name="copy-outline" size={11} color="#9AAABB" />
                    </Pressable>
                </View>
            </View>

            {/* Tabs */}
            <View style={s.detalleTabs}>
                {(["chat", "ranking", "miembros"] as TabDetalle[]).map(t => (
                    <Pressable key={t} style={[s.detalleTab, tab === t && s.detalleTabActivo]} onPress={() => setTab(t)}>
                        <Text style={[s.detalleTabLabel, tab === t && s.detalleTabLabelActivo]}>
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                        </Text>
                    </Pressable>
                ))}
            </View>

            {cargando ? (
                <View style={s.centrado}><ActivityIndicator color="#10233E" /></View>
            ) : (
                <>
                    {/* ── CHAT ── */}
                    {tab === "chat" && (
                        <KeyboardAvoidingView
                            style={{ flex: 1 }}
                            behavior={Platform.OS === "ios" ? "padding" : "height"}
                            keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
                        >
                            <FlatList
                                ref={flatRef}
                                data={mensajes}
                                keyExtractor={m => m.id}
                                contentContainerStyle={s.chatLista}
                                showsVerticalScrollIndicator={false}
                                onContentSizeChange={() => flatRef.current?.scrollToEnd()}
                                ListEmptyComponent={
                                    <View style={s.chatVacio}>
                                        <Text style={s.chatVacioTexto}>Sé el primero en escribir algo 👋</Text>
                                    </View>
                                }
                                renderItem={({ item }) => {
                                    const esMio = item.user_id === usuario?.id;
                                    const autor = miembros.find(m => m.id === item.user_id);
                                    return (
                                        <View style={[s.burbuja, esMio ? s.burbujaPropia : s.burbujaAjena]}>
                                            {!esMio && (
                                                <Text style={s.burbujaAutor}>{autor?.username || "?"}</Text>
                                            )}
                                            <Text style={[s.burbujaTexto, esMio && s.burbujaTextoProp]}>
                                                {item.message}
                                            </Text>
                                            {/* Hora del mensaje alineada a la derecha de la burbuja */}
                                            <Text style={[s.burbujaHora, esMio && s.burbujaHoraProp]}>
                                                {formatearHora(item.created_at)}
                                            </Text>
                                        </View>
                                    );
                                }}
                            />
                            <View style={s.chatInput}>
                                <TextInput
                                    value={mensaje}
                                    onChangeText={setMensaje}
                                    placeholder="Escribe un mensaje..."
                                    placeholderTextColor="#B0BAC8"
                                    maxLength={500}
                                    style={s.chatTextInput}
                                    multiline
                                />
                                <Pressable
                                    style={[s.chatEnviar, (!mensaje.trim() || enviando) && s.chatEnviarDisabled]}
                                    onPress={enviarMensaje}
                                    disabled={!mensaje.trim() || enviando}
                                >
                                    {enviando
                                        ? <ActivityIndicator size="small" color="#FFFFFF" />
                                        : <Ionicons name="send" size={18} color="#FFFFFF" />
                                    }
                                </Pressable>
                            </View>
                        </KeyboardAvoidingView>
                    )}

                    {/* ── RANKING ── */}
                    {tab === "ranking" && (
                        <FlatList
                            data={ranking}
                            keyExtractor={r => r.user_id}
                            contentContainerStyle={s.lista}
                            showsVerticalScrollIndicator={false}
                            refreshControl={
                                <RefreshControl
                                    refreshing={refrescando}
                                    onRefresh={onRefresh}
                                    tintColor="#10233E"
                                    colors={["#10233E"]}
                                />
                            }
                            renderItem={({ item, index }) => {
                                const esMio = item.user_id === usuario?.id;
                                return (
                                    <View style={[s.rankFila, esMio && s.rankFilaMia]}>
                                        <Text style={s.rankPos}>{String(index + 1).padStart(2, "0")}</Text>
                                        {/* Foto real de cada miembro del ranking */}
                                        <AvatarCirculo
                                            uri={item.avatar_url}
                                            username={item.username}
                                            size={36}
                                            colorFondo={esMio ? "#10233E" : "#E2E8F0"}
                                            colorTexto={esMio ? "#FFFFFF" : "#10233E"}
                                            style={{ marginRight: 12 }}
                                        />
                                        <Text style={s.rankNombre} numberOfLines={1}>{item.username}</Text>
                                        <Text style={s.rankPuntos}>{item.points} <Text style={s.rankPtsSuf}>pts</Text></Text>
                                    </View>
                                );
                            }}
                            ItemSeparatorComponent={() => <View style={s.sep} />}
                        />
                    )}

                    {/* ── MIEMBROS ── */}
                    {tab === "miembros" && (
                        <FlatList
                            data={miembros}
                            keyExtractor={m => m.id}
                            contentContainerStyle={s.lista}
                            showsVerticalScrollIndicator={false}
                            refreshControl={
                                <RefreshControl
                                    refreshing={refrescando}
                                    onRefresh={onRefresh}
                                    tintColor="#10233E"
                                    colors={["#10233E"]}
                                />
                            }
                            renderItem={({ item }) => {
                                const esMio = item.id === usuario?.id;
                                return (
                                    <View style={s.miembroFila}>
                                        {/* Foto real de cada miembro del grupo */}
                                        <AvatarCirculo
                                            uri={item.avatar_url}
                                            username={item.username}
                                            size={40}
                                            colorFondo={esMio ? "#10233E" : "#F0EDE6"}
                                            colorTexto={esMio ? "#FFFFFF" : "#10233E"}
                                            style={{ marginRight: 14 }}
                                        />
                                        <Text style={s.miembroNombre}>{item.username}</Text>
                                    </View>
                                );
                            }}
                            ItemSeparatorComponent={() => <View style={s.sep} />}
                        />
                    )}
                </>
            )}
        </SafeAreaView>
    );
}

// ─── Modal crear ──────────────────────────────────────────────────────────────

function ModalCrear({ visible, token, onCerrar, onExito }: {
    visible: boolean; token: string | null; onCerrar: () => void; onExito: () => void;
}) {
    const [nombre, setNombre] = useState("");
    const [enviando, setEnviando] = useState(false);

    async function crear() {
        const n = nombre.trim();
        if (n.length < 3) { Alert.alert("Error", "El nombre debe tener al menos 3 caracteres"); return; }
        try {
            setEnviando(true);
            await hacerPeticion("/groups", { metodo: "POST", token, body: { name: n } });
            setNombre("");
            onExito();
        } catch (e: any) {
            Alert.alert("Error", e?.message || "No se pudo crear el grupo");
        } finally { setEnviando(false); }
    }

    return (
        <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
                <Pressable style={s.overlay} onPress={onCerrar}>
                    <Pressable style={s.sheet} onPress={() => {}}>
                        <View style={s.handle} />
                        <View style={s.sheetHeader}>
                            <Text style={s.sheetTitulo}>Nuevo grupo</Text>
                            <Pressable onPress={onCerrar}><Ionicons name="close" size={22} color="#4E5968" /></Pressable>
                        </View>
                        <Text style={s.fieldLabel}>Nombre del grupo</Text>
                        <TextInput
                            value={nombre} onChangeText={setNombre}
                            placeholder="ej: Los del Viernes"
                            placeholderTextColor="#B0BAC8"
                            maxLength={80} style={s.input} autoFocus
                        />
                        <Pressable style={({ pressed }) => [s.btn, enviando && s.btnOff, pressed && s.btnPress]} onPress={crear} disabled={enviando}>
                            {enviando ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.btnLabel}>Crear grupo</Text>}
                        </Pressable>
                    </Pressable>
                </Pressable>
            </KeyboardAvoidingView>
        </Modal>
    );
}

// ─── Modal unirse ─────────────────────────────────────────────────────────────

function ModalUnirse({ visible, token, onCerrar, onExito }: {
    visible: boolean; token: string | null; onCerrar: () => void; onExito: () => void;
}) {
    const [codigo, setCodigo] = useState("");
    const [enviando, setEnviando] = useState(false);

    async function unirse() {
        const c = codigo.trim().toUpperCase();
        if (c.length < 4) { Alert.alert("Error", "Introduce el código del grupo"); return; }
        try {
            setEnviando(true);
            await hacerPeticion("/groups/join", { metodo: "POST", token, body: { join_code: c } });
            setCodigo("");
            onExito();
        } catch (e: any) {
            Alert.alert("Error", e?.message || "Código incorrecto");
        } finally { setEnviando(false); }
    }

    return (
        <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
                <Pressable style={s.overlay} onPress={onCerrar}>
                    <Pressable style={s.sheet} onPress={() => {}}>
                        <View style={s.handle} />
                        <View style={s.sheetHeader}>
                            <Text style={s.sheetTitulo}>Unirse a un grupo</Text>
                            <Pressable onPress={onCerrar}><Ionicons name="close" size={22} color="#4E5968" /></Pressable>
                        </View>
                        <Text style={s.fieldLabel}>Código de invitación</Text>
                        <TextInput
                            value={codigo} onChangeText={t => setCodigo(t.toUpperCase())}
                            placeholder="ej: AB12CD" placeholderTextColor="#B0BAC8"
                            maxLength={10} autoCapitalize="characters" autoCorrect={false}
                            style={[s.input, s.inputCodigo]} autoFocus
                        />
                        <Text style={s.inputHint}>El código lo comparte el creador del grupo</Text>
                        <Pressable style={({ pressed }) => [s.btn, enviando && s.btnOff, pressed && s.btnPress]} onPress={unirse} disabled={enviando}>
                            {enviando ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.btnLabel}>Unirse</Text>}
                        </Pressable>
                    </Pressable>
                </Pressable>
            </KeyboardAvoidingView>
        </Modal>
    );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#F7F4EC" },
    centrado: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40 },

    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16 },
    headerTitulo: { fontSize: 22, fontWeight: "700", color: "#10233E", letterSpacing: -0.5 },
    headerBtns: { flexDirection: "row", gap: 8 },
    headerBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center" },
    headerBtnPrimary: { backgroundColor: "#10233E", borderColor: "#10233E" },

    emptyIcono: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#F0EDE6", justifyContent: "center", alignItems: "center", marginBottom: 14 },
    emptyTitulo: { fontSize: 17, fontWeight: "600", color: "#10233E", marginBottom: 6 },
    emptyTexto: { fontSize: 14, color: "#6B85A8", textAlign: "center", marginBottom: 20 },
    emptyBtns: { flexDirection: "row", gap: 10 },
    emptyBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: "#10233E" },
    emptyBtnSec: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#10233E" },
    emptyBtnTexto: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
    emptyBtnTextoSec: { color: "#10233E" },

    lista: { paddingHorizontal: 24, paddingBottom: 30 },
    grupoCard: { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
    grupoAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#10233E", justifyContent: "center", alignItems: "center", marginRight: 14 },
    grupoAvatarTexto: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
    grupoInfo: { flex: 1 },
    grupoNombre: { fontSize: 15, fontWeight: "600", color: "#10233E", marginBottom: 2 },
    grupoCodigo: { fontSize: 12, color: "#9AAABB" },
    sep: { height: 1, backgroundColor: "#F0EDE6", marginLeft: 58 },

    // Detalle
    detalleHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, gap: 8 },
    volverBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#E2E8F0" },
    detalleHeaderInfo: { flex: 1 },
    detalleTitulo: { fontSize: 18, fontWeight: "700", color: "#10233E", letterSpacing: -0.3 },
    detalleCodigoRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 },
    detalleCodigo: { fontSize: 11, color: "#9AAABB" },

    detalleTabs: { flexDirection: "row", marginHorizontal: 24, marginBottom: 16, backgroundColor: "#EEEBE3", borderRadius: 12, padding: 3 },
    detalleTab: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center" },
    detalleTabActivo: { backgroundColor: "#FFFFFF", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 },
    detalleTabLabel: { fontSize: 13, fontWeight: "600", color: "#9AAABB" },
    detalleTabLabelActivo: { color: "#10233E" },

    // Chat
    chatLista: { paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8, gap: 8 },
    chatVacio: { flex: 1, alignItems: "center", paddingTop: 60 },
    chatVacioTexto: { fontSize: 14, color: "#9AAABB" },
    burbuja: { maxWidth: "78%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
    burbujaAjena: { alignSelf: "flex-start", backgroundColor: "#FFFFFF", borderBottomLeftRadius: 4 },
    burbujaPropia: { alignSelf: "flex-end", backgroundColor: "#10233E", borderBottomRightRadius: 4 },
    burbujaAutor: { fontSize: 11, fontWeight: "600", color: "#9AAABB", marginBottom: 3 },
    burbujaTexto: { fontSize: 14, color: "#10233E", lineHeight: 20 },
    burbujaTextoProp: { color: "#FFFFFF" },
    // Hora pequeña debajo del texto, alineada al lado derecho de la burbuja
    burbujaHora: { fontSize: 10, color: "#B0BAC8", marginTop: 4, alignSelf: "flex-end" },
    burbujaHoraProp: { color: "rgba(255,255,255,0.55)" },
    chatInput: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#F0EDE6", backgroundColor: "#F7F4EC", gap: 10 },
    chatTextInput: { flex: 1, minHeight: 40, maxHeight: 100, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: "#10233E", backgroundColor: "#FFFFFF" },
    chatEnviar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#10233E", justifyContent: "center", alignItems: "center" },
    chatEnviarDisabled: { opacity: 0.4 },

    // Ranking dentro del grupo
    rankFila: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
    rankFilaMia: { backgroundColor: "#F0F4FF", marginHorizontal: -24, paddingHorizontal: 24, borderRadius: 10 },
    rankPos: { fontSize: 12, fontWeight: "600", color: "#B0BAC8", width: 28 },
    rankAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#E2E8F0", justifyContent: "center", alignItems: "center", marginRight: 12 },
    rankAvatarMio: { backgroundColor: "#10233E" },
    rankAvatarTexto: { fontSize: 14, fontWeight: "700", color: "#10233E" },
    rankAvatarTextoMio: { color: "#FFFFFF" },
    rankNombre: { flex: 1, fontSize: 15, fontWeight: "600", color: "#10233E" },
    rankPuntos: { fontSize: 15, fontWeight: "700", color: "#10233E" },
    rankPtsSuf: { fontSize: 11, fontWeight: "400", color: "#9AAABB" },

    // Miembros
    miembroFila: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
    miembroAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F0EDE6", justifyContent: "center", alignItems: "center", marginRight: 14 },
    miembroAvatarTexto: { fontSize: 16, fontWeight: "700", color: "#10233E" },
    miembroNombre: { fontSize: 15, fontWeight: "500", color: "#10233E" },

    // Modales
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
    sheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingTop: 12 },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E2E8F0", alignSelf: "center", marginBottom: 18 },
    sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
    sheetTitulo: { fontSize: 18, fontWeight: "700", color: "#10233E", letterSpacing: -0.3 },
    fieldLabel: { fontSize: 12, fontWeight: "600", color: "#6B85A8", marginBottom: 8, letterSpacing: 0.4, textTransform: "uppercase" },
    input: { height: 50, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 16, fontSize: 15, color: "#10233E", backgroundColor: "#FAFAFA", marginBottom: 8 },
    inputCodigo: { fontSize: 22, fontWeight: "700", letterSpacing: 4, textAlign: "center" },
    inputHint: { fontSize: 12, color: "#9AAABB", textAlign: "center", marginBottom: 16 },
    btn: { height: 52, backgroundColor: "#10233E", borderRadius: 12, justifyContent: "center", alignItems: "center", marginTop: 8, marginBottom: 8 },
    btnOff: { opacity: 0.6 },
    btnPress: { opacity: 0.85 },
    btnLabel: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});