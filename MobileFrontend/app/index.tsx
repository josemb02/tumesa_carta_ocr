import { Image, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { usarAuth } from "../contexto/ContextoAuth";

/*
 * Pantalla de entrada de la app.
 *
 * Único responsable: decidir si el usuario va al mapa o al login.
 *
 * Patrón oficial de expo-router para auth-gating:
 *   - usar <Redirect> en lugar de useRouter() + useEffect
 *   - <Redirect> no añade hooks propios, elimina la fuente del crash
 *
 * POR QUÉ se reescribió:
 *   El código anterior llamaba a useRouter() tras usarAuth().
 *   useRouter() usa hooks internos cuyo número varía según el estado
 *   de navegación de expo-router, lo que desplazaba el useRef de posición
 *   entre renders y disparaba "Rules of Hooks:
 *   Previous render: useContext / Next render: useRef".
 */
export default function Index() {
    // ÚNICO hook del componente — siempre se llama en primer lugar,
    // nunca dentro de un if, nunca después de un return temprano.
    const { usuario, cargando } = usarAuth();

    // Mientras la sesión carga mostramos el logo como splash screen
    if (cargando) {
        return (
            <View style={styles.contenedor}>
                <Image
                    source={require("../assets/imagenes/BeerNow_marca_Logo.png")}
                    style={styles.logo}
                    resizeMode="contain"
                />
            </View>
        );
    }

    // Sesión resuelta — Redirect navega sin añadir hooks extra
    return <Redirect href={usuario ? "/(principal)/mapa" : "/login"} />;
}

const styles = StyleSheet.create({
    contenedor: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#F7F4EC",
    },
    logo: {
        width: 240,
        height: 140,
    },
});
