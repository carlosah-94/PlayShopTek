// HU-25: panel grande que se abre al pasar el mouse por una categoría del inicio (como el prototipo):
// sus géneros (o generación, consola, tipo) con cuántos productos tiene cada uno, y un producto "Destacado".
import { Link } from 'react-router-dom'
import { urlImagen } from '../api.js'
import { ES_JUEGO, etiquetaCategoria } from './FiltrosCatalogo.jsx'
import Icono from './Iconos.jsx'

const soles = (n) => 'S/ ' + Number(n).toLocaleString('es-PE')
const ESTADOS = [['nuevo', 'Nuevo sellado'], ['usado', 'Usado'], ['reacondicionado', 'Reacondicionado en taller']]

// Grupos de enlaces según la categoría; cada opción es [parámetros del catálogo, texto, cuántos hay]
function grupos(cat, ps, generos) {
  const contar = (f) => ps.filter(f).length
  const armar = (titulo, opciones) => ({ titulo, items: opciones.filter((o) => o[2] > 0) })
  const estado = armar('Por estado', ESTADOS.map(([k, t]) => [{ estado: k }, t, contar((p) => p.grupo_condicion === k)]))
  if (ES_JUEGO(cat)) {
    const gen = Object.entries(generos).map(([id, t]) => [{ genero: id }, t, contar((p) => p.generos.includes(id))]).sort((a, b) => b[2] - a[2])
    return [armar('Por género', gen.slice(0, 8)), estado]
  }
  const plataformas = (t) => armar(t, ['PS5', 'PS4', 'PS3', 'PS2'].map((x) => [{ plataforma: x }, x, contar((p) => p.plataforma === x)]))
  if (cat === 'Máquinas') return [plataformas('Por generación'), estado]
  if (cat === 'Mandos') {
    return [plataformas('Por consola'), armar('Por tipo', [[{ origen: 'Original' }, 'Originales Sony', contar((p) => p.origen === 'Original')],
      [{ origen: 'Genérico' }, 'Genéricos', contar((p) => p.origen === 'Genérico')]]), estado]
  }
  return [armar('Por tipo', ['Teclados', 'Mouse', 'Monitores', 'Audífonos', 'Componentes'].map((x) => [{ sub: x }, x, contar((p) => p.subcategoria === x)])), estado]
}

export default function MenuCategoria({ cat, icono, productos, generos }) {
  const ps = productos.filter((p) => p.categoria === cat)
  const enlace = (extra = {}) => '/catalogo?' + new URLSearchParams({ categoria: cat, ...extra })
  // Destacado: lo que se puede comprar hoy, primero lo que está en oferta y luego lo mejor calificado
  const d = ps.filter((p) => p.stock > 0 && !p.es_preventa)
    .sort((a, b) => (b.descuento || 0) - (a.descuento || 0) || (b.calificacion || 0) - (a.calificacion || 0))[0]

  return (
    <div className="flex h-full gap-5 rounded-2xl border border-tinta/10 bg-superficie p-5 shadow-2xl">
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="mb-1 flex items-center gap-3 text-xl font-medium">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-rosa/10 text-rosa"><Icono nombre={icono} tam={18} /></span>
          {etiquetaCategoria(cat)}
        </p>
        <p className="mb-3 text-sm text-tinta/60">{ps.length} productos · {ps.filter((p) => p.stock > 0).length} con stock hoy</p>
        <div className="grid flex-1 content-start gap-x-6 gap-y-4 sm:grid-cols-2">
          {grupos(cat, ps, generos).filter((g) => g.items.length).map((g) => (
            <div key={g.titulo}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-morado">{g.titulo}</p>
              <ul>
                {g.items.map(([params, texto, n]) => (
                  <li key={texto}>
                    <Link to={enlace(params)} className="flex justify-between rounded-md px-2 py-1.5 text-sm hover:bg-rosa/10">
                      <span>{texto}</span><span className="text-xs tabular-nums text-tinta/60">{n}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <Link to={enlace()} className="mt-3 inline-flex w-fit items-center gap-2 rounded-lg bg-gradient-to-r from-rosa to-[#8b2fd9] px-4 py-2 text-sm font-semibold text-white">
          Ver todo en {etiquetaCategoria(cat)} <Icono nombre="flechaDer" tam={14} />
        </Link>
      </div>
      {d && (
        <Link to={'/producto/' + d.id} className="flex w-44 shrink-0 flex-col rounded-xl border border-tinta/10 bg-morado/5 p-3 hover:border-rosa/40">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-morado">Destacado</p>
          <div className="relative">
            {d.foto && <img src={urlImagen(d.foto)} alt="" className="aspect-[3/4] w-full rounded-lg bg-white object-contain" />}
            {d.descuento && <span className="absolute left-1 top-1 rounded-full bg-rosa px-2 py-0.5 text-xs font-semibold text-white">-{d.descuento}%</span>}
          </div>
          <p className="mt-2 text-sm font-medium leading-snug">{d.nombre}</p>
          <p className="text-sm"><b>{soles(d.precio_final)}</b> {d.descuento && <span className="text-xs text-tinta/60 line-through">{soles(d.precio)}</span>}</p>
          <p className="mt-1 text-xs text-rosa">{d.descuento ? '⚡ En oferta' : '★ Mejor valorado'}</p>
        </Link>
      )}
    </div>
  )
}
