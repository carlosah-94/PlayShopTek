// HU-07: el cliente ve en qué paso está su reparación, sin llamar ni escribir por WhatsApp.
// HU-26: con el diseño del prototipo: buscador grande y el código de ejemplo debajo.
// Mejora 1 del Proyecto Final: estado actual destacado, barra de progreso y el ejemplo separado del formulario.
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, leerSesion } from '../api.js'
import { BotonWhatsApp } from '../components/Asesores.jsx'
import Icono from '../components/Iconos.jsx'
import { botonRosa } from '../components/PiezasPanel.jsx'

const PASOS = [['recibido', 'Recibido'], ['diagnosticado', 'Diagnosticado'], ['en_reparacion', 'En reparación'],
  ['listo_para_recoger', 'Listo para recoger'], ['entregado', 'Entregado']]

// Mejora 1 (SUS: solo 3 de 6 dieron el estado correcto): el estado actual se ve grande, con color y qué hacer
const ESTADO = {
  recibido: { color: 'border-morado/40 bg-morado/10 text-morado', icono: 'paquete', texto: 'Recibimos tu equipo. Pronto lo revisaremos.' },
  diagnosticado: { color: 'border-morado/40 bg-morado/10 text-morado', icono: 'lista', texto: 'Ya sabemos qué tiene. Te escribiremos por WhatsApp con el precio.' },
  en_reparacion: { color: 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300', icono: 'llave', texto: 'Estamos reparando tu equipo. Te avisaremos por WhatsApp cuando esté listo.' },
  listo_para_recoger: { color: 'border-ok/50 bg-ok/10 text-ok', icono: 'check', texto: '¡Ya puedes recogerlo en Av. Revolución 1420, Villa El Salvador!' },
  entregado: { color: 'border-tinta/20 bg-tinta/5 text-tinta/80', icono: 'check', texto: 'Ya lo recogiste. ¡Gracias por confiar en nosotros!' },
}
const EJEMPLO = { codigo: 'R-2062', celular: '2445' }
const soloNumero = (c) => c.replace(/\D/g, '')

const fechaHora = (iso) => new Date(iso).toLocaleString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function Rastreo() {
  const [parametros] = useSearchParams()
  const [codigo, setCodigo] = useState(parametros.get('codigo') || '') // llega desde "Mis reparaciones"
  const [celular, setCelular] = useState('')
  // Si el cliente inició sesión, se completan solos los 4 últimos dígitos de su celular
  useEffect(() => {
    if (leerSesion()?.usuario.rol === 'cliente') api('/mi/perfil').then((p) => p.telefono && setCelular(p.telefono.slice(-4))).catch(() => {})
  }, [])
  // Desde "Mis reparaciones" (botón Seguir) llegan el código y el celular: se busca solo
  useEffect(() => { if (parametros.get('codigo') && celular.length === 4 && !rep) buscar() }, [celular])
  const [rep, setRep] = useState(null)
  const [error, setError] = useState('')

  const buscar = async (e, datos = { codigo, celular }) => {
    e?.preventDefault()
    setError(''); setRep(null)
    try {
      setRep(await api(`/rastreo/${encodeURIComponent(datos.codigo.trim())}?celular=${datos.celular}`))
    } catch (err) {
      // Tras 5 intentos fallidos el servidor bloquea 10 minutos: se muestra su mensaje tal cual
      setError(err.message.startsWith('Demasiados') ? err.message
        : `No encontramos la reparación ${datos.codigo.trim().toUpperCase()} con esos 4 dígitos. Revisa el código del mensaje de WhatsApp o escríbenos.`)
    }
  }
  // Si cambia el código o el celular, se borra el resultado anterior para no confundir una reparación con otra
  const cambiar = (poner) => (e) => { poner(e.target.value); setRep(null); setError('') }

  // Cuándo pasó por cada estado (si ya pasó)
  const cuando = Object.fromEntries((rep?.historial || []).map((h) => [h.estado, h.fecha]))
  const actual = rep ? PASOS.findIndex(([k]) => k === rep.estado) : -1
  const campo = 'w-full rounded-lg border border-tinta/15 bg-fondo px-3 py-2.5'
  // El ejemplo va aparte del formulario y se avisa en grande que no es la reparación del cliente
  const verEjemplo = () => { setCodigo(EJEMPLO.codigo); setCelular(EJEMPLO.celular); buscar(null, EJEMPLO) }
  const esEjemplo = rep && soloNumero(rep.codigo) === soloNumero(EJEMPLO.codigo)
  const estado = rep && (ESTADO[rep.estado] || ESTADO.recibido)

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-morado">Servicio técnico</p>
        <h1 className="text-3xl font-semibold">Rastrea tu reparación</h1>
        <p className="mt-1 max-w-xl text-tinta/80">Escribe el código de seguimiento que te enviamos por WhatsApp al dejar tu equipo y los 4 últimos dígitos de tu celular. No necesitas cuenta.</p>
      </div>
      <form onSubmit={buscar} className="space-y-3 rounded-2xl border border-tinta/10 bg-superficie p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-end">
          <label className="block"><span className="mb-1 block text-xs text-tinta/70">Código de seguimiento</span>
            <input id="rastreo-codigo" placeholder="Ej. R-2062" value={codigo} onChange={cambiar(setCodigo)} className={campo} required /></label>
          <label className="block"><span className="mb-1 block text-xs text-tinta/70">4 últimos dígitos de tu celular</span>
            <input id="rastreo-celular" placeholder="Ej. 2445" value={celular} onChange={cambiar(setCelular)}
              className={campo} inputMode="numeric" pattern="[0-9]{4}" maxLength={4} title="Solo los 4 últimos dígitos" required /></label>
          <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-rosa to-[#8b2fd9] px-5 py-2.5 font-semibold text-white shadow-md">
            <Icono nombre="buscar" tam={16} /> Rastrear
          </button>
        </div>
        {error && <p role="alert" className="rounded-lg border border-error/40 bg-error/5 px-3 py-2 text-sm text-error">{error}</p>}
      </form>

      <p className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-tinta/20 px-4 py-3 text-sm text-tinta/70">
        <Icono nombre="ojo" tam={16} /> ¿Solo quieres ver cómo funciona?
        <button type="button" onClick={verEjemplo} className="font-semibold text-morado underline underline-offset-2">Ver un ejemplo</button>
      </p>

      {rep && (
        <div className="space-y-5 rounded-2xl border border-tinta/10 bg-superficie p-6 shadow-sm">
          {esEjemplo && (
            <p role="note" className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
              Esto es un EJEMPLO de demostración ({EJEMPLO.codigo}), no tu reparación. Para ver la tuya, escribe tu código arriba.
            </p>
          )}
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-tinta/60">Resultado para</p>
            <p className="font-mono text-2xl font-bold text-rosa">{rep.codigo}</p>
            <h2 className="text-lg font-semibold">Hola, {rep.cliente}: tu {rep.equipo}</h2>
            <p className="text-sm text-tinta/60">{rep.falla}{rep.servicio ? ' · ' + rep.servicio : ''}</p>
          </div>

          {/* Mejora 1: el estado actual, grande y con color, y qué tiene que hacer el cliente */}
          <div id="rastreo-estado" className={'flex items-start gap-3 rounded-xl border-2 p-4 ' + estado.color}>
            <Icono nombre={estado.icono} tam={28} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">Estado actual</p>
              <p className="text-2xl font-bold">{PASOS[actual]?.[1] || rep.estado}</p>
              <p className="text-sm text-tinta/80">{estado.texto}</p>
            </div>
          </div>

          {/* Barra de progreso: los 5 pasos en línea, con el actual resaltado */}
          <ol className="grid grid-cols-5 gap-1 text-center" aria-label="Pasos de la reparación">
            {PASOS.map(([k, nombre], i) => (
              <li key={k} className="flex flex-col items-center gap-1">
                <span className={'h-2 w-full rounded-full ' + (i <= actual ? 'bg-rosa' : 'bg-tinta/10')} />
                <span className={'grid h-7 w-7 place-items-center rounded-full text-xs font-bold ' +
                  (i === actual ? 'bg-rosa text-white ring-4 ring-rosa/25' : i < actual ? 'bg-rosa/80 text-white' : 'border border-tinta/20 text-tinta/60')}>
                  {i < actual ? '✓' : i + 1}
                </span>
                <span className={'text-[11px] leading-tight sm:text-xs ' + (i === actual ? 'font-bold text-tinta' : 'text-tinta/60')}>{nombre}</span>
                {cuando[k] && <span className="text-[10px] text-tinta/50">{fechaHora(cuando[k])}</span>}
              </li>
            ))}
          </ol>

          <p className="text-sm">
            Costo: <b>S/ {Number(rep.costo)}</b> {rep.precio_acordado ? '(aceptado)' : '(por confirmar contigo)'}
            {rep.duracion_estimada && <> · Tiempo estimado: {rep.duracion_estimada}</>}
          </p>
          {/* HU-26: como el prototipo: consultar por WhatsApp con los asesores */}
          <p className="rounded-lg border border-morado/30 bg-morado/10 px-3 py-2.5 text-sm text-tinta/80">El precio y el pago se coordinan por WhatsApp. Cada vez que la tienda actualiza el estado, te avisamos por WhatsApp.</p>
          <BotonWhatsApp mensaje={`Hola Play Shop Tek, quiero consultar por mi reparación ${rep.codigo}.`} lugar="arriba" flecha className={botonRosa}>
            <Icono nombre="whatsapp" tam={17} /> Consultar por WhatsApp
          </BotonWhatsApp>
        </div>
      )}
    </section>
  )
}