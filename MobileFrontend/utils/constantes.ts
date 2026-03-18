import { Platform } from "react-native";

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
 * Detecta automáticamente la plataforma:
 * - En web (navegador) usa localhost
 * - En móvil físico usa la IP local de la red
 */
const IP_LOCAL = "172.20.10.14";

export const API_URL = Platform.OS === "web"
    ? "http://localhost:8000"
    : `http://${IP_LOCAL}:8000`;

/*
 * Clave usada para guardar el token de sesión.
 *
 * Se deja como constante para no repetir strings sueltos.
 */
export const CLAVE_TOKEN = "beermap_token";