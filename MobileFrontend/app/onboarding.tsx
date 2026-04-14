import { useRef, useState } from "react";
import {
    Dimensions,
    FlatList,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
    ViewToken,
} from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { CLAVE_ONBOARDING_VISTO } from "../utils/constantes";
import { useT } from "../i18n";

const { width } = Dimensions.get("window");

export default function Onboarding() {
    const router = useRouter();
    const t = useT();
    const [indiceActual, setIndiceActual] = useState(0);
    const listaRef = useRef<FlatList>(null);

    // Contenido de los 3 slides — generado con t() para que cambie al cambiar idioma
    const SLIDES = [
        {
            id: "1",
            emoji: "🍺",
            titulo: t("onboarding.slide1_titulo"),
            subtitulo: t("onboarding.slide1_sub"),
            color: "#10233E",
        },
        {
            id: "2",
            emoji: "🏆",
            titulo: t("onboarding.slide2_titulo"),
            subtitulo: t("onboarding.slide2_sub"),
            color: "#1A3A5C",
        },
        {
            id: "3",
            emoji: "⭐",
            titulo: t("onboarding.slide3_titulo"),
            subtitulo: t("onboarding.slide3_sub"),
            color: "#0F2030",
        },
    ];

    // Actualizar el índice al hacer scroll
    const alCambiarSlide = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
        if (viewableItems.length > 0 && viewableItems[0].index !== null) {
            setIndiceActual(viewableItems[0].index);
        }
    });

    // Marcar onboarding como visto y navegar al login
    async function terminarOnboarding() {
        await SecureStore.setItemAsync(CLAVE_ONBOARDING_VISTO, "true");
        router.replace("/login");
    }

    // Avanzar al siguiente slide o terminar si es el último
    function handleSiguiente() {
        if (indiceActual < SLIDES.length - 1) {
            listaRef.current?.scrollToIndex({ index: indiceActual + 1, animated: true });
        } else {
            terminarOnboarding();
        }
    }

    const esUltimo = indiceActual === SLIDES.length - 1;

    return (
        <SafeAreaView style={s.root}>
            {/* Botón saltar — esquina superior derecha */}
            {!esUltimo && (
                <Pressable style={s.saltar} onPress={terminarOnboarding}>
                    <Text style={s.saltarTexto}>{t("onboarding.saltar")}</Text>
                </Pressable>
            )}

            {/* Slides */}
            <FlatList
                ref={listaRef}
                data={SLIDES}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                onViewableItemsChanged={alCambiarSlide.current}
                viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
                renderItem={({ item }) => (
                    <View style={[s.slide, { backgroundColor: item.color }]}>
                        {/* Círculo decorativo de fondo */}
                        <View style={s.circulo} />

                        {/* Emoji grande */}
                        <Text style={s.emoji}>{item.emoji}</Text>

                        {/* Textos */}
                        <Text style={s.titulo}>{item.titulo}</Text>
                        <Text style={s.subtitulo}>{item.subtitulo}</Text>
                    </View>
                )}
            />

            {/* Parte inferior: puntos + botón */}
            <View style={s.footer}>
                {/* Indicadores de posición */}
                <View style={s.puntos}>
                    {SLIDES.map((_, i) => (
                        <View
                            key={i}
                            style={[
                                s.punto,
                                i === indiceActual ? s.puntoActivo : s.puntoInactivo,
                            ]}
                        />
                    ))}
                </View>

                {/* Botón siguiente / empezar */}
                <Pressable
                    style={({ pressed }) => [s.boton, pressed && s.botonPulsado]}
                    onPress={handleSiguiente}
                >
                    <Text style={s.botonTexto}>
                        {esUltimo ? t("onboarding.empezar") : t("onboarding.siguiente")}
                    </Text>
                </Pressable>

                {/* Enlace login para usuarios que ya tienen cuenta */}
                <Pressable onPress={terminarOnboarding} style={s.yaRegistrado}>
                    <Text style={s.yaRegistradoTexto}>
                        {t("onboarding.ya_cuenta")}{" "}
                        <Text style={s.yaRegistradoEnlace}>{t("onboarding.iniciar_sesion")}</Text>
                    </Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: "#10233E",
    },
    saltar: {
        position: "absolute",
        top: 56,
        right: 24,
        zIndex: 10,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        backgroundColor: "rgba(255,255,255,0.15)",
    },
    saltarTexto: {
        color: "#FFFFFF",
        fontSize: 14,
        fontWeight: "500",
    },
    slide: {
        width,
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 40,
        paddingBottom: 40,
    },
    circulo: {
        position: "absolute",
        width: 320,
        height: 320,
        borderRadius: 160,
        backgroundColor: "rgba(247, 201, 72, 0.08)",
        top: "15%",
    },
    emoji: {
        fontSize: 88,
        marginBottom: 32,
    },
    titulo: {
        fontSize: 30,
        fontWeight: "700",
        color: "#FFFFFF",
        textAlign: "center",
        marginBottom: 16,
        letterSpacing: -0.5,
    },
    subtitulo: {
        fontSize: 16,
        color: "rgba(255,255,255,0.72)",
        textAlign: "center",
        lineHeight: 24,
    },
    footer: {
        backgroundColor: "#F7F4EC",
        paddingTop: 28,
        paddingBottom: 36,
        paddingHorizontal: 24,
        alignItems: "center",
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
    },
    puntos: {
        flexDirection: "row",
        gap: 8,
        marginBottom: 24,
    },
    punto: {
        height: 8,
        borderRadius: 4,
    },
    puntoActivo: {
        width: 24,
        backgroundColor: "#10233E",
    },
    puntoInactivo: {
        width: 8,
        backgroundColor: "#D0D7E3",
    },
    boton: {
        width: "100%",
        height: 54,
        backgroundColor: "#10233E",
        borderRadius: 14,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 16,
    },
    botonPulsado: {
        opacity: 0.85,
    },
    botonTexto: {
        color: "#FFFFFF",
        fontSize: 17,
        fontWeight: "700",
    },
    yaRegistrado: {
        paddingVertical: 4,
    },
    yaRegistradoTexto: {
        fontSize: 14,
        color: "#6B85A8",
    },
    yaRegistradoEnlace: {
        color: "#10233E",
        fontWeight: "700",
    },
});
