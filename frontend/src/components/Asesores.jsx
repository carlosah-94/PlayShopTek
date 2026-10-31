// HU-26: los dos asesores de la tienda por WhatsApp, como el prototipo.
// Todos los botones que llevan a WhatsApp (flotante, "Hablar con un asesor", "Cotizar", "Consultar")
// abren el mismo panel: cabecera verde con el saludo y los asesores para elegir. Cada uno abre
// WhatsApp con el mensaje ya escrito.
import { useEffect, useState } from 'react'
import Icono from './Iconos.jsx'

export const ASESORES = [['Asesor 1', '51915152886'], ['Asesor 2', '51999649195']]
export const enlaceWa = (numero, texto) => `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`
const SALUDO = '¡Hola! Haz clic en uno de nuestros agentes y te contactaremos lo antes posible'

// Un asesor: círculo con su número, punto verde y "Disponible"
function Asesor({ nombre, numero, n, mensaje, alElegir }) {
  return (
    <a href={enlaceWa(numero, mensaje)} target="_blank" rel="noreferrer" onClick={alElegir}
      className="flex items-center gap-3 rounded-[10px] border-l-[3px] border-[#25D366] bg-tinta/[0.04] p-2.5 text-tinta hover:bg-[#25D366]/15">
      <span className="relative grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#5546E4] to-[#DE1CBB] text-sm font-semibold text-white">
        {n}<span className="absolute -bottom-px -right-px h-3 w-3 rounded-full border-2 border-superficie bg-[#25D366]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{nombre}</span>
        <span className="flex items-center gap-1.5 text-xs text-ok"><span className="h-[7px] w-[7px] rounded-full bg-[#25D366]" />Disponible</span>
      </span>
      <span className="text-[#25D366]"><Icono nombre="whatsapp" tam={20} /></span>
    </a>
  )
}

// El panel completo: cabecera verde + asesores. verMensaje muestra «el mensaje que se enviará».
export function PanelWhatsApp({ mensaje, verMensaje = false, alCerrar, conCerrar = false }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-tinta/10 bg-superficie shadow-2xl">
      <div className="flex items-start gap-2.5 bg-[#0F7A40] px-4 py-3 text-white">
        <span className="shrink-0"><Icono nombre="whatsapp" tam={24} /></span>
        <p className="flex-1 text-[13px] leading-relaxed">{SALUDO}</p>
        {conCerrar && (
          <button type="button" onClick={alCerrar} aria-label="Cerrar" className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-md bg-black/20 hover:bg-black/30">
            <Icono nombre="cerrar" tam={14} />
          </button>
        )}
      </div>
      {verMensaje && <p className="px-3 pt-2.5 text-xs text-tinta/70">Mensaje: «{mensaje}»</p>}
      <div className="flex flex-col gap-1.5 p-2">
        {ASESORES.map(([nombre, numero], i) => (
          <Asesor key={numero} nombre={nombre} numero={numero} n={i + 1} mensaje={mensaje} alElegir={alCerrar} />
        ))}
      </div>
    </div>
  )
}

// Abre y cierra el panel (clic afuera o tecla Esc lo cierran)
export function useDesplegable() {
  const [abierto, setAbierto] = useState(false)
  useEffect(() => {
    if (!abierto) return
    const tecla = (e) => e.key === 'Escape' && setAbierto(false)
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [abierto])
  return [abierto, () => setAbierto(!abierto), () => setAbierto(false)]
}

// Cualquier botón que lleva a WhatsApp. lugar: dónde sale el panel respecto del botón.
const LUGAR = { abajo: 'left-0 top-[calc(100%+8px)]', arriba: 'left-0 bottom-[calc(100%+8px)]', arribaDer: 'right-0 bottom-[calc(100%+8px)]' }
export function BotonWhatsApp({ mensaje, children, className, lugar = 'abajo', verMensaje, conCerrar, flecha = false, ancho = 'w-[min(320px,86vw)]' }) {
  const [abierto, alternar, cerrar] = useDesplegable()
  return (
    <div className="relative">
      <button type="button" onClick={alternar} aria-expanded={abierto} aria-haspopup="true" className={className}>
        {children}
        {flecha && <span className={'transition-transform ' + (abierto ? 'rotate-180' : '')}><Icono nombre="flechaAbajo" tam={12} /></span>}
      </button>
      {abierto && (
        <>
          <div className="fixed inset-0 z-40" onClick={cerrar} aria-hidden="true" />
          <div className={'absolute z-50 ' + ancho + ' ' + LUGAR[lugar]}>
            <PanelWhatsApp mensaje={mensaje} verMensaje={verMensaje} alCerrar={cerrar} conCerrar={conCerrar} />
          </div>
        </>
      )}
    </div>
  )
}

// La lista de asesores dentro de una página (Mi tienda, Reparaciones)
export default function Asesores({ mensaje }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {ASESORES.map(([nombre, numero], i) => (
        <li key={numero}><Asesor nombre={nombre} numero={numero} n={i + 1} mensaje={mensaje} /></li>
      ))}
    </ul>
  )
}
