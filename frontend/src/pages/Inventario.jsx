// HU-12: Ángel cambia precio, stock y tráiler de cada producto.
// HU-24: "Inventario" como el prototipo: dar de alta un producto (con fotos), los géneros de los juegos
// y el catálogo actual con filtros, editar y quitar.
import { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api, leerSesion, urlImagen } from '../api.js'
import Icono from '../components/Iconos.jsx'
import { Caja, Encabezado, Paginacion, botonBorde, botonRosa, campo, soles } from '../components/PiezasPanel.jsx'
import SubirFoto from '../components/SubirFoto.jsx'

const CATEGORIAS = [['PS5', 'PS5 · juegos'], ['PS4', 'PS4 · juegos'], ['PS3', 'PS3 · juegos'], ['PS2', 'PS2 · juegos'],
  ['Máquinas', 'Máquinas (consolas)'], ['Mandos', 'Mandos'], ['PC y periféricos', 'PC y periféricos']]
const ES_JUEGO = (c) => ['PS5', 'PS4', 'PS3', 'PS2'].includes(c)
// Estados que tiene sentido elegir según la categoría (son los de la tabla "condiciones")
const ESTADOS = {
  juego: ['Nuevo, sellado', 'Usado, como nuevo', 'Usado, completo', 'Usado, buen estado', 'Usado, solo disco'],
  'Máquinas': ['Nueva, sellada', 'Reacondicionada en taller', 'Repotenciada en taller', 'Usada, revisada en taller'],
  Mandos: ['Nuevo', 'Usado, buen estado', 'Reacondicionado en taller'],
  'PC y periféricos': ['Nuevo', 'Nuevo, caja abierta'],
}
const estadosDe = (c) => (ES_JUEGO(c) ? ESTADOS.juego : ESTADOS[c])
const MODOS = [['solo', 'Un jugador'], ['local', 'Multijugador local'], ['online', 'En línea']]
const COLORES = ['Negro', 'Blanco', 'Rojo', 'Azul', 'Gris', 'Camuflado', 'Otro']
const SUBCATEGORIAS = ['Teclados', 'Mouse', 'Monitores', 'Audífonos', 'Componentes']
const POR_PAGINA = 12

const VACIO = {
  nombre: '', categoria: 'PS5', precio: '', stock: '', condicion: 'Nuevo, sellado', plataforma: 'PS5', subcategoria: 'Teclados',
  color: 'Negro', origen: 'Original', generos: [], modos: ['solo'], etiquetas: [], incluye_caja: true, incluye_manual: false,
  incluye_disco: true, descripcion: '', es_preventa: false, monto_reserva: '', fecha_lanzamiento: '', con_descuento: false,
  descuento: 10, descuento_dias: 5, fotos: [null, null, null, null], trailer_url: '',
}

// Botón tipo "pastilla" que se prende y apaga (géneros, modos, qué incluye)
function Pastilla({ activo, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={activo}
      className={'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ' +
        (activo ? 'border-rosa bg-rosa/15 font-medium text-rosa' : 'border-tinta/15 bg-superficie hover:bg-tinta/5')}>
      <span className={'grid h-4 w-4 place-items-center rounded-full border ' + (activo ? 'border-rosa bg-rosa' : 'border-tinta/40')}>
        {activo && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
      </span>
      {children}
    </button>
  )
}

const Etiqueta = ({ children, htmlFor }) => <label htmlFor={htmlFor} className="mb-1 block text-xs text-tinta/60">{children}</label>

export default function Inventario() {
  const sesion = leerSesion()
  const [productos, setProductos] = useState([])
  const [generos, setGeneros] = useState([])
  const [form, setForm] = useState(VACIO)
  const [editando, setEditando] = useState(null) // id del producto que se está editando
  const [etiquetaNueva, setEtiquetaNueva] = useState('')
  const [generoNuevo, setGeneroNuevo] = useState('')
  const [f, setF] = useState({ q: '', categoria: '', estado: '', stock: '', descuento: false })
  const [pagina, setPagina] = useState(1)
  const [porQuitar, setPorQuitar] = useState(null) // id del producto que pide confirmación para quitarse
  const [aviso, setAviso] = useState('')
  const [error, setError] = useState('')
  const arriba = useRef(null)

  const cargar = () => api('/productos').then(setProductos).catch((e) => setError(e.message))
  const cargarGeneros = () => api('/generos').then(setGeneros).catch(() => {})
  useEffect(() => { cargar(); cargarGeneros() }, [])

  if (!sesion || sesion.usuario.rol !== 'dueno') return <Navigate to="/login" />

  const poner = (k, v) => setForm((x) => ({ ...x, [k]: v }))
  const cambiar = (k) => (e) => poner(k, e.target.type === 'checkbox' ? e.target.checked : e.target.value)
  const alternar = (k, valor) => poner(k, form[k].includes(valor) ? form[k].filter((x) => x !== valor) : [...form[k], valor])
  const elegirCategoria = (e) => {
    const c = e.target.value
    setForm({ ...form, categoria: c, condicion: estadosDe(c)[0], plataforma: ES_JUEGO(c) ? c : (c === 'PC y periféricos' ? 'PC' : 'PS5') })
  }
  const agregarEtiqueta = (e) => {
    if (e.key !== 'Enter' && e.key !== ',') return
    e.preventDefault()
    const t = etiquetaNueva.trim().toLowerCase()
    if (t && !form.etiquetas.includes(t)) poner('etiquetas', [...form.etiquetas, t])
    setEtiquetaNueva('')
  }
  const ponerFoto = (i, url) => poner('fotos', form.fotos.map((x, j) => (j === i ? url : x)))

  const limpiar = () => { setForm(VACIO); setEditando(null); setError('') }

  // Lleva el producto al formulario de arriba para cambiarlo
  const editar = async (p) => {
    setError(''); setAviso('')
    try {
      const d = await api('/productos/' + p.id)
      const dias = d.oferta_termina ? Math.max(1, Math.ceil((new Date(d.oferta_termina) - Date.now()) / 86400000)) : 5
      setForm({
        ...VACIO, nombre: d.nombre, categoria: d.categoria, precio: Number(d.precio), stock: d.stock, condicion: d.condicion,
        plataforma: d.plataforma || 'PS5', subcategoria: d.subcategoria || 'Teclados', color: d.color || 'Negro',
        origen: d.origen || 'Original', generos: d.generos, modos: d.modos.length ? d.modos : ['solo'], etiquetas: d.etiquetas,
        incluye_caja: d.incluye_caja ?? true, incluye_manual: d.incluye_manual ?? false, incluye_disco: d.incluye_disco ?? true,
        descripcion: d.descripcion || '', es_preventa: d.es_preventa, monto_reserva: d.monto_reserva ?? '',
        fecha_lanzamiento: d.fecha_lanzamiento || '', con_descuento: !!d.descuento, descuento: d.descuento || 10, descuento_dias: dias,
        fotos: [0, 1, 2, 3].map((i) => d.fotos[i] || null), trailer_url: d.trailer_url || '',
      })
      setEditando(p.id)
      arriba.current?.scrollIntoView({ behavior: 'smooth' })
    } catch (err) {
      setError(err.message)
    }
  }

  const publicar = async (e) => {
    e.preventDefault()
    setError(''); setAviso('')
    const cuerpo = {
      ...form, precio: Number(form.precio), stock: Number(form.stock || 0),
      monto_reserva: form.es_preventa && form.monto_reserva !== '' ? Number(form.monto_reserva) : null,
      fecha_lanzamiento: form.es_preventa && form.fecha_lanzamiento ? form.fecha_lanzamiento : null,
      descuento: form.con_descuento ? Number(form.descuento) : null, descuento_dias: form.con_descuento ? Number(form.descuento_dias) : null,
      fotos: form.fotos.filter(Boolean), trailer_url: form.trailer_url.trim() || null,
    }
    try {
      const p = editando
        ? await api('/productos/' + editando, { metodo: 'PUT', cuerpo })
        : await api('/productos', { metodo: 'POST', cuerpo })
      setAviso((editando ? 'Cambios guardados: ' : 'Publicado en la tienda: ') + p.nombre)
      limpiar()
      cargar(); cargarGeneros()
    } catch (err) {
      setError(err.message)
    }
  }

  const guardarStock = async (p, valor) => {
    const stock = Number(valor)
    if (valor === '' || stock === p.stock) return
    try {
      const nuevo = await api('/productos/' + p.id, { metodo: 'PATCH', cuerpo: { stock } })
      setProductos(productos.map((x) => (x.id === p.id ? nuevo : x)))
      setAviso(`Stock actualizado: ${p.nombre} (${stock})`)
    } catch (err) {
      setError(err.message)
    }
  }

  const quitar = async (p) => {
    try {
      await api('/productos/' + p.id, { metodo: 'DELETE' })
      setProductos(productos.filter((x) => x.id !== p.id))
      setPorQuitar(null)
      setAviso('Se quitó del catálogo: ' + p.nombre + '. Sus ventas y reseñas se conservan.')
    } catch (err) {
      setError(err.message)
    }
  }

  const agregarGenero = async () => {
    if (generoNuevo.trim().length < 3) return
    try {
      await api('/generos', { metodo: 'POST', cuerpo: { nombre: generoNuevo.trim() } })
      setGeneroNuevo('')
      cargarGeneros()
    } catch (err) {
      setError(err.message)
    }
  }

  // Filtros del catálogo actual
  const estadoDe = (p) => (p.es_preventa ? 'preventa' : p.stock === 0 ? 'agotado' : 'publicado')
  const visibles = productos.filter((p) =>
    p.nombre.toLowerCase().includes(f.q.trim().toLowerCase()) && (!f.categoria || p.categoria === f.categoria) &&
    (!f.estado || estadoDe(p) === f.estado) && (f.stock !== 'bajo' || (p.stock <= 2 && !p.es_preventa)) &&
    (f.stock !== 'agotado' || p.stock === 0) && (!f.descuento || p.descuento))
  const enPagina = visibles.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)
  const filtrar = (k) => (e) => { setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }); setPagina(1) }
  const TONO = { publicado: 'border-rosa/40 text-rosa', preventa: 'border-aviso/40 text-aviso', agotado: 'border-error/40 text-error' }
  const NOMBRE = { publicado: 'Publicado', preventa: 'Preventa', agotado: 'Agotado' }
  const th = 'px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-tinta/60'
  const precioFinal = form.con_descuento && form.precio ? Math.round(Number(form.precio) * (100 - Number(form.descuento)) / 100) : null
  const c = form.categoria
  const trailer = ES_JUEGO(c) && (form.trailer_url.match(/(?:v=|youtu\.be\/)([\w-]{11})/) || [])[1] // código del video de YouTube

  return (
    <div className="space-y-6">
      <div ref={arriba} className="scroll-mt-4">
        <Encabezado titulo={editando ? 'Editar producto' : 'Dar de alta un producto'}
          detalle="Según la categoría te pedimos lo que corresponde: estado y qué incluye para juegos, generación para máquinas, color y tipo para mandos." />
      </div>
      {aviso && <p className="rounded-lg bg-ok/10 p-3 text-sm text-ok">{aviso}</p>}
      {error && <p className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}

      <form onSubmit={publicar} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Caja className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Etiqueta htmlFor="np-nombre">Nombre del producto</Etiqueta>
              <input id="np-nombre" value={form.nombre} onChange={cambiar('nombre')} placeholder="Ej: Mando DualSense Midnight Black" className={campo} required /></div>
            <div><Etiqueta htmlFor="np-categoria">Categoría</Etiqueta>
              <select id="np-categoria" value={c} onChange={elegirCategoria} className={campo}>
                {CATEGORIAS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select></div>
            <div><Etiqueta htmlFor="np-precio">Precio (S/)</Etiqueta>
              <input id="np-precio" type="number" min="1" value={form.precio} onChange={cambiar('precio')} placeholder="279" className={campo} required /></div>
            <div><Etiqueta htmlFor="np-stock">Stock</Etiqueta>
              <input id="np-stock" type="number" min="0" value={form.stock} onChange={cambiar('stock')} placeholder="6" className={campo} required /></div>
          </div>

          {/* Datos que dependen de la categoría */}
          <div className="space-y-4 rounded-xl border border-morado/20 bg-morado/5 p-4">
            <p className="font-medium">
              {ES_JUEGO(c) ? 'Datos del juego · ' + c : c === 'Máquinas' ? 'Datos de la consola' : c === 'Mandos' ? 'Datos del mando' : 'Datos del periférico'}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Etiqueta htmlFor="np-estado">Estado</Etiqueta>
                <select id="np-estado" value={form.condicion} onChange={cambiar('condicion')} className={campo}>
                  {estadosDe(c).map((x) => <option key={x}>{x}</option>)}
                </select></div>
              {(c === 'Máquinas' || c === 'Mandos') && (
                <div><Etiqueta htmlFor="np-plat">{c === 'Máquinas' ? 'Generación' : 'Para la consola'}</Etiqueta>
                  <select id="np-plat" value={form.plataforma} onChange={cambiar('plataforma')} className={campo}>
                    {['PS5', 'PS4', 'PS3', 'PS2'].map((x) => <option key={x}>{x}</option>)}
                  </select></div>
              )}
              {c === 'Mandos' && (
                <>
                  <div><Etiqueta htmlFor="np-origen">Tipo</Etiqueta>
                    <select id="np-origen" value={form.origen} onChange={cambiar('origen')} className={campo}>
                      <option value="Original">Original (Sony)</option><option value="Genérico">Genérico (compatible, otra marca)</option>
                    </select></div>
                  <div><Etiqueta htmlFor="np-color">Color</Etiqueta>
                    <select id="np-color" value={form.color} onChange={cambiar('color')} className={campo}>
                      {COLORES.map((x) => <option key={x}>{x}</option>)}
                    </select></div>
                </>
              )}
              {c === 'PC y periféricos' && (
                <div><Etiqueta htmlFor="np-sub">Subcategoría</Etiqueta>
                  <select id="np-sub" value={form.subcategoria} onChange={cambiar('subcategoria')} className={campo}>
                    {SUBCATEGORIAS.map((x) => <option key={x} value={x}>{x === 'Componentes' ? 'Componentes (RAM, SSD)' : x}</option>)}
                  </select></div>
              )}
            </div>

            {ES_JUEGO(c) && (
              <>
                <fieldset><legend className="mb-2 text-xs text-tinta/60">Géneros · elige uno o varios</legend>
                  <div className="flex flex-wrap gap-2">
                    {generos.map((g) => <Pastilla key={g.id} activo={form.generos.includes(g.id)} onClick={() => alternar('generos', g.id)}>{g.nombre}</Pastilla>)}
                  </div></fieldset>
                <fieldset><legend className="mb-2 text-xs text-tinta/60">Modo de juego</legend>
                  <div className="flex flex-wrap gap-2">
                    {MODOS.map(([k, t]) => <Pastilla key={k} activo={form.modos.includes(k)} onClick={() => alternar('modos', k)}>{t}</Pastilla>)}
                  </div></fieldset>
                <div><Etiqueta htmlFor="np-etiqueta">Etiquetas · escribe y pulsa Enter (ej. souls, espadas, samurái)</Etiqueta>
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-tinta/15 bg-superficie p-2">
                    {form.etiquetas.map((t) => (
                      <button key={t} type="button" onClick={() => poner('etiquetas', form.etiquetas.filter((x) => x !== t))} aria-label={'Quitar etiqueta ' + t}
                        className="inline-flex items-center gap-1 rounded-full bg-morado/15 px-2 py-0.5 text-xs text-morado">{t} <Icono nombre="cerrar" tam={12} /></button>
                    ))}
                    <input id="np-etiqueta" value={etiquetaNueva} onChange={(e) => setEtiquetaNueva(e.target.value)} onKeyDown={agregarEtiqueta}
                      placeholder={form.etiquetas.length ? '' : 'souls, espadas, samurái…'} className="min-w-32 flex-1 bg-transparent px-1 py-1 text-sm focus:outline-none" />
                  </div>
                  <p className="mt-1 text-xs text-tinta/60">No aparecen en el menú de categorías; sirven para la búsqueda, el chatbot y "Juegos parecidos".</p></div>
                <fieldset><legend className="mb-2 text-xs text-tinta/60">Qué incluye · importa sobre todo en juegos usados</legend>
                  <div className="flex flex-wrap gap-2">
                    {[['incluye_caja', 'Caja'], ['incluye_manual', 'Manual'], ['incluye_disco', 'Disco']].map(([k, t]) => (
                      <Pastilla key={k} activo={form[k]} onClick={() => poner(k, !form[k])}>{t}</Pastilla>
                    ))}
                  </div></fieldset>
              </>
            )}
          </div>

          <div><Etiqueta htmlFor="np-desc">Descripción</Etiqueta>
            <textarea id="np-desc" rows={3} value={form.descripcion} onChange={cambiar('descripcion')} placeholder="Qué incluye, si es nuevo o reacondicionado, garantía…" className={campo} /></div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm"><input id="np-preventa" type="checkbox" checked={form.es_preventa} onChange={cambiar('es_preventa')} /> Publicar en preventa</label>
            {form.es_preventa && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div><Etiqueta htmlFor="np-reserva">Monto de reserva (S/)</Etiqueta>
                  <input id="np-reserva" type="number" min="0" value={form.monto_reserva} onChange={cambiar('monto_reserva')} className={campo} /></div>
                <div><Etiqueta htmlFor="np-lanz">Fecha de lanzamiento (vacía = por confirmar)</Etiqueta>
                  <input id="np-lanz" type="date" value={form.fecha_lanzamiento} onChange={cambiar('fecha_lanzamiento')} className={campo} /></div>
              </div>
            )}
            <div className="rounded-xl bg-morado/5 p-3">
              <label className="flex items-center gap-2 text-sm"><input id="np-con-desc" type="checkbox" checked={form.con_descuento} onChange={cambiar('con_descuento')} /> Poner en descuento</label>
              {form.con_descuento && (
                <div className="mt-3 grid gap-4 sm:grid-cols-3 sm:items-end">
                  <div><Etiqueta htmlFor="np-pct">Descuento (%)</Etiqueta>
                    <input id="np-pct" type="number" min="1" max="90" value={form.descuento} onChange={cambiar('descuento')} className={campo} /></div>
                  <div><Etiqueta htmlFor="np-dias">Vigente por (días)</Etiqueta>
                    <input id="np-dias" type="number" min="1" max="60" value={form.descuento_dias} onChange={cambiar('descuento_dias')} className={campo} /></div>
                  {precioFinal !== null && <p className="text-sm">En la tienda se verá: <b className="text-rosa">{soles(precioFinal)}</b> <span className="text-tinta/60 line-through">{soles(form.precio)}</span></p>}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button className={botonRosa}><Icono nombre="check" tam={16} /> {editando ? 'Guardar cambios' : 'Publicar producto'}</button>
            <button type="button" onClick={limpiar} className={botonBorde}>{editando ? 'Cancelar' : 'Limpiar'}</button>
          </div>
        </Caja>

        <Caja titulo="Imágenes del producto" className="h-fit">
          <p className="-mt-2 mb-3 text-xs text-tinta/60">Hasta 4, no es obligatorio llenarlas todas. La primera es la portada del catálogo.</p>
          <p className="mb-3 rounded-lg border border-morado/20 bg-morado/5 p-2 text-xs">ⓘ Portada: vertical 900 × 1200 px (3:4). JPG, PNG o WebP. Se achica sola antes de subirse.</p>
          <div className="grid grid-cols-2 gap-3">
            {form.fotos.map((u, i) => (
              <div key={i}>
                <p className="mb-1 text-xs text-tinta/60">{i === 0 ? 'Imagen 1 · portada' : i === 3 && trailer ? 'Imagen 4 · tráiler' : 'Imagen ' + (i + 1)}</p>
                {/* HU-26: como el prototipo, si el juego tiene tráiler ocupa el 4.º lugar de la galería */}
                {i === 3 && trailer
                  ? (
                    <div className="relative grid aspect-[3/4] place-items-center overflow-hidden rounded-xl border border-tinta/15 bg-[#0b0820]">
                      <img src={'https://i.ytimg.com/vi/' + trailer + '/mqdefault.jpg'} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
                      <span className="relative flex flex-col items-center gap-1 text-white">
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-white/90 pl-0.5 text-[#1a1040]">▶</span>
                        <span className="text-xs font-semibold">Tráiler</span>
                      </span>
                    </div>
                  )
                  : <SubirFoto id={'np-foto-' + i} url={u} onCambio={(url) => ponerFoto(i, url)} etiqueta={i === 0 ? 'Portada' : 'Opcional'} />}
              </div>
            ))}
          </div>
          {ES_JUEGO(c) && (
            <div className="mt-4"><Etiqueta htmlFor="np-trailer">Tráiler de YouTube (opcional)</Etiqueta>
              <input id="np-trailer" value={form.trailer_url} onChange={cambiar('trailer_url')} placeholder="https://www.youtube.com/watch?v=..." className={campo} />
              <p className="mt-1 text-xs text-tinta/60">{trailer ? 'Se verá como la 4.ª imagen de la galería. Bórralo para usar una foto en su lugar.'
                : form.trailer_url.trim() ? 'Ese enlace no parece de YouTube.' : 'Si lo pones, se verá como la 4.ª imagen de la galería.'}</p></div>
          )}
        </Caja>
      </form>

      <Caja>
        <div className="flex flex-wrap items-start gap-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rosa/10 text-rosa"><Icono nombre="estrella" /></span>
          <div className="min-w-0 flex-1 basis-72">
            <h2 className="text-lg font-medium">Géneros</h2>
            <p className="text-sm text-tinta/70">La lista que eliges al crear un juego. Rasgos como "souls" o "un jugador" no son géneros: van en Etiquetas o en Modo de juego.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {generos.map((g) => (
            <span key={g.id} className="rounded-full border border-tinta/15 px-3 py-1 text-sm">{g.nombre} <span className="text-xs text-tinta/60">{g.juegos} {g.juegos === 1 ? 'juego' : 'juegos'}</span></span>
          ))}
        </div>
        <div className="mt-4 flex max-w-xl flex-wrap gap-2">
          <input id="nuevo-genero" value={generoNuevo} onChange={(e) => setGeneroNuevo(e.target.value)} placeholder="Nuevo género, p. ej. Simulación"
            aria-label="Nuevo género" className={campo + ' min-w-48 flex-1'} />
          <button type="button" onClick={agregarGenero} className={botonBorde}><Icono nombre="mas" tam={16} /> Añadir género</button>
        </div>
      </Caja>

      <div>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-2xl font-semibold">Catálogo actual ({productos.length})</h2>
          <input id="inv-q" value={f.q} onChange={filtrar('q')} placeholder="Buscar producto por nombre…" aria-label="Buscar producto"
            className={campo + ' max-w-sm'} />
        </div>
        <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
          <div><Etiqueta htmlFor="inv-cat">Categoría</Etiqueta>
            <select id="inv-cat" value={f.categoria} onChange={filtrar('categoria')} className={campo}>
              <option value="">Todas</option>{CATEGORIAS.map(([v]) => <option key={v}>{v}</option>)}
            </select></div>
          <div><Etiqueta htmlFor="inv-estado">Estado</Etiqueta>
            <select id="inv-estado" value={f.estado} onChange={filtrar('estado')} className={campo}>
              <option value="">Todos</option><option value="publicado">Publicado</option><option value="preventa">Preventa</option><option value="agotado">Agotado</option>
            </select></div>
          <div><Etiqueta htmlFor="inv-stock">Stock</Etiqueta>
            <select id="inv-stock" value={f.stock} onChange={filtrar('stock')} className={campo}>
              <option value="">Todos</option><option value="bajo">Stock bajo (≤ 2)</option><option value="agotado">Agotado</option>
            </select></div>
          <label className="flex items-center gap-2 pb-2 text-sm"><input id="inv-desc" type="checkbox" checked={f.descuento} onChange={filtrar('descuento')} /> Con descuento</label>
        </div>
        <p className="mb-2 text-sm font-semibold">{visibles.length} productos</p>

        <Caja>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-tinta/10">
                <tr><th className={th}>Producto</th><th className={th}>Categoría</th><th className={th}>Precio</th>
                  <th className={th + ' w-24'}>Stock</th><th className={th}>Estado</th><th className={th + ' text-right'}>Acciones</th></tr>
              </thead>
              <tbody className="divide-y divide-tinta/10">
                {enPagina.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        {p.foto && <img src={urlImagen(p.foto)} alt="" width="40" height="40" loading="lazy" className="h-10 w-10 shrink-0 rounded-md bg-white object-contain" />}
                        <span className="font-medium">{p.nombre}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-tinta/80">{p.categoria}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{soles(p.precio_final)}{p.descuento && <span className="ml-1 text-xs text-rosa">(-{p.descuento}%)</span>}</td>
                    <td className="px-3 py-2">
                      <input key={p.stock} type="number" min="0" defaultValue={p.stock} aria-label={'Stock de ' + p.nombre}
                        onBlur={(e) => guardarStock(p, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                        className="w-20 rounded-lg border border-tinta/15 bg-fondo px-2 py-1.5 text-sm" />
                    </td>
                    <td className="px-3 py-2"><span className={'rounded-md border px-2 py-0.5 text-xs ' + TONO[estadoDe(p)]}>{NOMBRE[estadoDe(p)]}</span></td>
                    <td className="px-3 py-2">
                      {porQuitar === p.id ? (
                        <div className="flex items-center justify-end gap-2 text-xs">
                          <span>¿Quitar del catálogo?</span>
                          <button type="button" onClick={() => quitar(p)} className="rounded-md bg-error px-2 py-1 font-semibold text-white">Sí, quitar</button>
                          <button type="button" onClick={() => setPorQuitar(null)} className="rounded-md border border-tinta/15 px-2 py-1">No</button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => editar(p)} aria-label={'Editar ' + p.nombre}
                            className="grid h-8 w-8 place-items-center rounded-lg border border-tinta/15 hover:bg-tinta/5"><Icono nombre="lapiz" tam={15} /></button>
                          <button type="button" onClick={() => setPorQuitar(p.id)} aria-label={'Quitar ' + p.nombre + ' del catálogo'}
                            className="grid h-8 w-8 place-items-center rounded-lg border border-tinta/15 hover:bg-error/10 hover:text-error"><Icono nombre="basura" tam={15} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visibles.length === 0 && <p className="py-6 text-center text-sm text-tinta/60">No se encontraron productos.</p>}
          </div>
          <Paginacion pagina={pagina} setPagina={setPagina} total={visibles.length} porPagina={POR_PAGINA} />
        </Caja>
      </div>
    </div>
  )
}
