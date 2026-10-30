// HU-01: catálogo con filtros por categoría, género y estado.
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import TarjetaProducto from '../components/TarjetaProducto.jsx'
import { useFavoritos } from '../favoritos.js'

const CATEGORIAS = ['PS5', 'PS4', 'PS3', 'PS2', 'Máquinas', 'Mandos', 'PC y periféricos']
const GENEROS = [['accion', 'Acción'], ['aventura', 'Aventura'], ['deportes', 'Deportes'], ['carreras', 'Carreras'],
  ['shooter', 'Disparos'], ['pelea', 'Pelea'], ['rol', 'Rol'], ['terror', 'Terror'], ['familiar', 'Familiar']]
const ESTADOS = [['nuevo', 'Nuevo'], ['usado', 'Usado'], ['reacondicionado', 'Reacondicionado en taller']]

export default function Catalogo() {
  // HU-20: la búsqueda y la categoría pueden llegar en el enlace (ej. /catalogo?q=fifa desde el buscador de la cabecera)
  const [parametros] = useSearchParams()
  const [filtros, setFiltros] = useState(() => ({
    categoria: parametros.get('categoria') || '', genero: '', estado: '', q: parametros.get('q') || '',
  }))
  const [productos, setProductos] = useState([])
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true) // TT-03: mientras llega la respuesta del servidor
  // HU-21: corazón de favoritos (HU-22: la lógica se movió a favoritos.js para usarla también en Inicio)
  const [favoritos, alternarFavorito] = useFavoritos()

  // Si se busca otra vez desde la cabecera estando ya en el catálogo, se actualizan los filtros
  useEffect(() => {
    const q = parametros.get('q') || ''
    const categoria = parametros.get('categoria') || ''
    setFiltros((f) => (f.q === q && f.categoria === categoria ? f : { ...f, q, categoria }))
  }, [parametros])

  useEffect(() => {
    const params = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v))
    setCargando(true)
    api('/productos?' + params).then(setProductos).catch((e) => setError(e.message)).finally(() => setCargando(false))
  }, [filtros])

  // HU-11: si la búsqueda no trae nada, se avisa a la tienda. Espera 1.5 s sin escribir
  // para no guardar cada letra ("g", "gt", "gta"...) sino la búsqueda completa.
  useEffect(() => {
    const texto = filtros.q.trim()
    if (texto.length < 3 || productos.length > 0) return
    const espera = setTimeout(() => api('/intereses', { metodo: 'POST', cuerpo: { texto } }).catch(() => {}), 1500)
    return () => clearTimeout(espera)
  }, [productos, filtros.q])

  const cambiar = (k) => (e) => setFiltros({ ...filtros, [k]: e.target.value })
  const selector = 'rounded-lg border border-tinta/15 bg-superficie px-3 py-2 text-sm'

  return (
    <section>
      <h1 className="text-3xl font-semibold">Catálogo completo</h1>
      <p className="mt-1 text-sm text-tinta/60">Juegos, consolas, mandos y accesorios de la tienda.</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <input placeholder="Buscar..." value={filtros.q} onChange={cambiar('q')} className={selector} />
        <select aria-label="Categoría" value={filtros.categoria} onChange={cambiar('categoria')} className={selector}>
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select aria-label="Género" value={filtros.genero} onChange={cambiar('genero')} className={selector}>
          <option value="">Todos los géneros</option>
          {GENEROS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select aria-label="Estado" value={filtros.estado} onChange={cambiar('estado')} className={selector}>
          <option value="">Cualquier estado</option>
          {ESTADOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-500/15 p-3 text-sm text-error">{error}</p>}
      {/* TT-03: el servidor gratuito se "duerme"; mientras despierta se avisa en lugar de mostrar "0 productos" */}
      {cargando
        ? <p className="mt-4 text-sm text-tinta/60">Cargando catálogo… La primera visita del día puede tardar hasta 1 minuto mientras el servidor despierta.</p>
        : <p className="mt-4 text-sm text-tinta/60">{productos.length} productos</p>}
      {!cargando && productos.length === 0 && filtros.q.trim().length >= 3 && (
        <p className="mt-2 rounded-lg border border-tinta/15 p-3 text-sm">
          No tenemos "{filtros.q.trim()}" por ahora. Le avisamos a la tienda que lo estás buscando;
          también puedes preguntar por WhatsApp.
        </p>
      )}

      <h2 className="sr-only">Productos</h2>
      <ul className="mt-2 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {productos.map((p) => (
          <li key={p.id}>
            <TarjetaProducto p={p} favorito={favoritos.has(p.id)} onFavorito={alternarFavorito} />
          </li>
        ))}
      </ul>
    </section>
  )
}