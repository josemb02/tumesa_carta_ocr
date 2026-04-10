import { useCallback, useEffect, useState } from "react";
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
import { precargarAnuncioRecompensado, mostrarAnuncioRecompensado } from "../../servicios/admob";
import {
    obtenerCatalogo,
    comprarIcono,
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
    const { token, usuario } = usarAuth();
    const [iconos, setIconos] = useState<IconoCatalogo[]>([]);
    const [puntos, setPuntos] = useState(0);
    const [cargando, setCargando] = useState(true);
    const [accionando, setAccionando] = useState<string | null>(null); // id del icono en proceso
    const [cargandoVideo, setCargandoVideo] = useState(false);

    // Precarga el anuncio al montar la pantalla
    useEffect(() => {
        const limpiar = precargarAnuncioRecompensado();
        return limpiar;
    }, []);

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
     * Muestra un vídeo recompensado.
     * AdMob verifica el SSV con el backend automáticamente al completarlo.
     * El frontend solo refresca los puntos tras un breve retraso.
     */
    const manejarVerVideo = async () => {
        try {
            setCargandoVideo(true);
            // Mostrar el vídeo — AdMob verificará SSV con el backend automáticamente
            const completo = await mostrarAnuncioRecompensado();
            if (completo) {
                // Esperar un momento para que el SSV de AdMob llegue al backend
                await new Promise(resolve => setTimeout(resolve, 2000));
                // Refrescar puntos desde la API
                await cargarDatos();
                Alert.alert("¡Genial! 🍺", "Has ganado 20 puntos. ¡Sigue disfrutando!");
            }
        } catch {
            Alert.alert("Error", "No se pudo cargar el vídeo. Inténtalo de nuevo.");
        } finally {
            // Precargar el siguiente anuncio
            precargarAnuncioRecompensado();
            setCargandoVideo(false);
        }
    };

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
                <>
                    {/* Sección de vídeo recompensado */}
                    <View style={s.seccionVideo}>
                        <Text style={s.videoTitulo}>¿Quieres más puntos? 🎬</Text>
                        <Text style={s.videoSubtitulo}>
                            Ve un vídeo corto y gana 20 puntos gratis
                        </Text>
                        <Pressable
                            style={({ pressed }) => [
                                s.botonVideo,
                                pressed && s.botonVideoPulsado,
                                cargandoVideo && s.botonDeshabilitado,
                            ]}
                            onPress={manejarVerVideo}
                            disabled={cargandoVideo}
                        >
                            {cargandoVideo ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={s.textoBotonVideo}>▶ Ver vídeo +20 pts</Text>
                            )}
                        </Pressable>
                    </View>

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
                        />
                    )}
                />
                </>
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
}: {
    icono: IconoCatalogo;
    puntos: number;
    accionando: boolean;
    onComprar: () => void;
}) {
    /*
     * Estado del botón de acción:
     * - poseido       → "Tienes este" (informativo, sin acción — el icono se elige en cada check-in)
     * - puede pagar   → "Comprar X pts"
     * - no puede      → "X pts" deshabilitado
     */
    let boton;

    if (accionando) {
        boton = (
            <View style={[s.btn, s.btnComprar]}>
                <ActivityIndicator size="small" color="#FFFFFF" />
            </View>
        );
    } else if (icono.poseido) {
        // Ya lo tiene — informativo, sin acción. El icono se elige en cada check-in.
        boton = (
            <View style={[s.btn, s.btnTienes]}>
                <Text style={s.btnTextoTienes}>Tienes este</Text>
            </View>
        );
    } else if (puntos >= icono.coste_puntos) {
        // Puede comprarlo
        boton = (
            <Pressable
                style={({ pressed }) => [s.btn, s.btnComprar, pressed && s.btnPress]}
                onPress={onComprar}
            >
                <Text style={s.btnTextoComprar}>{icono.coste_puntos} pts</Text>
            </Pressable>
        );
    } else {
        // No tiene puntos suficientes
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

    // "Tienes este" — badge verde suave, sin acción
    btnTienes: { backgroundColor: "#EDF7F1", borderWidth: 1, borderColor: "#68D391" },
    btnTextoTienes: { fontSize: 11, fontWeight: "600", color: "#276749" },

    btnComprar: { backgroundColor: "#10233E" },
    btnTextoComprar: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },

    btnDeshabilitado: { backgroundColor: "#E2E8F0" },
    btnTextoDeshabilitado: { fontSize: 12, fontWeight: "600", color: "#9AAABB" },

    // Sección vídeo recompensado
    seccionVideo: {
        backgroundColor: "#FFF8E7",
        borderRadius: 14,
        padding: 18,
        marginHorizontal: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#FFE082",
        alignItems: "center",
    },
    videoTitulo: {
        fontSize: 16,
        fontWeight: "700",
        color: "#10233E",
        marginBottom: 4,
    },
    videoSubtitulo: {
        fontSize: 13,
        color: "#6B85A8",
        marginBottom: 14,
        textAlign: "center",
    },
    botonVideo: {
        backgroundColor: "#F5A623",
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 28,
    },
    botonVideoPulsado: { opacity: 0.85 },
    textoBotonVideo: {
        color: "#fff",
        fontWeight: "700",
        fontSize: 15,
    },
    botonDeshabilitado: { opacity: 0.65 },
});
