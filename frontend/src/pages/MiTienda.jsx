// HU-26: "Mi tienda": dónde está, horario, foto del local, Google Maps y los asesores (como el prototipo).
import { useNavigate } from 'react-router-dom'
import Asesores from '../components/Asesores.jsx'
import Icono from '../components/Iconos.jsx'
import { botonRosa } from '../components/PiezasPanel.jsx'

const MAPA = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Play Shop Tek, Av. Revolución 1420, Villa El Salvador, Lima')

export default function MiTienda() {
  const navegar = useNavigate()
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <button type="button" onClick={() => navegar(-1)} className="inline-flex items-center gap-1 text-sm font-semibold text-rosa hover:underline"><Icono nombre="flechaIzq" tam={14} /> Volver</button>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-morado">Ubícanos</p>
        <h1 className="text-3xl font-semibold">Mi tienda</h1>
        <p className="mt-1 text-tinta/80">Todas las compras se recogen aquí. Las reparaciones también se reciben y se entregan en el local.</p>
      </div>
      <section className="space-y-4 rounded-2xl border border-tinta/10 bg-superficie p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <p className="flex gap-3"><span className="text-rosa"><Icono nombre="pin" /></span><span><b className="font-medium">Dirección</b><br /><span className="text-sm text-tinta/80">Av. Revolución 1420, Villa El Salvador, Lima Sur</span></span></p>
          <p className="flex gap-3"><span className="text-rosa"><Icono nombre="reloj" /></span><span><b className="font-medium">Horario de atención</b><br /><span className="text-sm text-tinta/80">Lunes a sábado: 12:00–20:00<br />Domingo: 15:00–20:00</span></span></p>
        </div>
        <figure className="relative overflow-hidden rounded-xl">
          <img src="/inicio/carrusel-2.webp" alt="Fachada de la tienda Play Shop Tek en Villa El Salvador" width="1200" height="490" className="aspect-[2/1] w-full object-cover" />
          <figcaption className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/70 px-3 py-1 text-xs text-white"><Icono nombre="pin" tam={13} /> Vista del local · Av. Revolución 1420, VES</figcaption>
        </figure>
        <a href={MAPA} target="_blank" rel="noreferrer" className={botonRosa}><Icono nombre="mapa" tam={17} /> Ver en Google Maps</a>
      </section>
      <section className="space-y-3 rounded-2xl border border-tinta/10 bg-superficie p-5 shadow-sm">
        <h2 className="text-lg font-medium">Asesores disponibles</h2>
        <p className="text-sm text-tinta/80">Escríbenos por WhatsApp antes de venir: te confirmamos el stock y te separamos el producto.</p>
        <Asesores mensaje="Hola, quiero pasar por la tienda de Play Shop Tek. ¿Me confirman stock de un producto?" />
      </section>
    </div>
  )
}
