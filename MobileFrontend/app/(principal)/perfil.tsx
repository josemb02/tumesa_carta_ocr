import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { usarAuth } from "../../contexto/ContextoAuth";
import { obtenerMisStats } from "../../servicios/servicioAuth";

/*
 * Tipo con todas las estadísticas que devuelve el backend en /auth/me/stats.
 */
type Stats = {
    total_checkins: number;
    total_gastado: number;
    total_puntos: number;
    total_grupos: number;
    checkins_esta_semana: number;
    checkins_este_mes: number;
    ultimo_checkin: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────

export default function Perfil() {
    const { usuario, cerrarSesion, token } = usarAuth();
    const router = useRouter();
    const [cerrando, setCerrando] = useState(false);
    const [stats, setStats] = useState<Stats | null>(null);
    const [cargando, setCargando] = useState(true);

    useFocusEffect(
        useCallback(() => {
            cargarStats();
        }, [token])
    );

    async function cargarStats() {
        if (!token) return;
        try {
            setCargando(true);
            const data = await obtenerMisStats(token);
            setStats(data);
        } catch {}
        finally { setCargando(false); }
    }

    async function handleCerrarSesion() {
        Alert.alert("Cerrar sesión", "¿Seguro que quieres salir?", [
            { text: "Cancelar", style: "cancel" },
            {
                text: "Salir", style: "destructive",
                onPress: async () => {
                    try {
                        setCerrando(true);
                        await cerrarSesion();
                        router.replace("/login");
                    } catch { setCerrando(false); }
                }
            }
        ]);
    }

    if (!usuario) return null;

    const inicial = usuario.username.charAt(0).toUpperCase();

    // Insignias calculadas a partir de las stats del backend
    const insignias = stats
        ? calcularInsignias(stats.total_checkins, stats.total_gastado, stats.total_grupos)
        : [];

    return (
        <SafeAreaView style={s.root}>
            <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

                {/* Avatar */}
                <View style={s.hero}>
                    <View style={s.avatar}>
                        <Text style={s.avatarTexto}>{inicial}</Text>
                    </View>
                    <Text style={s.nombre}>{usuario.username}</Text>
                    <Text style={s.email}>{usuario.email}</Text>
                    {(usuario.ciudad || usuario.pais) && (
                        <View style={s.ubicPill}>
                            <Ionicons name="location-outline" size={12} color="#9AAABB" />
                            <Text style={s.ubicTexto}>
                                {[usuario.ciudad, usuario.pais].filter(Boolean).join(", ")}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Stats principales */}
                {cargando ? (
                    <View style={s.statsLoading}>
                        <ActivityIndicator color="#10233E" size="small" />
                    </View>
                ) : stats && (
                    <View style={s.statsRow}>
                        <StatItem valor={stats.total_checkins.toString()} label="cervezas" />
                        <View style={s.statsDivider} />
                        <StatItem valor={`${stats.total_gastado.toFixed(0)}€`} label="gastado" />
                        <View style={s.statsDivider} />
                        <StatItem valor={stats.total_puntos.toString()} label="puntos" />
                        <View style={s.statsDivider} />
                        <StatItem valor={stats.total_grupos.toString()} label="grupos" />
                    </View>
                )}

                {/* Actividad reciente */}
                {!cargando && stats && (
                    <>
                        <Text style={s.seccionLabel}>Actividad</Text>
                        <View style={s.card}>
                            <FilaInfo
                                icono="calendar-outline"
                                label="Esta semana"
                                valor={`${stats.checkins_esta_semana} check-in${stats.checkins_esta_semana !== 1 ? "s" : ""}`}
                            />
                            <View style={s.cardSep} />
                            <FilaInfo
                                icono="stats-chart-outline"
                                label="Este mes"
                                valor={`${stats.checkins_este_mes} check-in${stats.checkins_este_mes !== 1 ? "s" : ""}`}
                            />
                            {stats.ultimo_checkin && (
                                <>
                                    <View style={s.cardSep} />
                                    <FilaInfo
                                        icono="time-outline"
                                        label="Último"
                                        valor={formatearFecha(stats.ultimo_checkin)}
                                    />
                                </>
                            )}
                        </View>
                    </>
                )}

                {/* Insignias */}
                {!cargando && insignias.length > 0 && (
                    <>
                        <Text style={s.seccionLabel}>Logros</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.insigniasScroll}>
                            {insignias.map(ins => (
                                <View key={ins.id} style={s.insignia}>
                                    <Text style={s.insigniaEmoji}>{ins.emoji}</Text>
                                    <Text style={s.insigniaNombre}>{ins.nombre}</Text>
                                </View>
                            ))}
                            {/* Insignias bloqueadas */}
                            {TODAS_INSIGNIAS.filter(i => !insignias.find(u => u.id === i.id)).slice(0, 3).map(ins => (
                                <View key={ins.id} style={[s.insignia, s.insigniaBloqueada]}>
                                    <Text style={[s.insigniaEmoji, { opacity: 0.2 }]}>{ins.emoji}</Text>
                                    <Text style={[s.insigniaNombre, s.insigniaNombreBloq]}>???</Text>
                                </View>
                            ))}
                        </ScrollView>
                    </>
                )}

                {/* Info cuenta */}
                <Text style={s.seccionLabel}>Cuenta</Text>
                <View style={s.card}>
                    <FilaInfo icono="person-outline" label="Usuario" valor={usuario.username} />
                    <View style={s.cardSep} />
                    <FilaInfo icono="mail-outline" label="Email" valor={usuario.email} />
                    {usuario.role && <>
                        <View style={s.cardSep} />
                        <FilaInfo icono="shield-checkmark-outline" label="Rol" valor={usuario.role} />
                    </>}
                </View>

                {/* Info ubicación */}
                {(usuario.pais || usuario.ciudad) && (
                    <>
                        <Text style={s.seccionLabel}>Ubicación</Text>
                        <View style={s.card}>
                            {usuario.pais && <FilaInfo icono="earth-outline" label="País" valor={usuario.pais} />}
                            {usuario.ciudad && usuario.pais && <View style={s.cardSep} />}
                            {usuario.ciudad && <FilaInfo icono="business-outline" label="Ciudad" valor={usuario.ciudad} />}
                        </View>
                    </>
                )}

                {/* Cerrar sesión */}
                <Pressable
                    style={({ pressed }) => [s.btnSalir, pressed && s.btnSalirPress]}
                    onPress={handleCerrarSesion}
                    disabled={cerrando}
                >
                    {cerrando
                        ? <ActivityIndicator color="#E53E3E" size="small" />
                        : <>
                            <Ionicons name="log-out-outline" size={18} color="#E53E3E" />
                            <Text style={s.btnSalirTexto}>Cerrar sesión</Text>
                          </>
                    }
                </Pressable>

                <Text style={s.version}>BeerMap v1.0</Text>
            </ScrollView>
        </SafeAreaView>
    );
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

/*
 * Formatea un string ISO de fecha a formato legible en español.
 * Ejemplo: "2024-03-15T18:30:00+00:00" → "15 mar 2024"
 */
function formatearFecha(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString("es-ES", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    } catch {
        return "—";
    }
}

// ─── Insignias ────────────────────────────────────────────────────────────────

const TODAS_INSIGNIAS = [
    { id: "primera",   emoji: "🍺", nombre: "Primera",    check: (c: number) => c >= 1 },
    { id: "cinco",     emoji: "🔥", nombre: "5 cervezas", check: (c: number) => c >= 5 },
    { id: "diez",      emoji: "⭐", nombre: "10 cervezas",check: (c: number) => c >= 10 },
    { id: "veinte",    emoji: "💎", nombre: "Veterano",   check: (c: number) => c >= 20 },
    { id: "gastador",  emoji: "💸", nombre: "Gastador",   check: (_c: number, g: number) => g >= 20 },
    { id: "social",    emoji: "🤝", nombre: "Social",     check: (_c: number, _g: number, gr: number) => gr >= 2 },
];

function calcularInsignias(cervezas: number, gastado: number, grupos: number) {
    return TODAS_INSIGNIAS.filter(i => i.check(cervezas, gastado, grupos));
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function StatItem({ valor, label }: { valor: string; label: string }) {
    return (
        <View style={s.statItem}>
            <Text style={s.statNum}>{valor}</Text>
            <Text style={s.statLabel}>{label}</Text>
        </View>
    );
}

function FilaInfo({ icono, label, valor }: { icono: string; label: string; valor: string }) {
    return (
        <View style={s.filaInfo}>
            <View style={s.filaIcono}>
                <Ionicons name={icono as any} size={16} color="#6B85A8" />
            </View>
            <Text style={s.filaLabel}>{label}</Text>
            <Text style={s.filaValor} numberOfLines={1}>{valor}</Text>
        </View>
    );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#F7F4EC" },
    scroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },

    hero: { alignItems: "center", marginBottom: 20 },
    avatar: {
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: "#10233E",
        justifyContent: "center", alignItems: "center",
        marginBottom: 14,
        shadowColor: "#10233E",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2, shadowRadius: 10, elevation: 4,
    },
    avatarTexto: { fontSize: 32, fontWeight: "700", color: "#FFFFFF" },
    nombre: { fontSize: 22, fontWeight: "700", color: "#10233E", letterSpacing: -0.5, marginBottom: 4 },
    email: { fontSize: 14, color: "#6B85A8", marginBottom: 8 },
    ubicPill: { flexDirection: "row", alignItems: "center", gap: 4 },
    ubicTexto: { fontSize: 12, color: "#9AAABB" },

    statsLoading: { height: 72, justifyContent: "center", alignItems: "center", marginBottom: 20 },
    statsRow: {
        flexDirection: "row",
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        paddingVertical: 18,
        marginBottom: 24,
        shadowColor: "#10233E",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    },
    statItem: { flex: 1, alignItems: "center" },
    statNum: { fontSize: 20, fontWeight: "700", color: "#10233E", letterSpacing: -0.5 },
    statLabel: { fontSize: 10, color: "#9AAABB", marginTop: 3, letterSpacing: 0.3 },
    statsDivider: { width: 1, backgroundColor: "#F0EDE6" },

    // Insignias
    insigniasScroll: { paddingBottom: 4, gap: 10 },
    insignia: {
        width: 72, alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderRadius: 14, paddingVertical: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
    },
    insigniaBloqueada: { backgroundColor: "#F5F2EC" },
    insigniaEmoji: { fontSize: 26, marginBottom: 6 },
    insigniaNombre: { fontSize: 10, fontWeight: "600", color: "#6B85A8", textAlign: "center" },
    insigniaNombreBloq: { color: "#C0BAB0" },

    seccionLabel: {
        fontSize: 11, fontWeight: "600", color: "#9AAABB",
        letterSpacing: 0.8, textTransform: "uppercase",
        marginBottom: 10, marginTop: 4, marginLeft: 4,
    },
    card: {
        backgroundColor: "#FFFFFF", borderRadius: 14, marginBottom: 20,
        shadowColor: "#10233E",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
    },
    cardSep: { height: 1, backgroundColor: "#F5F2EC", marginLeft: 48 },
    filaInfo: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
    filaIcono: {
        width: 32, height: 32, borderRadius: 8,
        backgroundColor: "#F5F2EC",
        justifyContent: "center", alignItems: "center", marginRight: 12,
    },
    filaLabel: { fontSize: 14, color: "#6B85A8", flex: 1 },
    filaValor: { fontSize: 14, fontWeight: "600", color: "#10233E", maxWidth: "55%" },

    btnSalir: {
        flexDirection: "row", alignItems: "center", justifyContent: "center",
        gap: 8, height: 52, borderRadius: 14,
        borderWidth: 1.5, borderColor: "#FECACA",
        backgroundColor: "#FFF5F5", marginBottom: 24,
    },
    btnSalirPress: { opacity: 0.7 },
    btnSalirTexto: { fontSize: 15, fontWeight: "600", color: "#E53E3E" },
    version: { fontSize: 12, color: "#C0BAB0", textAlign: "center" },
});