import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Linking,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { usarAuth } from "../../contexto/ContextoAuth";
import { obtenerMisStats, obtenerMisRachas, cambiarContrasena } from "../../servicios/servicioAuth";
import { hacerPeticion } from "../../servicios/api";
import { AvatarCirculo } from "../../componentes/AvatarCirculo";
import { useT, cambiarIdioma, obtenerIdioma } from "../../i18n";

/*
 * Cloud name de Cloudinary y preset sin firma configurados en el panel.
 * El preset "mapa_cervecería_avatares" permite subida directa sin API key.
 */
const CLOUD_NAME = "dxfvlrxaw";
const UPLOAD_PRESET = "beermap_avatars";

/*
 * Sube una imagen local directamente a Cloudinary usando el preset sin firma.
 * Devuelve la URL pública (secure_url) de la imagen subida.
 */
async function subirACloudinary(uri: string): Promise<string> {
    const extension = uri.split(".").pop()?.toLowerCase() || "jpg";
    const tipo = extension === "png" ? "image/png" : "image/jpeg";

    const formData = new FormData();
    formData.append("file", { uri, type: tipo, name: `avatar.${extension}` } as any);
    formData.append("upload_preset", UPLOAD_PRESET);

    // Log para verificar qué se está enviando a Cloudinary
    console.log("[Cloudinary] Subiendo imagen:", { cloud: CLOUD_NAME, preset: UPLOAD_PRESET, extension, tipo });

    const respuesta = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        { method: "POST", body: formData }
    );

    // Si Cloudinary rechaza la petición, logueamos el cuerpo completo del error
    if (!respuesta.ok) {
        const textoError = await respuesta.text().catch(() => "(sin cuerpo)");
        console.error("[Cloudinary] Error HTTP", respuesta.status, textoError);
        throw new Error(`No se pudo subir la imagen (${respuesta.status}). Revisa la consola para más detalles.`);
    }

    const datos = await respuesta.json();
    console.log("[Cloudinary] Subida exitosa:", datos.secure_url);
    return datos.secure_url as string;
}

type CheckinHistorial = {
    id: string;
    lat: string;
    lng: string;
    precio: number | null;
    note: string | null;
    foto_url: string | null;
    icon_emoji: string | null;
    created_at: string;
};

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

/*
 * Tipo con las rachas de check-ins del usuario.
 */
type Rachas = {
    racha_actual: number;
    racha_maxima: number;
    ultimo_checkin: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────

export default function Perfil() {
    const { usuario, cerrarSesion, token, guardarAvatar, actualizarUsuario } = usarAuth();
    const router = useRouter();
    const t = useT();
    const [cerrando, setCerrando] = useState(false);
    const [subiendo, setSubiendo] = useState(false);
    const [stats, setStats]     = useState<Stats | null>(null);
    const [rachas, setRachas]   = useState<Rachas | null>(null);
    const [cargando, setCargando] = useState(true);
    // Controla el spinner del pull-to-refresh (no el de carga inicial)
    const [refrescando, setRefrescando] = useState(false);
    // Estado del modal de cambio de contraseña
    const [modalPassword, setModalPassword] = useState(false);
    const [passActual, setPassActual]       = useState("");
    const [passNueva, setPassNueva]         = useState("");
    const [passConfirmar, setPassConfirmar] = useState("");
    const [cambiandoPass, setCambiandoPass] = useState(false);
    // Estado del modal de editar perfil
    const [modalEditar, setModalEditar] = useState(false);
    const [editUsername, setEditUsername] = useState("");
    const [editPais, setEditPais] = useState("");
    const [editCiudad, setEditCiudad] = useState("");
    const [guardandoPerfil, setGuardandoPerfil] = useState(false);
    // Historial de check-ins
    const [historial, setHistorial] = useState<CheckinHistorial[]>([]);

    useFocusEffect(
        useCallback(() => {
            cargarTodo();
        }, [token])
    );

    // Carga stats, rachas e historial en paralelo
    async function cargarTodo() {
        if (!token) return;
        try {
            setCargando(true);
            const [dataStats, dataRachas, dataHistorial] = await Promise.all([
                obtenerMisStats(token),
                obtenerMisRachas(token),
                hacerPeticion("/checkins/my-history?limite=20", { metodo: "GET", token }),
            ]);
            setStats(dataStats);
            setRachas(dataRachas);
            setHistorial(dataHistorial || []);
        } catch {}
        finally { setCargando(false); }
    }

    // Versión silenciosa para pull-to-refresh: no muestra el spinner de carga inicial
    async function onRefresh() {
        if (!token) return;
        try {
            setRefrescando(true);
            const [dataStats, dataRachas, dataHistorial] = await Promise.all([
                obtenerMisStats(token),
                obtenerMisRachas(token),
                hacerPeticion("/checkins/my-history?limite=20", { metodo: "GET", token }),
            ]);
            setStats(dataStats);
            setRachas(dataRachas);
            setHistorial(dataHistorial || []);
        } catch {}
        finally { setRefrescando(false); }
    }

    /*
     * Abre el selector de imagen del dispositivo, sube la imagen
     * elegida a Cloudinary y guarda la URL en el backend.
     */
    async function handleCambiarFoto() {
        // Pedimos permiso de acceso a la galería
        const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permiso.granted) {
            Alert.alert(t("general.error"), t("perfil.error_permiso_foto"));
            return;
        }

        const resultado = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: "images", // MediaTypeOptions fue eliminado en expo-image-picker v16+
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (resultado.canceled || !resultado.assets[0]) return;

        try {
            setSubiendo(true);
            const url = await subirACloudinary(resultado.assets[0].uri);
            await guardarAvatar(url);
        } catch (err: any) {
            Alert.alert(t("general.error"), err?.message || t("perfil.error_foto"));
        } finally {
            setSubiendo(false);
        }
    }

    async function handleCambiarPassword() {
        if (!passNueva || !passActual) {
            Alert.alert(t("general.error"), t("perfil.error_campos"));
            return;
        }
        if (passNueva !== passConfirmar) {
            Alert.alert(t("general.error"), t("perfil.error_password_coincide"));
            return;
        }
        if (passNueva.length < 8) {
            Alert.alert(t("general.error"), t("perfil.error_password_corta"));
            return;
        }
        try {
            setCambiandoPass(true);
            await cambiarContrasena(token!, passActual, passNueva);
            Alert.alert("✓", t("perfil.exito_password"));
            setModalPassword(false);
            setPassActual(""); setPassNueva(""); setPassConfirmar("");
        } catch (err: any) {
            Alert.alert(t("general.error"), err?.message || t("perfil.error_password"));
        } finally {
            setCambiandoPass(false);
        }
    }

    async function handleEditarPerfil() {
        if (!token) return;
        const u = editUsername.trim();
        const p = editPais.trim();
        const c = editCiudad.trim();
        if (u.length < 3) {
            Alert.alert(t("general.error"), t("perfil.error_username_corto"));
            return;
        }
        if (p.length < 2 || c.length < 2) {
            Alert.alert(t("general.error"), t("perfil.error_pais_ciudad"));
            return;
        }
        try {
            setGuardandoPerfil(true);
            await hacerPeticion("/auth/me/profile", {
                metodo: "PATCH",
                token,
                body: { username: u, pais: p, ciudad: c },
            });
            setModalEditar(false);
            actualizarUsuario({ username: u, pais: p, ciudad: c });
            Alert.alert("✓", t("perfil.exito_perfil"));
            await cargarTodo();
        } catch (err: any) {
            Alert.alert(t("general.error"), err?.message || t("perfil.error_perfil"));
        } finally {
            setGuardandoPerfil(false);
        }
    }

    async function handleEliminarCuenta() {
        Alert.alert(
            t("perfil.eliminar_titulo"),
            t("perfil.eliminar_sub"),
            [
                { text: t("general.cancelar"), style: "cancel" },
                {
                    text: t("perfil.eliminar_confirmar"),
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await cerrarSesion();
                            try {
                                await hacerPeticion("/auth/me", { metodo: "DELETE", token });
                            } catch {
                                // Si falla el backend no importa — ya cerramos sesión local
                            }
                        } catch (err: any) {
                            Alert.alert(t("general.error"), err?.message || t("perfil.error_eliminar"));
                        }
                    },
                },
            ]
        );
    }

    async function handleCerrarSesion() {
        Alert.alert(t("perfil.cerrar_sesion_titulo"), t("perfil.cerrar_sesion_sub"), [
            { text: t("general.cancelar"), style: "cancel" },
            {
                text: t("perfil.cerrar_sesion_confirmar"), style: "destructive",
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

    // Insignias calculadas a partir de las stats del backend
    const insignias = stats
        ? calcularInsignias(stats.total_checkins, stats.total_gastado, stats.total_grupos)
        : [];

    return (
        <SafeAreaView style={s.root}>
            <ScrollView
                contentContainerStyle={s.scroll}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refrescando}
                        onRefresh={onRefresh}
                        tintColor="#10233E"
                        colors={["#10233E"]}
                    />
                }
            >

                {/* Avatar — al pulsar se abre el selector de imagen */}
                <View style={s.hero}>
                    <Pressable
                        style={({ pressed }) => [s.avatarWrap, pressed && { opacity: 0.75 }]}
                        onPress={handleCambiarFoto}
                        disabled={subiendo}
                    >
                        <AvatarCirculo
                            uri={usuario.avatar_url}
                            username={usuario.username}
                            size={80}
                            colorFondo="#10233E"
                            colorTexto="#FFFFFF"
                        />
                        {/* Icono de cámara superpuesto en la esquina */}
                        <View style={s.avatarCamara}>
                            {subiendo
                                ? <ActivityIndicator size={10} color="#FFFFFF" />
                                : <Ionicons name="camera" size={12} color="#FFFFFF" />
                            }
                        </View>
                    </Pressable>
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
                    {/* Fecha de nacimiento si el usuario la tiene registrada */}
                    {usuario.fecha_nacimiento && (
                        <View style={[s.ubicPill, { marginTop: 4 }]}>
                            <Ionicons name="calendar-outline" size={12} color="#9AAABB" />
                            <Text style={s.ubicTexto}>
                                {new Date(usuario.fecha_nacimiento).toLocaleDateString("es-ES", {
                                    day: "numeric", month: "long", year: "numeric"
                                })}
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
                        <StatItem valor={stats.total_checkins.toString()} label={t("perfil.cervezas")} />
                        <View style={s.statsDivider} />
                        <StatItem valor={`${stats.total_gastado.toFixed(0)}€`} label={t("perfil.gastado")} />
                        <View style={s.statsDivider} />
                        <StatItem valor={stats.total_puntos.toString()} label={t("perfil.puntos")} />
                        <View style={s.statsDivider} />
                        <StatItem valor={stats.total_grupos.toString()} label={t("perfil.grupos")} />
                    </View>
                )}

                {/* Actividad reciente */}
                {!cargando && stats && (
                    <>
                        <Text style={s.seccionLabel}>{t("perfil.actividad")}</Text>
                        <View style={s.card}>
                            <FilaInfo
                                icono="calendar-outline"
                                label={t("perfil.esta_semana")}
                                valor={`${stats.checkins_esta_semana} check-in${stats.checkins_esta_semana !== 1 ? "s" : ""}`}
                            />
                            <View style={s.cardSep} />
                            <FilaInfo
                                icono="stats-chart-outline"
                                label={t("perfil.este_mes")}
                                valor={`${stats.checkins_este_mes} check-in${stats.checkins_este_mes !== 1 ? "s" : ""}`}
                            />
                            {stats.ultimo_checkin && (
                                <>
                                    <View style={s.cardSep} />
                                    <FilaInfo
                                        icono="time-outline"
                                        label={t("perfil.ultimo_checkin")}
                                        valor={formatearFecha(stats.ultimo_checkin)}
                                    />
                                </>
                            )}
                            {rachas && (
                                <>
                                    <View style={s.cardSep} />
                                    <FilaInfo
                                        icono="flame-outline"
                                        label={t("perfil.racha_actual")}
                                        valor={`${rachas.racha_actual} día${rachas.racha_actual !== 1 ? "s" : ""}`}
                                    />
                                    <View style={s.cardSep} />
                                    <FilaInfo
                                        icono="trophy-outline"
                                        label={t("perfil.racha_maxima")}
                                        valor={`${rachas.racha_maxima} día${rachas.racha_maxima !== 1 ? "s" : ""}`}
                                    />
                                </>
                            )}
                        </View>
                    </>
                )}

                {/* Insignias — siempre visibles aunque no haya ninguna ganada */}
                {!cargando && stats && (
                    <>
                        <Text style={s.seccionLabel}>{t("perfil.logros")}</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.insigniasScroll}>
                            {insignias.map(ins => (
                                <View key={ins.id} style={s.insignia}>
                                    <Text style={s.insigniaEmoji}>{ins.emoji}</Text>
                                    <Text style={s.insigniaNombre}>{ins.nombre}</Text>
                                </View>
                            ))}
                            {/* Insignias bloqueadas: muestra las que aún no tiene */}
                            {TODAS_INSIGNIAS.filter(i => !insignias.find(u => u.id === i.id)).slice(0, 4).map(ins => (
                                <View key={ins.id} style={[s.insignia, s.insigniaBloqueada]}>
                                    <Text style={[s.insigniaEmoji, { opacity: 0.2 }]}>{ins.emoji}</Text>
                                    <Text style={[s.insigniaNombre, s.insigniaNombreBloq]}>???</Text>
                                </View>
                            ))}
                        </ScrollView>
                    </>
                )}

                {/* Info cuenta */}
                <Text style={s.seccionLabel}>{t("perfil.cuenta")}</Text>
                <View style={s.card}>
                    <FilaInfo icono="person-outline" label={t("perfil.usuario_label")} valor={usuario.username} />
                    <View style={s.cardSep} />
                    <FilaInfo icono="mail-outline" label={t("perfil.email_label")} valor={usuario.email} />
                    {usuario.role && <>
                        <View style={s.cardSep} />
                        <FilaInfo icono="shield-checkmark-outline" label={t("perfil.rol_label")} valor={usuario.role} />
                    </>}
                    <View style={s.cardSep} />
                    <Pressable
                        style={({ pressed }) => [s.filaInfo, pressed && { opacity: 0.6 }]}
                        onPress={() => setModalPassword(true)}
                    >
                        <View style={s.filaIcono}>
                            <Ionicons name="lock-closed-outline" size={16} color="#6B85A8" />
                        </View>
                        <Text style={[s.filaLabel, { flex: 1 }]}>{t("perfil.cambiar_password")}</Text>
                        <Ionicons name="chevron-forward" size={16} color="#C0BAB0" />
                    </Pressable>
                    <View style={s.cardSep} />
                    <View style={s.filaInfo}>
                        <View style={s.filaIcono}>
                            <Ionicons name="language-outline" size={16} color="#6B85A8" />
                        </View>
                        <Text style={[s.filaLabel, { flex: 1 }]}>{t("perfil.idioma")}</Text>
                        <View style={s.idiomaOpciones}>
                            <Pressable
                                style={[s.idiomaBtn, obtenerIdioma() === "es" && s.idiomaBtnActivo]}
                                onPress={() => cambiarIdioma("es")}
                            >
                                <Text style={[s.idiomaBtnTexto, obtenerIdioma() === "es" && s.idiomaBtnTextoActivo]}>ES</Text>
                            </Pressable>
                            <Pressable
                                style={[s.idiomaBtn, obtenerIdioma() === "en" && s.idiomaBtnActivo]}
                                onPress={() => cambiarIdioma("en")}
                            >
                                <Text style={[s.idiomaBtnTexto, obtenerIdioma() === "en" && s.idiomaBtnTextoActivo]}>EN</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>

                {/* Info ubicación */}
                {(usuario.pais || usuario.ciudad) && (
                    <>
                        <Text style={s.seccionLabel}>{t("perfil.ubicacion")}</Text>
                        <View style={s.card}>
                            {usuario.pais && <FilaInfo icono="earth-outline" label={t("perfil.pais_label")} valor={usuario.pais} />}
                            {usuario.ciudad && usuario.pais && <View style={s.cardSep} />}
                            {usuario.ciudad && <FilaInfo icono="business-outline" label={t("perfil.ciudad_label")} valor={usuario.ciudad} />}
                        </View>
                    </>
                )}

                {/* Historial de check-ins */}
                {historial.length > 0 && (
                    <View style={s.seccionCard}>
                        <Text style={s.seccionTitulo}>{t("perfil.ultimos_checkins")}</Text>
                        {historial.slice(0, 5).map((c) => (
                            <View key={c.id} style={s.historialFila}>
                                <Text style={s.historialEmoji}>{c.icon_emoji || "🍺"}</Text>
                                <View style={s.historialInfo}>
                                    <Text style={s.historialNota} numberOfLines={1}>
                                        {c.note || t("perfil.sin_nota")}
                                    </Text>
                                    <Text style={s.historialFecha}>
                                        {new Date(c.created_at).toLocaleDateString("es-ES")}
                                        {c.precio ? `  ·  ${Number(c.precio).toFixed(2)} €` : ""}
                                    </Text>
                                </View>
                                {c.foto_url && (
                                    <Image source={{ uri: c.foto_url }} style={s.historialFoto} />
                                )}
                            </View>
                        ))}
                    </View>
                )}

                {/* Botón editar perfil */}
                <Pressable
                    style={({ pressed }) => [s.botonSecundario, pressed && { opacity: 0.7 }]}
                    onPress={() => {
                        setEditUsername(usuario.username || "");
                        setEditPais(usuario.pais || "");
                        setEditCiudad(usuario.ciudad || "");
                        setModalEditar(true);
                    }}
                >
                    <Ionicons name="create-outline" size={18} color="#10233E" />
                    <Text style={s.botonSecundarioTexto}>{t("perfil.editar_perfil")}</Text>
                </Pressable>

                {/* Botón eliminar cuenta */}
                <Pressable
                    style={({ pressed }) => [s.botonPeligro, pressed && { opacity: 0.7 }]}
                    onPress={handleEliminarCuenta}
                >
                    <Ionicons name="trash-outline" size={18} color="#C0392B" />
                    <Text style={s.botonPeligroTexto}>{t("perfil.eliminar_cuenta")}</Text>
                </Pressable>

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
                            <Text style={s.btnSalirTexto}>{t("perfil.cerrar_sesion")}</Text>
                          </>
                    }
                </Pressable>

                <Text style={s.version}>BeerMap v1.0</Text>
            </ScrollView>

            {/* Modal editar perfil */}
            <Modal visible={modalEditar} animationType="slide" transparent onRequestClose={() => setModalEditar(false)}>
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
                    <Pressable style={s.modalOverlay} onPress={() => setModalEditar(false)}>
                        <Pressable style={s.modalCard} onPress={() => {}}>
                            <Text style={s.modalTitulo}>{t("perfil.editar_perfil")}</Text>
                            <Text style={s.modalLabel}>{t("perfil.nombre_usuario_label")}</Text>
                            <TextInput
                                style={s.modalInput}
                                value={editUsername}
                                onChangeText={setEditUsername}
                                placeholder={t("perfil.nombre_usuario_label")}
                                placeholderTextColor="#8A8A8A"
                                autoCapitalize="none"
                                maxLength={30}
                            />
                            <Text style={s.modalLabel}>{t("perfil.pais_modal")}</Text>
                            <TextInput
                                style={s.modalInput}
                                value={editPais}
                                onChangeText={setEditPais}
                                placeholder={t("perfil.pais_modal")}
                                placeholderTextColor="#8A8A8A"
                                maxLength={80}
                            />
                            <Text style={s.modalLabel}>{t("perfil.ciudad_modal")}</Text>
                            <TextInput
                                style={s.modalInput}
                                value={editCiudad}
                                onChangeText={setEditCiudad}
                                placeholder={t("perfil.ciudad_modal")}
                                placeholderTextColor="#8A8A8A"
                                maxLength={80}
                            />
                            <Pressable
                                style={[s.modalBoton, guardandoPerfil && { opacity: 0.6 }]}
                                onPress={handleEditarPerfil}
                                disabled={guardandoPerfil}
                            >
                                {guardandoPerfil
                                    ? <ActivityIndicator color="#fff" />
                                    : <Text style={s.modalBotonTexto}>{t("perfil.guardar_cambios")}</Text>
                                }
                            </Pressable>
                            <Pressable style={s.modalCancelar} onPress={() => setModalEditar(false)}>
                                <Text style={s.modalCancelarTexto}>{t("perfil.cancelar")}</Text>
                            </Pressable>
                        </Pressable>
                    </Pressable>
                </KeyboardAvoidingView>
            </Modal>

            {/* Modal cambiar contraseña */}
            <Modal visible={modalPassword} animationType="slide" transparent onRequestClose={() => setModalPassword(false)}>
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
                    <Pressable style={s.passOverlay} onPress={() => setModalPassword(false)} />
                    <View style={s.passSheet}>
                        <Text style={s.passTitulo}>{t("perfil.cambiar_password")}</Text>

                        <TextInput
                            style={s.passInput}
                            placeholder={t("perfil.password_actual")}
                            placeholderTextColor="#9AAABB"
                            secureTextEntry
                            value={passActual}
                            onChangeText={setPassActual}
                            editable={!cambiandoPass}
                        />
                        <TextInput
                            style={s.passInput}
                            placeholder={t("perfil.password_nueva")}
                            placeholderTextColor="#9AAABB"
                            secureTextEntry
                            value={passNueva}
                            onChangeText={setPassNueva}
                            editable={!cambiandoPass}
                        />
                        <TextInput
                            style={s.passInput}
                            placeholder={t("perfil.confirmar_password")}
                            placeholderTextColor="#9AAABB"
                            secureTextEntry
                            value={passConfirmar}
                            onChangeText={setPassConfirmar}
                            editable={!cambiandoPass}
                        />

                        <Pressable
                            style={({ pressed }) => [s.passBtn, pressed && { opacity: 0.75 }]}
                            onPress={handleCambiarPassword}
                            disabled={cambiandoPass}
                        >
                            {cambiandoPass
                                ? <ActivityIndicator color="#FFFFFF" size="small" />
                                : <Text style={s.passBtnTexto}>{t("perfil.guardar_cambios")}</Text>
                            }
                        </Pressable>

                        <Pressable
                            style={({ pressed }) => [s.passCancelar, pressed && { opacity: 0.6 }]}
                            onPress={() => { setModalPassword(false); setPassActual(""); setPassNueva(""); setPassConfirmar(""); }}
                            disabled={cambiandoPass}
                        >
                            <Text style={s.passCancelarTexto}>{t("perfil.cancelar")}</Text>
                        </Pressable>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
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
    avatarWrap: {
        position: "relative",
        marginBottom: 14,
        shadowColor: "#10233E",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2, shadowRadius: 10, elevation: 4,
    },
    avatarCamara: {
        position: "absolute", bottom: 0, right: 0,
        width: 24, height: 24, borderRadius: 12,
        backgroundColor: "#10233E",
        justifyContent: "center", alignItems: "center",
        borderWidth: 2, borderColor: "#F7F4EC",
    },
    // Mantenido por compatibilidad aunque ya no se usa directamente
    avatar: {
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: "#10233E",
        justifyContent: "center", alignItems: "center",
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

    // Modal cambiar contraseña
    passOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
    passSheet: {
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        padding: 24, paddingBottom: 40, gap: 12,
    },
    passTitulo: { fontSize: 18, fontWeight: "700", color: "#10233E", marginBottom: 4 },
    passInput: {
        height: 48, borderRadius: 12,
        backgroundColor: "#F7F4EC",
        paddingHorizontal: 16,
        fontSize: 15, color: "#10233E",
        borderWidth: 1, borderColor: "#E8E4DC",
    },
    passBtn: {
        height: 52, borderRadius: 14,
        backgroundColor: "#10233E",
        justifyContent: "center", alignItems: "center",
        marginTop: 4,
    },
    passBtnTexto: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
    passCancelar: { alignItems: "center", paddingVertical: 10 },
    passCancelarTexto: { fontSize: 14, color: "#9AAABB" },

    // Botones de acción del perfil
    botonSecundario: {
        flexDirection: "row", alignItems: "center", justifyContent: "center",
        gap: 8, height: 48, borderRadius: 12, borderWidth: 1,
        borderColor: "#D0D7E3", backgroundColor: "#F8F9FB", marginBottom: 10,
    },
    botonSecundarioTexto: { fontSize: 15, fontWeight: "600", color: "#10233E" },
    botonPeligro: {
        flexDirection: "row", alignItems: "center", justifyContent: "center",
        gap: 8, height: 48, borderRadius: 12, borderWidth: 1,
        borderColor: "#F5C6C2", backgroundColor: "#FEF2F2", marginBottom: 10,
    },
    botonPeligroTexto: { fontSize: 15, fontWeight: "600", color: "#C0392B" },

    // Modal editar perfil
    modalOverlay: {
        flex: 1, backgroundColor: "rgba(0,0,0,0.45)",
        justifyContent: "flex-end",
    },
    modalCard: {
        backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20,
        padding: 24, paddingBottom: 40,
    },
    modalTitulo: { fontSize: 18, fontWeight: "700", color: "#10233E", marginBottom: 20 },
    modalLabel: { fontSize: 13, fontWeight: "600", color: "#10233E", marginBottom: 6 },
    modalInput: {
        height: 48, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10,
        paddingHorizontal: 14, fontSize: 15, color: "#10233E",
        backgroundColor: "#F8F9FB", marginBottom: 14,
    },
    modalBoton: {
        height: 50, backgroundColor: "#10233E", borderRadius: 12,
        justifyContent: "center", alignItems: "center", marginTop: 4,
    },
    modalBotonTexto: { color: "#fff", fontSize: 16, fontWeight: "700" },
    modalCancelar: { height: 44, justifyContent: "center", alignItems: "center", marginTop: 8 },
    modalCancelarTexto: { fontSize: 14, color: "#6B85A8" },

    // Selector de idioma
    idiomaOpciones: { flexDirection: "row", gap: 4 },
    idiomaBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: "#D0D7E3", backgroundColor: "#F8F9FB" },
    idiomaBtnActivo: { backgroundColor: "#10233E", borderColor: "#10233E" },
    idiomaBtnTexto: { fontSize: 13, fontWeight: "700" as const, color: "#6B85A8" },
    idiomaBtnTextoActivo: { color: "#FFFFFF" },

    // Historial de check-ins
    seccionCard: {
        backgroundColor: "#fff", borderRadius: 14, padding: 16,
        marginBottom: 16,
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    },
    seccionTitulo: { fontSize: 15, fontWeight: "700", color: "#10233E", marginBottom: 12 },
    historialFila: {
        flexDirection: "row", alignItems: "center", paddingVertical: 10,
        borderBottomWidth: 1, borderBottomColor: "#F0F2F5",
    },
    historialEmoji: { fontSize: 22, marginRight: 12 },
    historialInfo: { flex: 1 },
    historialNota: { fontSize: 14, fontWeight: "500", color: "#10233E" },
    historialFecha: { fontSize: 12, color: "#6B85A8", marginTop: 2 },
    historialFoto: { width: 44, height: 44, borderRadius: 8, marginLeft: 10 },
});