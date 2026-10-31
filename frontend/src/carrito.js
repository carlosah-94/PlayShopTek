// Carrito guardado en el navegador (localStorage): sobrevive si recargas la página.
// Solo guarda qué productos y cuántos; el precio final lo calcula el servidor al pagar.
const CLAVE = 'psk-carrito'

export function leerCarrito() {
  try { return JSON.parse(localStorage.getItem(CLAVE)) || [] } catch { return [] }
}

function guardar(items) {
  localStorage.setItem(CLAVE, JSON.stringify(items))
  window.dispatchEvent(new Event('carrito')) // avisa al menú para que actualice el contador
}

export function agregarAlCarrito(p) {
  const items = leerCarrito()
  const ya = items.find((i) => i.id === p.id)
  if (ya) ya.cantidad = Math.min(ya.cantidad + 1, p.stock, 5)
  else items.push({ id: p.id, nombre: p.nombre, precio: Number(p.precio_final), stock: p.stock, cantidad: 1, foto: p.foto || null }) // HU-26: con foto
  guardar(items)
}

export function cambiarCantidad(id, cantidad) {
  guardar(leerCarrito().map((i) => (i.id === id ? { ...i, cantidad } : i)).filter((i) => i.cantidad > 0))
}

export function vaciarCarrito() { guardar([]) }

export const unidades = (items) => items.reduce((s, i) => s + i.cantidad, 0)

// HU-26: lo que se añadió antes de guardar la foto (o en otra versión de la tienda) la recupera del catálogo
export function completarFotos(productos) {
  const items = leerCarrito()
  const foto = Object.fromEntries(productos.map((p) => [p.id, p.foto]))
  if (!items.some((i) => !i.foto && foto[i.id])) return
  guardar(items.map((i) => (i.foto ? i : { ...i, foto: foto[i.id] || null })))
}
