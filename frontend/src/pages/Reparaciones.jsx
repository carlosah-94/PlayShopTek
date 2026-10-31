// HU-26: página "Reparaciones" como el prototipo: cómo funciona en 4 pasos, qué reparamos (sin precios),
// los asesores por WhatsApp y, si el cliente inició sesión, sus reparaciones en curso.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, leerSesion } from '../api.js'
import Asesores, { BotonWhatsApp } from '../components/Asesores.jsx'
import Icono from '../components/Iconos.jsx'
import { Estado, botonRosa } from '../components/PiezasPanel.jsx'

const ICONO = { 'ph ph-game-controller': 'mando', 'ph ph-wrench': 'llave', 'ph ph-disc': 'disco', 'ph ph-plug': 'enchufe', 'ph ph-cpu': 'pc', 'ph ph-desktop-tower': 'pc' }
const PASOS = ['Revisa qué equipos y fallas atendemos', 'Escríbele a un asesor por WhatsApp: ahí acuerdan diagnóstico y precio',
  'Pagas por Yape o en tienda y avisas por WhatsApp', 'Te damos un código de seguimiento para ver el estado de tu equipo aquí, sin necesidad de cuenta']

export default function Reparaciones() {
  const esCliente = leerSesion()?.usuario.rol === 'cliente'
  const [servicios, setServicios] = useState([])
  const [mias, setMias] = useState([])
  useEffect(() => {
    api('/servicios').then(setServicios).catch(() => {})
    if (esCliente) api('/mi/reparaciones').then((rs) => setMias(rs.filter((r) => r.estado !== 'entregado'))).catch(() => {})
  }, [])

  return (
    <div className="space-y-8">
      <section className="grid gap-6 rounded-3xl border border-morado/20 bg-gradient-to-br from-morado/10 via-morado/5 to-rosa/10 p-6 sm:p-8 lg:grid-cols-2 lg:items-center">
        <div className="space-y-4">
          <p className="inline-block rounded-md border border-morado/30 bg-morado/10 px-2 py-0.5 text-xs font-semibold text-morado">Servicio técnico</p>
          <h1 className="text-3xl font-semibold sm:text-4xl">Reparamos tu consola, mando o PC</h1>
          <p className="text-tinta/80">Mira abajo qué equipos y fallas atendemos. El diagnóstico, el precio y el pago se coordinan directamente por WhatsApp con un asesor, y luego sigues el estado de tu equipo desde tu cuenta.</p>
          <div className="flex flex-wrap gap-2">
            <BotonWhatsApp mensaje="Hola Play Shop Tek, quiero cotizar una reparación." conCerrar className={botonRosa}><Icono nombre="whatsapp" tam={17} /> Cotizar por WhatsApp</BotonWhatsApp>
            <Link to="/rastreo" className="inline-flex items-center gap-2 rounded-lg border border-tinta/20 bg-superficie px-4 py-2 text-sm font-semibold hover:bg-tinta/5"><Icono nombre="buscar" tam={15} /> Rastrea tu reparación</Link>
          </div>
        </div>
        <ol className="space-y-2">
          {PASOS.map((p, i) => (
            <li key={p} className="flex items-center gap-3 rounded-xl border border-morado/15 bg-superficie/70 px-4 py-3 text-sm">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-morado/40 text-xs font-semibold text-morado">{i + 1}</span>{p}
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-2xl font-semibold">Qué reparamos</h2>
          <p className="text-sm text-tinta/70">No publicamos precios: cada equipo se revisa y el precio se acuerda por WhatsApp.</p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {servicios.map((s) => (
            <li key={s.id} className="flex flex-col gap-2 rounded-2xl border border-tinta/10 bg-superficie p-4 shadow-sm">
              <span className="text-rosa"><Icono nombre={ICONO[s.icono] || 'llave'} tam={24} /></span>
              <h3 className="font-medium">{s.nombre}</h3>
              <p className="flex-1 text-sm text-tinta/70">{[s.detalle, s.tiempo].filter(Boolean).join(' · ')}</p>
              {/* Como el prototipo: el panel sale encima del botón y muestra el mensaje que se enviará */}
              <div className="ml-auto">
                <BotonWhatsApp mensaje={'Hola, quiero consultar sobre: ' + s.nombre} verMensaje conCerrar lugar="arribaDer" ancho="w-[min(290px,80vw)]"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-tinta/15 px-3 py-1.5 text-sm font-semibold hover:bg-tinta/5 aria-expanded:border-[#25D366]/60 aria-expanded:bg-[#25D366]/10">
                  <span className="text-[#1f9d55]"><Icono nombre="whatsapp" tam={15} /></span> Consultar
                </BotonWhatsApp>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-2xl border border-tinta/10 bg-superficie p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-medium"><span className="text-ok"><Icono nombre="whatsapp" /></span> Habla con un asesor</h2>
        <p className="text-sm text-tinta/80">Cuéntale la falla y, si puedes, mándale un video. Acuerdan el diagnóstico y el precio, pagas por Yape o en tienda y nosotros registramos tu equipo: lo ves en <b>Mis reparaciones</b>.</p>
        <Asesores mensaje="Hola Play Shop Tek, quiero cotizar una reparación." />
      </section>

      {esCliente && mias.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Tus reparaciones en curso</h2>
          <ul className="space-y-3">
            {mias.map((r) => (
              <li key={r.codigo} className="flex flex-wrap items-center gap-3 rounded-2xl border border-tinta/10 bg-superficie p-4 shadow-sm">
                <span className="text-morado"><Icono nombre="llave" /></span>
                <div className="min-w-0 flex-1 basis-48"><p className="font-medium">{r.equipo} · {r.codigo}</p><p className="text-sm text-tinta/70">{r.falla}</p></div>
                <Estado estado={r.estado} />
                <Link to={'/rastreo?codigo=' + r.codigo} className={botonRosa}><Icono nombre="ver" tam={15} /> Ver seguimiento</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
