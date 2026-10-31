// HU-25: panel de "Filtros" a la izquierda del catálogo y de las ofertas, como el prototipo.
// Muestra cuántos productos hay en cada opción; las opciones del medio cambian según la categoría
// (géneros para juegos, generación para consolas, consola y tipo para mandos, tipo para PC).
import { useState } from 'react'
import Icono from './Iconos.jsx'

export const CATEGORIAS = ['PS2', 'PS3', 'PS4', 'PS5', 'Máquinas', 'Mandos', 'PC y periféricos']
export const ES_JUEGO = (c) => /^PS\d$/.test(c)
export const etiquetaCategoria = (c) => (ES_JUEGO(c) ? 'Juegos ' + c : c)
const ESTADOS = [['nuevo', 'Nuevo'], ['usado', 'Usado'], ['reacondicionado', 'Reacondicionado en taller']]

// ¿El producto pasa todos los filtros? (los usan el catálogo, las ofertas y los conteos)
export function pasa(p, v, sin = '') {
  const q = (v.q || '').trim().toLowerCase()
  return (!q || p.nombre.toLowerCase().includes(q)) &&
    (sin === 'categoria' || !v.categoria || p.categoria === v.categoria) &&
    (sin === 'disp' || !v.disp || (v.disp === 'stock' ? p.stock > 0 && !p.es_preventa : p.es_preventa)) &&
    (sin === 'genero' || !v.genero || p.generos.includes(v.genero)) &&
    (sin === 'estado' || !v.estado || p.grupo_condicion === v.estado) &&
    (sin === 'plataforma' || !v.plataforma || p.plataforma === v.plataforma) &&
    (sin === 'sub' || !v.sub || p.subcategoria === v.sub) &&
    (sin === 'origen' || !v.origen || p.origen === v.origen)
}

function Grupo({ titulo, children }) {
  return (
    <fieldset className="space-y-1 border-t border-tinta/10 pt-3">
      <legend className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-morado">{titulo}</legend>
      {children}
    </fieldset>
  )
}

// Botón de una opción con su número (las categorías y los géneros)
function Opcion({ activo, onClick, texto, n }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={activo}
      className={'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ' +
        (activo ? 'border-rosa/50 bg-rosa/15 font-semibold' : 'border-tinta/10 bg-superficie hover:bg-tinta/5')}>
      <span>{texto}</span><span className="text-xs tabular-nums text-tinta/75">{n}</span>
    </button>
  )
}

// Opción tipo "radio" (una sola a la vez)
function Radio({ nombre, activo, onChange, texto, n }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-1 text-sm">
      <input type="radio" name={nombre} checked={activo} onChange={onChange} className="accent-[#cc19ab]" />
      <span className="flex-1">{texto}</span>{n !== undefined && <span className="text-xs tabular-nums text-tinta/60">{n}</span>}
    </label>
  )
}

export default function FiltrosCatalogo({ productos, v, poner, limpiar, generos }) {
  const [abierto, setAbierto] = useState(false) // en celular
  const cuantos = (k, valor) => productos.filter((p) => pasa(p, { ...v, [k]: valor }, '')).length
  const c = v.categoria
  const activos = ['categoria', 'disp', 'genero', 'estado', 'plataforma', 'sub', 'origen'].filter((k) => v[k]).length

  // Opciones del medio según la categoría elegida (solo las que tienen productos)
  const conProductos = (k, lista) => lista.map(([valor, texto]) => [valor, texto, cuantos(k, valor)]).filter((x) => x[2] > 0 || v[k] === x[0])
  const deJuegos = !c || ES_JUEGO(c)
  const listaGeneros = deJuegos ? conProductos('genero', Object.entries(generos)).sort((a, b) => b[2] - a[2]) : []

  const panel = (
    <div className="space-y-3 rounded-2xl border border-tinta/10 bg-superficie p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 font-medium"><Icono nombre="ajustes" tam={16} /> Filtros</p>
        {activos > 0 && <button type="button" onClick={limpiar} className="text-sm font-semibold text-rosa hover:underline">Limpiar</button>}
      </div>

      <Grupo titulo="Categoría">
        <Opcion activo={!c} onClick={() => poner({ categoria: '', genero: '', plataforma: '', sub: '', origen: '' })} texto="Todos" n={cuantos('categoria', '')} />
        {CATEGORIAS.map((cat) => (
          <Opcion key={cat} activo={c === cat} texto={etiquetaCategoria(cat)} n={cuantos('categoria', cat)}
            onClick={() => poner({ categoria: c === cat ? '' : cat, genero: '', plataforma: '', sub: '', origen: '' })} />
        ))}
      </Grupo>

      <Grupo titulo="Disponibilidad">
        {[['', 'Todos'], ['stock', 'Solo con stock'], ['preventa', 'En preventa']].map(([valor, texto]) => (
          <Radio key={texto} nombre="disp" activo={(v.disp || '') === valor} onChange={() => poner({ disp: valor })} texto={texto} />
        ))}
      </Grupo>

      {listaGeneros.length > 0 && (
        <Grupo titulo="Género">
          <Radio nombre="genero" activo={!v.genero} onChange={() => poner({ genero: '' })} texto="Todos" />
          {listaGeneros.map(([id, texto, n]) => <Radio key={id} nombre="genero" activo={v.genero === id} onChange={() => poner({ genero: id })} texto={texto} n={n} />)}
        </Grupo>
      )}
      {(c === 'Máquinas' || c === 'Mandos') && (
        <Grupo titulo={c === 'Máquinas' ? 'Generación' : 'Para la consola'}>
          <Radio nombre="plataforma" activo={!v.plataforma} onChange={() => poner({ plataforma: '' })} texto="Todas" />
          {conProductos('plataforma', ['PS5', 'PS4', 'PS3', 'PS2'].map((x) => [x, x])).map(([x, t, n]) => (
            <Radio key={x} nombre="plataforma" activo={v.plataforma === x} onChange={() => poner({ plataforma: x })} texto={t} n={n} />
          ))}
        </Grupo>
      )}
      {c === 'Mandos' && (
        <Grupo titulo="Tipo">
          <Radio nombre="origen" activo={!v.origen} onChange={() => poner({ origen: '' })} texto="Todos" />
          {conProductos('origen', [['Original', 'Originales Sony'], ['Genérico', 'Genéricos']]).map(([x, t, n]) => (
            <Radio key={x} nombre="origen" activo={v.origen === x} onChange={() => poner({ origen: x })} texto={t} n={n} />
          ))}
        </Grupo>
      )}
      {c === 'PC y periféricos' && (
        <Grupo titulo="Tipo">
          <Radio nombre="sub" activo={!v.sub} onChange={() => poner({ sub: '' })} texto="Todos" />
          {conProductos('sub', ['Teclados', 'Mouse', 'Monitores', 'Audífonos', 'Componentes'].map((x) => [x, x])).map(([x, t, n]) => (
            <Radio key={x} nombre="sub" activo={v.sub === x} onChange={() => poner({ sub: x })} texto={t} n={n} />
          ))}
        </Grupo>
      )}

      <Grupo titulo="Estado">
        <Radio nombre="estado" activo={!v.estado} onChange={() => poner({ estado: '' })} texto="Todos" />
        {conProductos('estado', ESTADOS).map(([x, t, n]) => (
          <Radio key={x} nombre="estado" activo={v.estado === x} onChange={() => poner({ estado: x })} texto={t} n={n} />
        ))}
      </Grupo>
    </div>
  )

  return (
    <>
      {/* Celular: un botón abre los filtros encima de la lista */}
      <div className="lg:hidden">
        <button type="button" onClick={() => setAbierto(!abierto)} aria-expanded={abierto}
          className="inline-flex items-center gap-2 rounded-lg border border-tinta/15 bg-superficie px-3 py-2 text-sm font-semibold">
          <Icono nombre="ajustes" tam={16} /> Filtros{activos > 0 ? ` (${activos})` : ''}
        </button>
        {abierto && <div className="mt-3">{panel}</div>}
      </div>
      <aside aria-label="Filtros" className="hidden lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">{panel}</aside>
    </>
  )
}
