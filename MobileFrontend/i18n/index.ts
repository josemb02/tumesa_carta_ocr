/*
 * i18n/index.ts
 * Configuración central de internacionalización de BeerNow.
 *
 * Estructura:
 *   i18n/
 *     locales/
 *       es.ts   — traducciones en español
 *       en.ts   — traducciones en inglés
 *     index.ts  — este archivo: configuración, hooks y helpers
 *
 * Uso en componentes:
 *   import { useT } from "../../i18n";
 *   const t = useT();
 *   <Text>{t("login.titulo")}</Text>
 *
 * Cambiar idioma:
 *   import { cambiarIdioma } from "../../i18n";
 *   await cambiarIdioma("en");
 */

import { I18n } from "i18n-js";
import * as Localization from "expo-localization";
import * as SecureStore from "expo-secure-store";
import { useState, useEffect, useCallback } from "react";
import es from "./locales/es";
import en from "./locales/en";
import { CLAVE_IDIOMA } from "../utils/constantes";

// Instancia global de i18n con los dos idiomas soportados
const i18n = new I18n({ es, en });
i18n.defaultLocale = "es";
i18n.enableFallback = true;
i18n.locale = "es";

/*
 * Inicializa el idioma al arrancar la app.
 * Primero comprueba si el usuario eligió idioma manualmente (guardado en SecureStore).
 * Si no, usa el idioma del sistema operativo del dispositivo.
 */
export async function inicializarIdioma(): Promise<void> {
    try {
        const guardado = await SecureStore.getItemAsync(CLAVE_IDIOMA);
        if (guardado === "es" || guardado === "en") {
            // El usuario ya eligió idioma anteriormente — respetar su elección
            i18n.locale = guardado;
        } else {
            // Primera vez: detectar idioma del sistema
            const locale = Localization.getLocales()[0]?.languageCode ?? "es";
            i18n.locale = locale.startsWith("en") ? "en" : "es";
        }
    } catch {
        // Si falla SecureStore, usar español como fallback seguro
        i18n.locale = "es";
    }
}

/*
 * Cambia el idioma activo, lo persiste en SecureStore y notifica
 * a todos los componentes suscritos para que se re-rendericen.
 */
type IdiomaListener = () => void;
const listeners = new Set<IdiomaListener>();

export async function cambiarIdioma(codigo: "es" | "en"): Promise<void> {
    i18n.locale = codigo;
    try {
        await SecureStore.setItemAsync(CLAVE_IDIOMA, codigo);
    } catch {
        // Fallo silencioso: el cambio de idioma funciona aunque no se persista
    }
    // Notificar a todos los componentes suscritos para que se actualicen
    listeners.forEach(fn => fn());
}

/*
 * Devuelve el código del idioma activo ("es" o "en").
 */
export function obtenerIdioma(): "es" | "en" {
    return (i18n.locale.startsWith("en") ? "en" : "es") as "es" | "en";
}

/*
 * Hook que devuelve la función de traducción t().
 * Se re-renderiza automáticamente cuando cambia el idioma,
 * por lo que el cambio de idioma se refleja al instante en toda la app.
 *
 * Uso:
 *   const t = useT();
 *   t("login.titulo") // → "Inicia sesión" o "Sign in"
 */
export function useT(): (key: string, options?: object) => string {
    const [, forzarRender] = useState(0);

    useEffect(() => {
        // Suscribirse a cambios de idioma para re-renderizar este componente
        const actualizar = () => forzarRender(n => n + 1);
        listeners.add(actualizar);
        return () => { listeners.delete(actualizar); };
    }, []);

    return useCallback(
        (key: string, options?: object) => i18n.t(key, options),
        // La dependencia en i18n.locale garantiza que el callback se regenere al cambiar idioma
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [i18n.locale]
    );
}

export default i18n;
