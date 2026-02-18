"""
Archivo para definir excepciones personalizadas del proyecto.

La idea es que, en lugar de usar siempre Exception genérico,
podamos crear errores propios con significado claro.

Esto hace que el código sea más limpio y profesional.
"""


class MenuNotFoundException(Exception):
    """
    Excepción que lanzaré cuando un bar no tenga menú guardado.

    Aunque ahora mismo no la estoy usando directamente,
    la dejo preparada para poder controlar mejor los errores
    sin depender solo de condiciones dentro del endpoint.
    """
    pass
