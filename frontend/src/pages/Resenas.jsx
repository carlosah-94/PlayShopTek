// HU-24: sección "Reseñas" del panel. Ángel y Linda leen lo que opinan los clientes y responden (HU-17).
// Dos pestañas como el prototipo: reseñas de productos y del servicio de reparación.
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api, leerSesion } from '../api.js'
import Icono from '../components/Iconos.jsx'
import { Encabezado, Paginacion, campo } from '../components/PiezasPanel.jsx'

const POR_PAGINA = 12
const ORIGEN = { web: 'Web', tienda: 'Tienda', whatsapp: 'WhatsApp' }
const iniciales = (n) => n.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()

export default function Resenas() {
  const sesion = leerSesion()
  const [tipo, setTipo] = useState('producto')
  const [lista, setLista] = useState(null) // null = cargando
  const [abierta, setAbierta] = useState(null) // id de la reseña que se está respondiendo
  const [texto, setTexto] = useState('')
  const [error, setError] = useState('')
  const [pagina, setPagina] = useState(1)

  useEffect(() => {
    if (!sesion || sesion.usuario.rol === 'cliente') return
    setLista(null)
    setPagina(1)
    api('/resenas?tipo=' + tipo).then(setLista).catch((e) => setError(e.message))
  }, [tipo])

  if (!sesion || sesion.usuario.rol === 'cliente') return <Navigate to="/login" />

  const responder = async (r) => {
    setError('')
    try {
      const nueva = await api(`/resenas/${r.id}/respuesta`, { metodo: 'PATCH', cuerpo: { respuesta: texto.trim() } })
      setLista(lista.map((x) => (x.id === r.id ? { ...x, respuesta: nueva.respuesta } : x)))
      setAbierta(null)
      setTexto('')
    } catch (err) {
      setError(err.message)
    }
  }

  const esDueno = sesion.usuario.rol === 'dueno'
  // HU-24: Ángel elige las reseñas que salen en "Lo que dicen los clientes" del inicio
  const destacar = async (r) => {
    try {
      await api(`/resenas/${r.id}/destacada`, { metodo: 'PATCH', cuerpo: { activo: !r.destacada } })
      setLista(lista.map((x) => (x.id === r.id ? { ...x, destacada: !r.destacada } : x)))
    } catch (err) {
      setError(err.message)
    }
  }
  const enPagina = lista ? lista.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA) : []

  const promedio = lista?.length ? (lista.reduce((s, r) => s + r.estrellas, 0) / lista.length).toFixed(1) : null
  const pestana = (valor, nombre, icono) => (
    <button type="button" onClick={() => setTipo(valor)} aria-pressed={tipo === valor}
      className={'inline-flex items-center gap-2 px-3 py-2 text-sm ' + (tipo === valor ? 'bg-rosa/15 font-semibold text-rosa' : 'bg-superficie hover:bg-tinta/5')}>
      <Icono nombre={icono} tam={16} /> {nombre}
    </button>
  )

  return (
    <div className="space-y-4">
      <Encabezado titulo="Reseñas" detalle={lista ? `${lista.length} reseñas más recientes · promedio ${promedio ?? '—'} de 5` : 'Cargando…'}>
        <div className="flex overflow-hidden rounded-lg border border-tinta/15" role="group" aria-label="Tipo de reseña">
          {pestana('producto', 'Productos', 'paquete')}
          {pestana('servicio', 'Servicio de reparación', 'llave')}
        </div>
      </Encabezado>
      {error && <p className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {enPagina.map((r) => (
          <li key={r.id} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-tinta/10 bg-superficie p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-rosa to-morado text-xs font-semibold text-white">{iniciales(r.nombre)}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-tight">{r.nombre}</p>
                <p className="truncate text-xs text-tinta/60">{r.sobre} · {r.fecha}</p>
              </div>
              <span className="text-xs text-[#b07800]"><span aria-hidden="true">{'★'.repeat(r.estrellas)}{'☆'.repeat(5 - r.estrellas)}</span><span className="sr-only">{r.estrellas} de 5 estrellas</span></span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-md border border-morado/30 px-2 py-0.5 text-[11px] text-morado">{ORIGEN[r.origen] || r.origen}</span>
              {r.verificada && <span className="rounded-md border border-ok/40 px-2 py-0.5 text-[11px] text-ok">Compra verificada</span>}
              {r.destacada && <span className="rounded-md border border-rosa/40 bg-rosa/10 px-2 py-0.5 text-[11px] text-rosa">★ En el inicio</span>}
            </div>
            <p className="flex-1 text-sm">{r.texto}</p>
            {r.respuesta && <p className="rounded-lg bg-morado/10 p-2 text-xs"><b>Respuesta de la tienda:</b> {r.respuesta}</p>}
            {abierta !== r.id && (
              <div className="flex flex-wrap items-center gap-2">
                {!r.respuesta && (
                  <button type="button" onClick={() => { setAbierta(r.id); setTexto('') }}
                    className="inline-flex items-center gap-2 rounded-lg border border-tinta/15 px-3 py-1.5 text-xs font-semibold hover:bg-tinta/5">
                    <Icono nombre="chat" tam={14} /> Responder
                  </button>
                )}
                {esDueno && (
                  <button type="button" onClick={() => destacar(r)} aria-pressed={r.destacada}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-rosa hover:underline">
                    <Icono nombre="estrella" tam={14} /> {r.destacada ? 'Quitar del inicio' : 'Destacar en la tienda'}
                  </button>
                )}
              </div>
            )}
            {abierta === r.id && (
              <div className="space-y-2">
                <textarea id={'respuesta-' + r.id} value={texto} onChange={(e) => setTexto(e.target.value)} rows={3}
                  placeholder="Gracias por tu compra…" aria-label={'Respuesta a ' + r.nombre} className={campo} />
                <div className="flex gap-2">
                  <button type="button" onClick={() => responder(r)} disabled={texto.trim().length < 5}
                    className="rounded-lg bg-rosa px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Publicar respuesta</button>
                  <button type="button" onClick={() => setAbierta(null)} className="text-xs text-tinta/70 hover:underline">Cancelar</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {lista && <Paginacion pagina={pagina} setPagina={setPagina} total={lista.length} porPagina={POR_PAGINA} />}
      {lista?.length === 0 && <p className="text-sm text-tinta/60">Todavía no hay reseñas de este tipo.</p>}
    </div>
  )
}
