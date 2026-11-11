# Tatiana Guevara Boutique — imágenes y datos de productos

Este repositorio es la bandeja de entrada de imágenes del catálogo.

## Flujo de trabajo para Plantilla Oficial Boutique

Por cada prenda terminada:

1. Generar la imagen promocional final respetando la plantilla oficial de Tatiana Guevara Boutique.
2. Guardar la imagen en este repositorio, en la raíz o dentro de una carpeta por categoría. Usar un nombre único, descriptivo y sin espacios, por ejemplo `body-negro-tirantes-001.jpg`.
3. Actualizar `productos.json` agregando exactamente un registro por producto. No borrar los registros anteriores.
4. Verificar que el nombre/ruta del campo `imagen` coincida exactamente con el archivo subido.
5. No publicar directamente en el catálogo. El administrador importa los productos como borradores para revisión.

## Datos obligatorios

- `imagen`: ruta exacta del archivo de imagen en este repositorio.
- `nombre`: nombre claro del producto.
- `categoria`: una de las categorías oficiales listadas abajo.
- `precio_venta`: precio entero en COP. Calcular siempre como el precio tachado/lista de SHEIN menos 10%; no usar el precio promocional actual de SHEIN.
- `tallas`: arreglo de tallas disponibles. Si no se conocen, usar [] y no inventarlas.

También guardar `precio_lista_shein` cuando se conozca, para conservar la referencia del cálculo.

## Categorías válidas

- Blusas y Tops
- Bodies
- Corsetería
- Pantalones y Shorts
- Vestidos
- Conjuntos
- Ropa deportiva
- Vestidos de baño
- Pijamas
- Accesorios

## Estructura de productos.json

```json
{
  "version": 1,
  "productos": [
    {
      "imagen": "body-negro-tirantes-001.jpg",
      "nombre": "Body negro de tirantes",
      "categoria": "Bodies",
      "precio_lista_shein": 30000,
      "precio_venta": 27000,
      "tallas": ["S", "M", "L"]
    }
  ]
}
```

## Reglas importantes

- Mantener JSON válido y UTF-8.
- Un producto nuevo = una imagen nueva + un registro nuevo en `productos.json`.
- Nunca sobrescribir una imagen existente; usar nombres únicos.
- No inventar precios, tallas, nombres ni categorías. Si falta un dato, indicarlo y no completar con suposiciones.
- No añadir precios ni textos comerciales a la imagen promocional de Instagram.
- La imagen debe ser la versión final de la plantilla oficial, no una foto fuente sin diseñar.
- No eliminar imágenes ni registros anteriores.
