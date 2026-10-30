// Pequeño ayudante para hablar con el backend.
// En producción (Vercel) VITE_API_URL apunta a Render; en desarrollo queda vacío y usa el proxy.
const BASE = import.meta.env.VITE_API_URL || ''

// HU-24: las fotos que sube Ángel viven en el servidor (/api/imagenes/15); las demás, en Vercel (/productos/p1-1.webp)
export const urlImagen = (u) => (u && u.startsWith('/api/') ? BASE + u : u)

export function guardarSesion(datos) { localStorage.setItem('psk-sesion', JSON.stringify(datos)) }
export function leerSesion() { try { return JSON.parse(localStorage.getItem('psk-sesion')) } catch { return null } }
export function cerrarSesion() { localStorage.removeItem('psk-sesion') }

export async function api(ruta, { metodo = 'GET', cuerpo } = {}) {
  const sesion = leerSesion()
  const r = await fetch(BASE + '/api' + ruta, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(sesion ? { Authorization: 'Bearer ' + sesion.access_token } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  })
  const datos = await r.json().catch(() => ({}))
  if (!r.ok) {
    // FastAPI manda un texto ("Correo o contraseña incorrectos.") o, si el formato no cuadra, una lista de errores
    const mensaje = typeof datos.detail === 'string' ? datos.detail
      : datos.detail ? 'Revisa los datos: hay un campo con formato incorrecto.' : 'Algo salió mal (' + r.status + ')'
    throw new Error(mensaje)
  }
  return datos
}