/*
 * Este archivo guarda las constantes globales de la app.
 *
 * Se centralizan aquí para:
 * - no repetir valores en muchos archivos
 * - poder cambiar la configuración rápido
 * - dejar la app más limpia y mantenible
 */

/*
 * URL base del backend.
 *
 * IMPORTANTE:
 * - si pruebas en móvil físico, "localhost" no sirve
 * - debes poner la IP local de tu ordenador en la red
 * - si pruebas en emulador Android, a veces se usa 10.0.2.2
 *
 * De momento se deja aquí centralizado para cambiarlo fácil.
 */
export const API_URL = "http://localhost:8000";

/*
 * Clave usada para guardar el token de sesión.
 *
 * Se deja como constante para no repetir strings sueltos.
 */
export const CLAVE_TOKEN = "beermap_token";