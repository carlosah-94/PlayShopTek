// HU-22: el corazón de favoritos, compartido por el catálogo y la página de inicio.
// Solo funciona con cuenta de cliente; sin cuenta, el corazón lleva a iniciar sesión.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, leerSesion } from './api.js'

export function useFavoritos() {
  const esCliente = leerSesion()?.usuario.rol === 'cliente'
  const navegar = useNavigate()
  const [favoritos, setFavoritos] = useState(new Set())

  useEffect(() => {
    if (esCliente) api('/mi/favoritos').then((fs) => setFavoritos(new Set(fs.map((f) => f.id)))).catch(() => {})
  }, [esCliente])

  const alternar = async (p) => {
    if (!esCliente) return navegar('/login')
    const es = favoritos.has(p.id)
    await api('/mi/favoritos/' + p.id, { metodo: es ? 'DELETE' : 'PUT' })
    const nuevo = new Set(favoritos)
    if (es) nuevo.delete(p.id); else nuevo.add(p.id)
    setFavoritos(nuevo)
  }

  return [favoritos, alternar]
}
