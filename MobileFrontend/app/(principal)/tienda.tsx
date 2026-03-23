import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { usarAuth } from "../../contexto/ContextoAuth";
import {
    obtenerCatalogo,
    comprarIcono,
    cambiarIconoActivo,
} from "../../servicios/servicioIconos";
import { obtenerMisStats } from "../../servicios/servicioAuth";

/*
 * Tipo que representa un icono del catálogo con los flags
 * calculados por el backend para este usuario concreto.
 */
type IconoCatalogo = {
    id: string;
    nombre: string;
    emoji: string;
    descripcion: string | null;
    coste_puntos: number;
    tipo: "gratis" | "premium";
    poseido: boolean;
    activo: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────

export default function Tienda() {
    const { token } = usarAuth();
    const [iconos, setIconos] = useState<IconoCatalogo[]>([]);
    const [puntos, setPuntos] = useState(0);
    const [cargando, setCargando] = useState(true);
    const [accionando, setAccionando] = useState<string | null>(null); // id del icono en proceso

    useFocusEffect(
        useCallback(() => {
            cargarDatos();
        }, [token])
    );

    async function cargarDatos() {
        if (!token) return;
        try {
            setCargando(true);
            const [catalogo, stats] = await Promise.all([
                obtenerCatalogo(token),
                obtenerMisStats(token),
            ]);
            setIconos(catalogo);
            setPuntos(stats.total_puntos ?? 0);
        } catch {}
        finally { setCargando(false); }
    }

    /*
     * Inicia la compra de un icono tras confirmación del usuario.
     */
    async function handleComprar(icono: IconoCatalogo) {
        if (!token) return;

        Alert.alert(
            `Comprar ${icono.nombre}`,
            `¿Gastar ${icono.coste_puntos} puntos para desbloquear ${icono.emoji} ${icono.nombre}?`,
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Comprar",
                    onPress: async () => {
                        try {
                            setAccionando(icono.id);
                            const resultado = await comprarIcono(token, icono.id);
                            setPuntos(resultado.puntos_restantes ?? 0);
                            // Recargamos el catálogo para reflejar el nuevo estado
                            await cargarDatos();
                            Alert.alert("¡Conseguido!", `${icono.emoji} ${icono.nombre} es tuyo.`);
                        } catch (err: any) {
                            Alert.alert("Error", err?.message || "No se pudo completar la compra.");
                        } finally {
                            setAccionando(null);
                        }
                    }
                }
            ]
        );
    }

    /*
     * Activa un icono que ya posee el usuario.
     */
    async function handleActivar(icono: IconoCatalogo) {
        if (!token) return;
        try {
            setAccionando(icono.id);
            await cambiarIconoActivo(token, icono.id);
            // Actualizamos el estado local sin recargar todo
            setIconos(prev =>
                prev.map(ic => ({ ...ic, activo: ic.id === icono.id }))
            );
        } catch (err: any) {
            Alert.alert("Error", err?.message || "No se pudo activar el icono.");
        } finally {
            setAccionando(null);
        }
    }

    return (
        <SafeAreaView style={s.root}>
            {/* Cabecera */}
            <View style={s.header}>
                <Text style={s.headerTitulo}>Tienda</Text>
                <View style={s.puntosChip}>
                    <Ionicons name="star" size={14} color="#F7C948" />
                    <Text style={s.puntosNum}>{puntos}</Text>
                    <Text style={s.puntosLabel}> pts</Text>
                </View>
            </View>

            {cargando ? (
                <View style={s.centrado}>
                    <ActivityIndicator color="#10233E" size="large" />
                </View>
            ) : (
                <FlatList
                    data={iconos}
                    keyExtractor={item => item.id}
                    contentContainerStyle={s.lista}
                    showsVerticalScrollIndicator={false}
                    ItemSeparatorComponent={() => <View style={s.sep} />}
                    renderItem={({ item }) => (
                        <FilaIcono
                            icono={item}
                            puntos={puntos}
                            accionando={accionando === item.id}
                            onComprar={() => handleComprar(item)}
                            onActivar={() => handleActivar(item)}
                        />
                    )}
                />
            )}
        </SafeAreaView>
    );
}

// ─── Fila de icono ────────────────────────────────────────────────────────────

function FilaIcono({
    icono,
    puntos,
    accionando,
    onComprar,
    onActivar,
}: {
    icono: IconoCatalogo;
    puntos: number;
    accionando: boolean;
    onComprar: () => void;
    onActivar: () => void;
}) {
    /*
     * Estado del botón de acción:
     * - activo       → "Activo ✓" dorado (ya seleccionado)
     * - poseido      → "Usar"     (disponible, no activo)
     * - puede pagar  → "Comprar X pts"
     * - no puede     → "X pts" deshabilitado
     */
    const puedeComprar = !icono.poseido && puntos >= icono.coste_puntos;
    const noPuede     = !icono.poseido && puntos < icono.coste_puntos;

    let boton;

    if (accionando) {
        boton = (
            <View style={[s.btn, s.btnComprar]}>
                <ActivityIndicator size="small" color="#FFFFFF" />
            </View>
        );
    } else if (icono.activo) {
        boton = (
            <View style={[s.btn, s.btnActivo]}>
                <Text style={s.btnTextoActivo}>Activo ✓</Text>
            </View>
        );
    } else if (icono.poseido) {
        boton = (
            <Pressable
                style={({ pressed }) => [s.btn, s.btnUsar, pressed && s.btnPress]}
                onPress={onActivar}
            >
                <Text style={s.btnTextoUsar}>Usar</Text>
            </Pressable>
        );
    } else if (puedeComprar) {
        boton = (
            <Pressable
                style={({ pressed }) => [s.btn, s.btnComprar, pressed && s.btnPress]}
                onPress={onComprar}
            >
                <Text style={s.btnTextoComprar}>{icono.coste_puntos} pts</Text>
            </Pressable>
        );
    } else {
        // noPuede
        boton = (
            <View style={[s.btn, s.btnDeshabilitado]}>
                <Text style={s.btnTextoDeshabilitado}>{icono.coste_puntos} pts</Text>
            </View>
        );
    }

    return (
        <View style={s.fila}>
            {/* Emoji grande */}
            <Text style={s.emoji}>{icono.emoji}</Text>

            {/* Info */}
            <View style={s.filaInfo}>
                <Text style={s.nombre}>{icono.nombre}</Text>
                {icono.descripcion && (
                    <Text style={s.descripcion} numberOfLines={1}>
                        {icono.descripcion}
                    </Text>
                )}
                {icono.coste_puntos === 0 && (
                    <Text style={s.gratisBadge}>Gratis</Text>
                )}
            </View>

            {/* Botón */}
            {boton}
        </View>
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
        paddingBottom: 12,
    },
    headerTitulo: { fontSize: 26, fontWeight: "700", color: "#10233E", letterSpacing: -0.5 },
    puntosChip: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#10233E",
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
        gap: 4,
    },
    puntosNum: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
    puntosLabel: { fontSize: 12, color: "#9AAABB" },

    centrado: { flex: 1, justifyContent: "center", alignItems: "center" },

    lista: { paddingHorizontal: 24, paddingBottom: 32, paddingTop: 8 },
    sep: { height: 1, backgroundColor: "#EAE7E0" },

    fila: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        gap: 14,
    },
    emoji: { fontSize: 34, width: 44, textAlign: "center" },
    filaInfo: { flex: 1 },
    nombre: { fontSize: 15, fontWeight: "600", color: "#10233E", marginBottom: 2 },
    descripcion: { fontSize: 12, color: "#9AAABB" },
    gratisBadge: { fontSize: 11, fontWeight: "600", color: "#38A169", marginTop: 2 },

    // Botones de acción
    btn: {
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 7,
        minWidth: 80,
        alignItems: "center",
    },
    btnPress: { opacity: 0.75 },

    btnActivo: { backgroundColor: "#F7C948" },
    btnTextoActivo: { fontSize: 12, fontWeight: "700", color: "#10233E" },

    btnUsar: { backgroundColor: "#10233E" },
    btnTextoUsar: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },

    btnComprar: { backgroundColor: "#10233E" },
    btnTextoComprar: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },

    btnDeshabilitado: { backgroundColor: "#E2E8F0" },
    btnTextoDeshabilitado: { fontSize: 12, fontWeight: "600", color: "#9AAABB" },
});
