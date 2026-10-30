// HU-24: piezas que se repiten en todas las secciones del panel (encabezado, tarjetas, etiquetas de estado, filtros).
// Así cada página se ve igual al prototipo sin repetir las mismas clases una y otra vez.
import Icono from './Iconos.jsx'

export const soles = (n) => 'S/ ' + Number(n).toLocaleString('es-PE', { maximumFractionDigits: 0 })
export const campo = 'w-full rounded-lg border border-tinta/15 bg-superficie px-3 py-2 text-sm'
export const botonRosa = 'inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-rosa to-[#8b2fd9] px-4 py-2 text-sm font-semibold text-white shadow-md disabled:opacity-40'
export const botonBorde = 'inline-flex items-center justify-center gap-2 rounded-lg border border-tinta/15 bg-superficie px-3 py-2 text-sm font-semibold hover:bg-tinta/5'

// Título de la sección con su detalle debajo y, a la derecha, los botones (children)
export function Encabezado({ titulo, detalle, children }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">{titulo}</h1>
        {detalle && <p className="mt-1 text-sm text-tinta/60">{detalle}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  )
}

export function Caja({ titulo, extra, className = '', children }) {
  return (
    <section className={'min-w-0 rounded-2xl border border-tinta/10 bg-superficie p-5 shadow-sm ' + className}>
      {(titulo || extra) && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          {titulo && <h2 className="text-lg font-medium">{titulo}</h2>}
          {extra}
        </div>
      )}
      {children}
    </section>
  )
}

// Tarjeta de número grande (indicador)
export function Indicador({ titulo, valor, detalle, icono, tono = 'text-tinta/60' }) {
  return (
    <div className="min-w-0 rounded-2xl border border-tinta/10 bg-superficie p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-morado">{titulo}</p>
        {icono && <span className="text-rosa"><Icono nombre={icono} tam={18} /></span>}
      </div>
      <p className="mt-2 font-titulo text-3xl font-semibold tabular-nums">{valor}</p>
      {detalle && <p className={'mt-1 text-xs ' + tono}>{detalle}</p>}
    </div>
  )
}

// Etiqueta de estado con su color (de pedidos y de reparaciones)
const TONOS = {
  recibido: 'border-morado/40 text-morado', diagnosticado: 'border-morado/40 bg-morado/10 text-morado',
  en_reparacion: 'border-rosa/40 text-rosa', listo_para_recoger: 'border-rosa/50 bg-rosa/10 text-rosa',
  entregado: 'border-tinta/15 bg-tinta/5 text-tinta/70', pagado: 'border-morado/40 bg-morado/10 text-morado',
  reservado: 'border-aviso/40 text-aviso', cancelado: 'border-tinta/15 text-tinta/50 line-through',
}
export const NOMBRE_ESTADO = {
  recibido: 'Recibido', diagnosticado: 'Diagnosticado', en_reparacion: 'En reparación', listo_para_recoger: 'Listo para recoger',
  entregado: 'Entregado', pagado: 'Pagado', reservado: 'Reservado', cancelado: 'Cancelado',
}
export function Estado({ estado }) {
  return <span className={'inline-block whitespace-nowrap rounded-md border px-2 py-0.5 text-xs ' + (TONOS[estado] || '')}>{NOMBRE_ESTADO[estado] || estado}</span>
}

// Fila de filtros: buscador, estado, desde, hasta y "Limpiar" (como en Ventas y Reparaciones del prototipo)
export function Filtros({ filtros, setFiltros, estados, placeholder }) {
  const cambiar = (k) => (e) => setFiltros({ ...filtros, [k]: e.target.value })
  const etiqueta = 'mb-1 block text-xs text-tinta/60'
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.3fr_1fr_1fr_auto] lg:items-end">
      <label className="block"><span className={etiqueta}>Buscar</span>
        <input id="filtro-q" value={filtros.q} onChange={cambiar('q')} placeholder={placeholder} className={campo} /></label>
      <label className="block"><span className={etiqueta}>Estado</span>
        <select id="filtro-estado" value={filtros.estado} onChange={cambiar('estado')} className={campo}>
          <option value="">Todos</option>
          {estados.map((e) => <option key={e} value={e}>{NOMBRE_ESTADO[e]}</option>)}
        </select></label>
      <label className="block"><span className={etiqueta}>Desde</span>
        <input id="filtro-desde" type="date" value={filtros.desde} onChange={cambiar('desde')} className={campo} /></label>
      <label className="block"><span className={etiqueta}>Hasta</span>
        <input id="filtro-hasta" type="date" value={filtros.hasta} onChange={cambiar('hasta')} className={campo} /></label>
      <button type="button" onClick={() => setFiltros({ q: '', estado: '', desde: '', hasta: '' })} className={botonBorde}>
        <Icono nombre="cerrar" tam={14} /> Limpiar
      </button>
    </div>
  )
}
export const FILTROS_VACIOS = { q: '', estado: '', desde: '', hasta: '' }

// ¿La fila pasa los filtros? `textos` son los campos donde busca el buscador
export function pasaFiltros(f, { textos, estado, fecha }) {
  const q = f.q.trim().toLowerCase()
  if (q && !textos.some((t) => String(t || '').toLowerCase().includes(q))) return false
  if (f.estado && estado !== f.estado) return false
  if (f.desde && fecha < f.desde) return false
  if (f.hasta && fecha > f.hasta) return false
  return true
}

// Paginación "Mostrando 1–12 de 47" con botones de página
export function Paginacion({ pagina, setPagina, total, porPagina }) {
  const paginas = Math.max(1, Math.ceil(total / porPagina))
  if (total === 0) return null
  const desde = (pagina - 1) * porPagina + 1
  const hasta = Math.min(pagina * porPagina, total)
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-tinta/10 pt-3 text-sm">
      <span className="text-tinta/60">Mostrando {desde}–{hasta} de {total}</span>
      <div className="flex flex-wrap gap-1">
        <button type="button" disabled={pagina === 1} onClick={() => setPagina(pagina - 1)} className={botonBorde + ' disabled:opacity-40'}>
          <Icono nombre="flechaIzq" tam={14} /> Anterior
        </button>
        {/* Se muestran hasta 5 números alrededor de la página actual, para que quepan en el celular */}
        {Array.from({ length: paginas }, (_, i) => i + 1).filter((n) => Math.abs(n - pagina) <= 2).map((n) => (
          <button key={n} type="button" onClick={() => setPagina(n)} aria-current={n === pagina ? 'page' : undefined}
            className={'h-9 min-w-9 rounded-lg border px-2 text-sm ' + (n === pagina ? 'border-rosa/50 bg-rosa/15 font-semibold text-rosa' : 'border-tinta/15')}>{n}</button>
        ))}
        <button type="button" disabled={pagina === paginas} onClick={() => setPagina(pagina + 1)} className={botonBorde + ' disabled:opacity-40'}>
          Siguiente <Icono nombre="flechaDer" tam={14} />
        </button>
      </div>
    </div>
  )
}
