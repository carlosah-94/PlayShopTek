// HU-01: catálogo con filtros por categoría, género y estado.
// HU-25: como el prototipo: panel de filtros a la izquierda (con cuántos productos hay en cada opción)
// y "Ordenar por" arriba. Los filtros viven en el enlace (/catalogo?categoria=PS5&genero=accion),
// así el menú de categorías del inicio y el buscador de la cabecera llegan con el filtro ya puesto.
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import FiltrosCatalogo, { etiquetaCategoria, pasa } from '../components/FiltrosCatalogo.jsx'
import TarjetaProducto from '../components/TarjetaProducto.jsx'
import { useFavoritos } from '../favoritos.js'

const CLAVES = ['q', 'categoria', 'disp', 'genero', 'estado', 'plataforma', 'sub', 'origen']
const ORDENES = [['recomendado', 'Recomendado para ti'], ['precio-asc', 'Precio: menor a mayor'], ['precio-desc', 'Precio: mayor a menor'],
  ['valorados', 'Mejor valorados'], ['ofertas', 'Ofertas primero']]

// "Recomendado": primero lo que se puede comprar hoy, luego lo que está en oferta y lo mejor calificado
const ordenar = (lista, orden) => [...lista].sort((a, b) => {
  if (orden === 'precio-asc') return a.precio_final - b.precio_final
  if (orden === 'precio-desc') return b.precio_final - a.precio_final
  if (orden === 'valorados') return (b.calificacion || 0) - (a.calificacion || 0)
  if (orden === 'ofertas') return (b.descuento || 0) - (a.descuento || 0)
  return (b.stock > 0) - (a.stock > 0) || (!!b.descuento - !!a.descuento) || (b.calificacion || 0) - (a.calificacion || 0)
})

export default function Catalogo() {
  const [parametros, setParametros] = useSearchParams()
  const v = Object.fromEntries(CLAVES.map((k) => [k, parametros.get(k) || '']))
  const orden = parametros.get('orden') || 'recomendado'
  const [productos, setProductos] = useState(null) // null = cargando
  const [generos, setGeneros] = useState({}) // { accion: 'Acción', ... }
  const [error, setError] = useState('')
  const [favoritos, alternarFavorito] = useFavoritos()

  useEffect(() => {
    api('/productos').then(setProductos).catch((e) => setError(e.message))
    api('/generos').then((gs) => setGeneros(Object.fromEntries(gs.map((g) => [g.id, g.nombre])))).catch(() => {})
  }, [])

  // Cambia uno o varios filtros en el enlace (sin llenar el historial del navegador)
  const poner = (cambios) => {
    const nuevo = new URLSearchParams(parametros)
    Object.entries(cambios).forEach(([k, valor]) => (valor ? nuevo.set(k, valor) : nuevo.delete(k)))
    setParametros(nuevo, { replace: true })
  }
  const limpiar = () => setParametros(v.q ? { q: v.q } : {}, { replace: true })

  const visibles = productos ? ordenar(productos.filter((p) => pasa(p, v)), orden) : []

  // HU-11: si la búsqueda no trae nada, se avisa a la tienda. Espera 1.5 s sin escribir
  // para no guardar cada letra ("g", "gt", "gta"...) sino la búsqueda completa.
  useEffect(() => {
    const texto = v.q.trim()
    if (!productos || texto.length < 3 || visibles.length > 0) return
    const espera = setTimeout(() => api('/intereses', { metodo: 'POST', cuerpo: { texto } }).catch(() => {}), 1500)
    return () => clearTimeout(espera)
  }, [v.q, productos, visibles.length])

  const titulo = v.categoria ? etiquetaCategoria(v.categoria) : 'Catálogo completo'
  const conStock = visibles.filter((p) => p.stock > 0).length

  return (
    <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
      <FiltrosCatalogo productos={productos || []} v={v} poner={poner} limpiar={limpiar} generos={generos} />

      <section className="min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold">{titulo}</h1>
            {/* TT-03: el servidor gratuito se "duerme"; mientras despierta se avisa en lugar de mostrar "0 productos" */}
            <p className="mt-1 text-sm text-tinta/60">
              {productos ? `${visibles.length} productos · ${conStock} con stock hoy` : 'Cargando catálogo…'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input id="catalogo-buscar" type="search" placeholder="Buscar en el catálogo…" value={v.q} onChange={(e) => poner({ q: e.target.value })}
              aria-label="Buscar en el catálogo" className="w-56 rounded-lg border border-tinta/15 bg-superficie px-3 py-2 text-sm" />
            <label className="flex items-center gap-2 text-sm text-tinta/70">Ordenar por
              <select id="catalogo-orden" value={orden} onChange={(e) => poner({ orden: e.target.value === 'recomendado' ? '' : e.target.value })}
                className="rounded-lg border border-tinta/15 bg-superficie px-3 py-2 text-sm text-tinta">
                {ORDENES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
              </select>
            </label>
          </div>
        </div>

        {error && <p className="mt-4 rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}
        {productos && visibles.length === 0 && (
          <p className="mt-4 rounded-lg border border-tinta/15 p-3 text-sm">
            {v.q.trim().length >= 3
              ? <>No tenemos "{v.q.trim()}" por ahora. Le avisamos a la tienda que lo estás buscando; también puedes preguntar por WhatsApp.</>
              : 'No hay productos con esos filtros.'}
          </p>
        )}

        <h2 className="sr-only">Productos</h2>
        <ul className={'mt-4 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4 lg:grid-cols-3' + (productos ? '' : ' min-h-screen content-start')}>
          {productos
            ? visibles.map((p, i) => (
              // Rendimiento: las 2 primeras tarjetas son las que se ven sin bajar, en celular y en computadora
              <li key={p.id}><TarjetaProducto p={p} prioridad={i < 2} favorito={favoritos.has(p.id)} onFavorito={alternarFavorito} /></li>
            ))
            // Mientras carga se reserva el espacio de las tarjetas (así la página no "salta"); el aviso va dentro
            : [1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <li key={'carga-' + n} className="grid h-[480px] animate-pulse sm:h-[570px] lg:h-[490px] place-items-center rounded-2xl bg-tinta/5 p-4 text-center text-xs text-tinta/70">
                {n === 1 && 'La primera visita del día puede tardar hasta 1 minuto mientras el servidor despierta.'}
              </li>
            ))}
        </ul>
      </section>
    </div>
  )
}
