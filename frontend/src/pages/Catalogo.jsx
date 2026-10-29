// HU-01: catálogo con filtros por categoría, género y estado.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'

const CATEGORIAS = ['PS5', 'PS4', 'PS3', 'PS2', 'Máquinas', 'Mandos', 'PC y periféricos']
const GENEROS = [['accion', 'Acción'], ['aventura', 'Aventura'], ['deportes', 'Deportes'], ['carreras', 'Carreras'],
  ['shooter', 'Disparos'], ['pelea', 'Pelea'], ['rol', 'Rol'], ['terror', 'Terror'], ['familiar', 'Familiar']]
const ESTADOS = [['nuevo', 'Nuevo'], ['usado', 'Usado'], ['reacondicionado', 'Reacondicionado en taller']]

const soles = (n) => 'S/ ' + Number(n).toLocaleString('es-PE')

export default function Catalogo() {
  const [filtros, setFiltros] = useState({ categoria: '', genero: '', estado: '', q: '' })
  const [productos, setProductos] = useState([])
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true) // TT-03: mientras llega la respuesta del servidor

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
  const selector = 'rounded-lg border border-white/15 bg-superficie px-3 py-2 text-sm'

  return (
    <section>
      <h1 className="text-2xl font-bold">Catálogo</h1>
      <p className="mt-1 text-sm text-white/60">Datos de ejemplo cargados desde la base de datos.</p>

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

      {error && <p className="mt-4 rounded-lg bg-red-500/15 p-3 text-sm text-red-300">{error}</p>}
      {/* TT-03: el servidor gratuito se "duerme"; mientras despierta se avisa en lugar de mostrar "0 productos" */}
      {cargando
        ? <p className="mt-4 text-sm text-white/60">Cargando catálogo… La primera visita del día puede tardar hasta 1 minuto mientras el servidor despierta.</p>
        : <p className="mt-4 text-sm text-white/60">{productos.length} productos</p>}
      {!cargando && productos.length === 0 && filtros.q.trim().length >= 3 && (
        <p className="mt-2 rounded-lg border border-white/15 p-3 text-sm">
          No tenemos "{filtros.q.trim()}" por ahora. Le avisamos a la tienda que lo estás buscando;
          también puedes preguntar por WhatsApp.
        </p>
      )}

      <ul className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {productos.map((p) => (
          <li key={p.id}>
            <Link to={'/producto/' + p.id} className="block h-full rounded-xl border border-white/10 bg-superficie p-4 hover:border-rosa/60">
            <p className="text-xs uppercase tracking-wide text-white/50">{p.categoria} · {p.condicion || 'Nuevo'}</p>
            <h2 className="mt-1 font-semibold">{p.nombre}</h2>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-lg font-bold">{soles(p.precio_final)}</span>
              {p.descuento && <span className="text-sm text-white/50 line-through">{soles(p.precio)}</span>}
              {p.descuento && <span className="rounded bg-rosa px-1.5 text-xs font-semibold text-white">-{p.descuento}%</span>}
            </div>
            <p className="mt-2 text-sm text-white/70">
              {p.es_preventa ? 'Preventa' : p.stock > 0 ? p.stock + ' en stock' : 'Agotado'}
            </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}