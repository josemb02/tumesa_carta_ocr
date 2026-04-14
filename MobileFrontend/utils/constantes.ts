/*
 * =========================================================
 * CONFIGURACIÓN GLOBAL DE LA APP
 * =========================================================
 *
 * Este archivo centraliza constantes importantes para:
 * - evitar repetir valores en múltiples archivos
 * - facilitar cambios rápidos (como URLs)
 * - mantener el código limpio y mantenible
 */

/*
 * =========================================================
 * URL DEL BACKEND (PRODUCCIÓN)
 * =========================================================
 *
 * Ahora la app YA NO usa localhost ni IP local,
 * porque el backend está desplegado en Railway.
 *
 * Esto permite que:
 * - funcione desde móvil físico
 * - funcione desde cualquier red
 * - esté listo para producción real
 *
 * IMPORTANTE:
 * Si en el futuro tienes entorno dev/prod,
 * puedes cambiar esto dinámicamente con __DEV__.
 */

export const API_URL = "https://beermap-production.up.railway.app";

/*
 * =========================================================
 * CLAVE DE ALMACENAMIENTO DEL TOKEN
 * =========================================================
 *
 * Se usa para guardar el JWT en el dispositivo (AsyncStorage).
 *
 * Tenerlo como constante evita errores de escritura
 * y facilita cambios si en el futuro lo renombras.
 */

export const CLAVE_TOKEN = "beermap_token";

/*
 * Clave para guardar el refresh token en el dispositivo (AsyncStorage).
 * Se guarda por separado del access token para mayor claridad.
 */
export const CLAVE_REFRESH_TOKEN = "beermap_refresh_token";

/*
 * Clave para guardar en SecureStore si el usuario ya vio el onboarding.
 * Si existe y vale "true", no se muestra el onboarding al abrir la app.
 */
export const CLAVE_ONBOARDING_VISTO = "beernow_onboarding_visto";

/*
 * Clave para guardar en SecureStore el idioma elegido por el usuario.
 * Valores posibles: "es" | "en"
 */
export const CLAVE_IDIOMA = "beernow_idioma";