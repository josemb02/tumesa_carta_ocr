import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Pressable,
    RefreshControl,
    SafeAreaView,
    Share,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { usarAuth } from "../../contexto/ContextoAuth";
import { hacerPeticion } from "../../servicios/api";
import { AvatarCirculo } from "../../componentes/AvatarCirculo";

type EntradaRanking = {
    user_id: string;
    username: string;
    points: number;
    avatar_url: string | null;
    ciudad: string | null;
    pais: string | null;
};

// Grupo mínimo para el selector de invitación
type GrupoBasico = { id: string; name: string; join_code: string };

// Perfil público devuelto por /users/{id}/public
type PerfilPublico = {
    user_id: string;
    username: string;
    avatar_url: string | null;
    ciudad: string | null;
    pais: string | null;
    total_checkins: number;
    total_points: number;
};

// Ámbito: colectivo del ranking
type Ambito = "global" | "pais" | "ciudad";

// Período: ventana de tiempo
type Periodo = "historico" | "semana" | "mes";

// ─────────────────────────────────────────────────────────────────────────────

export default function Ranking() {
    const { token, usuario } = usarAuth();

    const [ambito,  setAmbito]  = useState<Ambito>("global");
    const [periodo, setPeriodo] = useState<Periodo>("historico");
    const [ranking, setRanking] = useState<EntradaRanking[]>([]);
    const [cargando, setCargando] = useState(true);
    // Spinner del pull-to-refresh (independiente del spinner de carga inicial)
    const [refrescando, setRefrescando] = useState(false);
    // Entrada seleccionada al pulsar un usuario → abre mini perfil
    const [perfilVisto, setPerfilVisto] = useState<EntradaRanking | null>(null);

    useFocusEffect(
        useCallback(() => {
            cargarRanking("global", "historico");
        }, [token])
    );

    /*
     * Construye la URL del endpoint combinando ámbito y período.
     * Todas las combinaciones tienen endpoint propio en el backend.
     */
    function calcularRuta(a: Ambito, p: Periodo): string {
        const sufijo = p === "semana" ? "/weekly" : p === "mes" ? "/monthly" : "";

        if (a === "pais" && usuario?.pais) {
            return `/rankings/country/${encodeURIComponent(usuario.pais)}${sufijo}`;
        }
        if (a === "ciudad" && usuario?.ciudad) {
            return `/rankings/city/${encodeURIComponent(usuario.ciudad)}${sufijo}`;
        }
        return `/rankings/global${sufijo}`;
    }

    async function cargarRanking(a: Ambito, p: Periodo) {
        if (!token) return;
        try {
            setCargando(true);
            const datos = await hacerPeticion(calcularRuta(a, p), { metodo: "GET", token });
            setRanking(datos);
        } catch (e: any) {
            console.error("[Ranking] Error:", e?.message ?? e);
            setRanking([]);
        } finally {
            setCargando(false);
        }
    }

    // Pull-to-refresh: recarga sin mostrar el spinner de carga inicial
    async function onRefresh() {
        if (!token) return;
        setRefrescando(true);
        try {
            const datos = await hacerPeticion(calcularRuta(ambito, periodo), { metodo: "GET", token });
            setRanking(datos);
        } catch { setRanking([]); }
        finally { setRefrescando(false); }
    }

    function cambiarAmbito(a: Ambito) {
        setAmbito(a);
        cargarRanking(a, periodo);
    }

    function cambiarPeriodo(p: Periodo) {
        setPeriodo(p);
        cargarRanking(ambito, p);
    }

    const miPosicion = ranking.findIndex(r => r.user_id === usuario?.id);
    // "Fuera del top 100" solo cuando el período no es histórico y hay datos pero el usuario no aparece
    const fueraDelTop = miPosicion < 0 && ranking.length > 0 && periodo !== "historico";

    // Tabs de ámbito: siempre Global, más País y Ciudad si el usuario los tiene
    const tabsAmbito: { key: Ambito; label: string }[] = [
        { key: "global", label: "Global" },
        ...(usuario?.pais   ? [{ key: "pais"   as Ambito, label: usuario.pais }]   : []),
        ...(usuario?.ciudad ? [{ key: "ciudad" as Ambito, label: usuario.ciudad }] : []),
    ];

    return (
        <SafeAreaView style={s.root}>

            {/* Cabecera */}
            <View style={s.header}>
                <Text style={s.headerTitulo}>Ranking</Text>
                {miPosicion >= 0 ? (
                    <View style={s.miPosicionBadge}>
                        <Text style={s.miPosicionTexto}>#{miPosicion + 1}</Text>
                    </View>
                ) : fueraDelTop ? (
                    <View style={s.fueraBadge}>
                        <Text style={s.fueraBadgeTexto}>Fuera del top 100</Text>
                    </View>
                ) : null}
            </View>

            {/* Fila 1 — Ámbito centrado */}
            <View style={s.ambitoFila}>
                {tabsAmbito.map(({ key, label }) => (
                    <Pressable
                        key={key}
                        style={[s.ambitoTab, ambito === key && s.ambitoTabActivo]}
                        onPress={() => cambiarAmbito(key)}
                    >
                        <Text style={[s.ambitoLabel, ambito === key && s.ambitoLabelActivo]}>
                            {label}
                        </Text>
                    </Pressable>
                ))}
            </View>

            {/* Fila 2 — Período (segmentado, siempre visible) */}
            <View style={s.periodoContenedor}>
                <PeriodoBtn label="Histórico"   activo={periodo === "historico"} onPress={() => cambiarPeriodo("historico")} />
                <PeriodoBtn label="Esta semana" activo={periodo === "semana"}    onPress={() => cambiarPeriodo("semana")} />
                <PeriodoBtn label="Este mes"    activo={periodo === "mes"}       onPress={() => cambiarPeriodo("mes")} />
            </View>

            {/* Podio top 3 */}
            {!cargando && ranking.length >= 3 && (
                <Podio
                    top3={ranking.slice(0, 3)}
                    miId={usuario?.id}
                    onPulsarEntrada={setPerfilVisto}
                />
            )}

            {/* Lista (posiciones 4 en adelante) */}
            {cargando ? (
                <View style={s.centrado}>
                    <ActivityIndicator color="#10233E" />
                </View>
            ) : ranking.length === 0 ? (
                <View style={s.centrado}>
                    <Text style={s.emptyTitulo}>Aún no hay nadie en este ranking</Text>
                </View>
            ) : (
                <FlatList
                    data={ranking.length >= 3 ? ranking.slice(3) : ranking}
                    keyExtractor={item => item.user_id}
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
                    renderItem={({ item, index }) => (
                        <FilaRanking
                            entrada={item}
                            posicion={index + (ranking.length >= 3 ? 4 : 1)}
                            esMio={item.user_id === usuario?.id}
                            onPress={() => setPerfilVisto(item)}
                        />
                    )}
                    ItemSeparatorComponent={() => <View style={s.separador} />}
                />
            )}

            {/* Mini perfil público — se abre al pulsar cualquier usuario */}
            <ModalPerfilPublico
                entrada={perfilVisto}
                token={token}
                onCerrar={() => setPerfilVisto(null)}
            />
        </SafeAreaView>
    );
}

// ─── Podio ────────────────────────────────────────────────────────────────────

function Podio({ top3, miId, onPulsarEntrada }: {
    top3: EntradaRanking[];
    miId?: string;
    onPulsarEntrada: (e: EntradaRanking) => void;
}) {
    const orden = [top3[1], top3[0], top3[2]]; // 2º - 1º - 3º
    const alturas = [72, 96, 56];
    const medallas = ["🥈", "🥇", "🥉"];
    const posiciones = [2, 1, 3];

    return (
        <View style={s.podio}>
            {orden.map((entrada, i) => {
                const esMio = entrada.user_id === miId;
                return (
                    // Tap en el podio → abre mini perfil
                    <Pressable
                        key={entrada.user_id}
                        style={({ pressed }) => [s.podioColumna, pressed && { opacity: 0.75 }]}
                        onPress={() => onPulsarEntrada(entrada)}
                    >
                        <Text style={s.podioMedalla}>{medallas[i]}</Text>
                        <AvatarCirculo
                            uri={entrada.avatar_url}
                            username={entrada.username}
                            size={44}
                            colorFondo={esMio ? "#10233E" : "#E2E8F0"}
                            colorTexto={esMio ? "#FFFFFF" : "#10233E"}
                        />
                        <Text style={s.podioNombre} numberOfLines={1}>{entrada.username}</Text>
                        <Text style={s.podioPuntos}>{entrada.points} pts</Text>
                        <View style={[s.podioBase, { height: alturas[i] }]}>
                            <Text style={s.podioPos}>#{posiciones[i]}</Text>
                        </View>
                    </Pressable>
                );
            })}
        </View>
    );
}

// ─── Fila ranking ─────────────────────────────────────────────────────────────

function FilaRanking({ entrada, posicion, esMio, onPress }: {
    entrada: EntradaRanking;
    posicion: number;
    esMio: boolean;
    onPress: () => void;
}) {
    return (
        // Toda la fila es tappable para ver el mini perfil
        <Pressable
            style={({ pressed }) => [s.fila, esMio && s.filaMia, pressed && { opacity: 0.7 }]}
            onPress={onPress}
        >
            <Text style={s.filaPosicion}>{String(posicion).padStart(2, "0")}</Text>
            <AvatarCirculo
                uri={entrada.avatar_url}
                username={entrada.username}
                size={36}
                colorFondo={esMio ? "#10233E" : "#E2E8F0"}
                colorTexto={esMio ? "#FFFFFF" : "#10233E"}
                style={{ marginRight: 12 }}
            />
            <Text style={[s.filaUsername, esMio && s.filaUsernameMio]} numberOfLines={1}>
                {entrada.username}
            </Text>
            <Text style={[s.filaPuntos, esMio && s.filaPuntosMios]}>
                {entrada.points} <Text style={s.filaPtsSuffix}>pts</Text>
            </Text>
            <Ionicons name="chevron-forward" size={14} color="#C0BAB0" style={{ marginLeft: 4 }} />
        </Pressable>
    );
}

// ─── Mini perfil público ──────────────────────────────────────────────────────

/*
 * Sheet que se muestra al pulsar a cualquier usuario del ranking.
 * Muestra su avatar, nombre, ubicación y puntos.
 * Permite invitarle a uno de tus grupos compartiendo el código.
 */
function ModalPerfilPublico({ entrada, token, onCerrar }: {
    entrada: EntradaRanking | null;
    token: string | null;
    onCerrar: () => void;
}) {
    const [grupos, setGrupos] = useState<GrupoBasico[]>([]);
    const [cargandoGrupos, setCargandoGrupos] = useState(false);
    const [mostrandoGrupos, setMostrandoGrupos] = useState(false);

    // Estadísticas reales del perfil público
    const [perfil, setPerfil] = useState<PerfilPublico | null>(null);
    const [cargandoPerfil, setCargandoPerfil] = useState(false);

    /*
     * Cada vez que se abre el modal (entrada cambia a no-null),
     * cargamos el perfil público con las estadísticas reales.
     */
    useEffect(() => {
        if (!entrada || !token) {
            setPerfil(null);
            return;
        }
        setCargandoPerfil(true);
        setPerfil(null);
        hacerPeticion(`/users/${entrada.user_id}/public`, { metodo: "GET", token })
            .then((datos: PerfilPublico) => setPerfil(datos))
            .catch(() => setPerfil(null))
            .finally(() => setCargandoPerfil(false));
    }, [entrada?.user_id]);

    if (!entrada) return null;

    /*
     * Carga los grupos del usuario actual la primera vez que pulsa
     * "Invitar a mi grupo" y abre el selector.
     */
    async function abrirInvitar() {
        setMostrandoGrupos(true);
        if (grupos.length > 0) return; // ya cargados
        setCargandoGrupos(true);
        try {
            const datos = await hacerPeticion("/groups/my", { metodo: "GET", token });
            setGrupos(datos);
        } catch {
            setGrupos([]);
        } finally {
            setCargandoGrupos(false);
        }
    }

    /*
     * Comparte el código de un grupo usando el Share nativo del SO.
     * El receptor puede usar ese código para unirse al grupo.
     */
    async function compartirCodigo(grupo: GrupoBasico) {
        await Share.share({
            message: `¡Únete a mi grupo "${grupo.name}" en BeerMap! Código: ${grupo.join_code}`,
        });
    }

    function cerrar() {
        setMostrandoGrupos(false);
        setGrupos([]);
        onCerrar();
    }

    return (
        <Modal
            visible={!!entrada}
            animationType="slide"
            transparent
            onRequestClose={cerrar}
            statusBarTranslucent
        >
            <Pressable style={s.overlay} onPress={cerrar}>
                {/* stopPropagation: el tap dentro del sheet no lo cierra */}
                <Pressable style={s.sheet} onPress={() => {}}>
                    <View style={s.handle} />

                    {/* Cabecera del sheet */}
                    <View style={s.perfilHeader}>
                        <Pressable onPress={cerrar} style={s.cerrarBtn}>
                            <Ionicons name="close" size={20} color="#4E5968" />
                        </Pressable>
                    </View>

                    {/* Avatar y nombre */}
                    <View style={s.perfilHero}>
                        <AvatarCirculo
                            uri={entrada.avatar_url}
                            username={entrada.username}
                            size={72}
                            colorFondo="#10233E"
                            colorTexto="#FFFFFF"
                        />
                        <Text style={s.perfilNombre}>{entrada.username}</Text>

                        {/* Ubicación pública */}
                        {(entrada.ciudad || entrada.pais) && (
                            <View style={s.perfilUbic}>
                                <Ionicons name="location-outline" size={13} color="#9AAABB" />
                                <Text style={s.perfilUbicTexto}>
                                    {[entrada.ciudad, entrada.pais].filter(Boolean).join(", ")}
                                </Text>
                            </View>
                        )}

                        {/* Estadísticas reales: cervezas y puntos totales */}
                        {cargandoPerfil ? (
                            <ActivityIndicator color="#10233E" style={{ marginTop: 14 }} />
                        ) : (
                            <View style={s.statsRow}>
                                <View style={s.statPill}>
                                    <Text style={s.statNum}>
                                        {perfil ? perfil.total_checkins : entrada.points}
                                    </Text>
                                    <Text style={s.statLabel}>
                                        {perfil ? "🍺 cervezas" : "pts ranking"}
                                    </Text>
                                </View>
                                {perfil && (
                                    <View style={s.statPill}>
                                        <Text style={s.statNum}>{perfil.total_points}</Text>
                                        <Text style={s.statLabel}>pts totales</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>

                    {/* ── Invitar a grupo ── */}
                    {!mostrandoGrupos ? (
                        <Pressable
                            style={({ pressed }) => [s.btnInvitar, pressed && { opacity: 0.75 }]}
                            onPress={abrirInvitar}
                        >
                            <Ionicons name="person-add-outline" size={18} color="#FFFFFF" />
                            <Text style={s.btnInvitarTexto}>Invitar a mi grupo</Text>
                        </Pressable>
                    ) : (
                        <View style={s.gruposInvitar}>
                            <Text style={s.gruposInvitarLabel}>Elige el grupo</Text>
                            {cargandoGrupos ? (
                                <ActivityIndicator color="#10233E" style={{ marginVertical: 16 }} />
                            ) : grupos.length === 0 ? (
                                <Text style={s.gruposVacio}>No tienes grupos todavía</Text>
                            ) : (
                                grupos.map(g => (
                                    <Pressable
                                        key={g.id}
                                        style={({ pressed }) => [s.grupoFila, pressed && { opacity: 0.7 }]}
                                        onPress={() => compartirCodigo(g)}
                                    >
                                        <View style={s.grupoAvatar}>
                                            <Text style={s.grupoAvatarTexto}>
                                                {g.name.charAt(0).toUpperCase()}
                                            </Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={s.grupoNombre}>{g.name}</Text>
                                            <Text style={s.grupoCodigo}>{g.join_code}</Text>
                                        </View>
                                        <Ionicons name="share-outline" size={18} color="#6B85A8" />
                                    </Pressable>
                                ))
                            )}
                        </View>
                    )}
                </Pressable>
            </Pressable>
        </Modal>
    );
}

// ─── Botón período (segmentado) ───────────────────────────────────────────────

function PeriodoBtn({ label, activo, onPress }: {
    label: string; activo: boolean; onPress: () => void;
}) {
    return (
        <Pressable style={[s.periodoTab, activo && s.periodoTabActivo]} onPress={onPress}>
            <Text style={[s.periodoLabel, activo && s.periodoLabelActivo]}>{label}</Text>
        </Pressable>
    );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#F7F4EC" },

    // Cabecera
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 14,
    },
    headerTitulo: { fontSize: 22, fontWeight: "700", color: "#10233E", letterSpacing: -0.5 },
    miPosicionBadge: {
        backgroundColor: "#10233E",
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 5,
    },
    miPosicionTexto: { fontSize: 13, fontWeight: "700", color: "#F7C948" },
    fueraBadge: {
        backgroundColor: "#F0EDE6",
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    fueraBadgeTexto: { fontSize: 11, fontWeight: "600", color: "#9AAABB" },

    // Fila ámbito — centrada horizontalmente
    ambitoFila: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 24,
        marginBottom: 10,
    },
    ambitoTab: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        backgroundColor: "#FFFFFF",
    },
    ambitoTabActivo: { backgroundColor: "#10233E", borderColor: "#10233E" },
    ambitoLabel: { fontSize: 13, fontWeight: "600", color: "#6B85A8" },
    ambitoLabelActivo: { color: "#FFFFFF" },

    // Control segmentado de período
    periodoContenedor: {
        flexDirection: "row",
        marginHorizontal: 24,
        marginBottom: 16,
        backgroundColor: "#EEEBE3",
        borderRadius: 12,
        padding: 3,
    },
    periodoTab: {
        flex: 1,
        paddingVertical: 7,
        borderRadius: 10,
        alignItems: "center",
    },
    periodoTabActivo: {
        backgroundColor: "#FFFFFF",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
    },
    periodoLabel: { fontSize: 12, fontWeight: "600", color: "#9AAABB" },
    periodoLabelActivo: { color: "#10233E" },

    // Podio
    podio: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "flex-end",
        paddingHorizontal: 24,
        marginBottom: 24,
        gap: 8,
    },
    podioColumna: { flex: 1, alignItems: "center" },
    podioMedalla: { fontSize: 20, marginBottom: 4 },
    podioNombre: { fontSize: 12, fontWeight: "600", color: "#10233E", marginBottom: 2, maxWidth: 80 },
    podioPuntos: { fontSize: 11, color: "#6B85A8", marginBottom: 6 },
    podioBase: {
        width: "100%",
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    podioPos: { fontSize: 13, fontWeight: "700", color: "#9AAABB" },

    // Lista
    centrado: { flex: 1, justifyContent: "center", alignItems: "center" },
    emptyTitulo: { fontSize: 16, fontWeight: "600", color: "#10233E", marginBottom: 6 },
    emptyTexto: { fontSize: 13, color: "#6B85A8" },
    lista: { paddingHorizontal: 24, paddingBottom: 30 },
    separador: { height: 1, backgroundColor: "#F0EDE6", marginLeft: 52 },

    fila: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
    },
    filaMia: {
        backgroundColor: "#F0F4FF",
        marginHorizontal: -24,
        paddingHorizontal: 24,
        borderRadius: 10,
    },
    filaPosicion: { fontSize: 12, fontWeight: "600", color: "#B0BAC8", width: 28 },
    filaUsername: { flex: 1, fontSize: 15, fontWeight: "600", color: "#10233E" },
    filaUsernameMio: { color: "#10233E" },
    filaPuntos: { fontSize: 15, fontWeight: "700", color: "#10233E" },
    filaPuntosMios: { color: "#10233E" },
    filaPtsSuffix: { fontSize: 11, fontWeight: "400", color: "#9AAABB" },

    // ── Modal mini perfil ─────────────────────────────────────────────────────
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
    sheet: {
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingTop: 12,
        paddingBottom: 36,
    },
    handle: {
        width: 40, height: 4, borderRadius: 2,
        backgroundColor: "#E2E8F0",
        alignSelf: "center", marginBottom: 8,
    },
    perfilHeader: {
        flexDirection: "row",
        justifyContent: "flex-end",
        marginBottom: 8,
    },
    cerrarBtn: { padding: 4 },

    perfilHero: { alignItems: "center", marginBottom: 24 },
    perfilNombre: {
        fontSize: 20, fontWeight: "700", color: "#10233E",
        letterSpacing: -0.4, marginTop: 12, marginBottom: 6,
    },
    perfilUbic: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 10 },
    perfilUbicTexto: { fontSize: 13, color: "#9AAABB" },
    perfilPuntosRow: { flexDirection: "row", alignItems: "baseline" },
    perfilPuntosNum: { fontSize: 26, fontWeight: "700", color: "#10233E" },
    perfilPuntosLabel: { fontSize: 14, color: "#9AAABB" },

    // Botón "Invitar a mi grupo"
    btnInvitar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        height: 52,
        backgroundColor: "#10233E",
        borderRadius: 14,
    },
    btnInvitarTexto: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },

    // Selector de grupo para invitar
    gruposInvitar: { gap: 4 },
    gruposInvitarLabel: {
        fontSize: 11, fontWeight: "600", color: "#9AAABB",
        textTransform: "uppercase", letterSpacing: 0.6,
        marginBottom: 8,
    },
    gruposVacio: { fontSize: 14, color: "#9AAABB", textAlign: "center", paddingVertical: 16 },
    grupoFila: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#F5F2EC",
    },
    grupoAvatar: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: "#10233E",
        justifyContent: "center", alignItems: "center",
    },
    grupoAvatarTexto: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
    grupoNombre: { fontSize: 14, fontWeight: "600", color: "#10233E" },
    grupoCodigo: { fontSize: 11, color: "#9AAABB", marginTop: 1 },

    // Fila de estadísticas del perfil público
    statsRow: {
        flexDirection: "row",
        gap: 12,
        marginTop: 14,
    },
    statPill: {
        flex: 1,
        backgroundColor: "#F7F4EC",
        borderRadius: 14,
        paddingVertical: 12,
        alignItems: "center",
    },
    statNum: { fontSize: 22, fontWeight: "700", color: "#10233E" },
    statLabel: { fontSize: 11, color: "#9AAABB", marginTop: 2 },
});
