// HU-04: reservar un juego en preventa pagando solo la reserva; el resto se paga al recogerlo.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, leerSesion } from '../api.js'

const YAPE_TIENDA = '987 654 321' // EJEMPLO: cambiar por el número de Yape real de la tienda
const soles = (n) => 'S/ ' + Number(n).toLocaleString('es-PE')
const fecha = (iso) => new Date(iso + 'T12:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'long' })

export default function ReservaPreventa({ p }) {
  const esCliente = leerSesion()?.usuario.rol === 'cliente'
  const [metodo, setMetodo] = useState('yape')
  const [operacion, setOperacion] = useState('')
  const [reserva, setReserva] = useState(null)
  const [error, setError] = useState('')

  const resto = Number(p.precio_final) - Number(p.monto_reserva)

  const reservar = async () => {
    setError('')
    try {
      setReserva(await api('/ventas/reserva', { metodo: 'POST', cuerpo: {
        producto_id: p.id, metodo_pago: metodo, numero_operacion: metodo === 'yape' ? (operacion.trim() || null) : null } }))
    } catch (err) {
      setError(err.message)
    }
  }

  if (reserva) {
    return (
      <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-4 text-sm">
        <p className="font-semibold">¡Reserva confirmada! Código <span className="font-mono text-rosa">{reserva.codigo}</span></p>
        <p>Pagaste {soles(reserva.total)}. Paga los {soles(resto)} restantes al recogerlo
          {p.fecha_lanzamiento ? ' desde el ' + fecha(p.fecha_lanzamiento) : ''}.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-morado/60 bg-morado/10 p-4 text-sm">
      <p className="font-semibold">
        Preventa{p.fecha_lanzamiento ? ' · sale el ' + fecha(p.fecha_lanzamiento) : ''}
        {p.cupos_reserva !== null && <span className="font-normal text-tinta/70"> · quedan {p.cupos_reserva} cupos</span>}
      </p>
      <p>Reserva hoy con <b>{soles(p.monto_reserva)}</b> y paga los {soles(resto)} restantes al recogerlo en tienda.</p>

      {p.cupos_reserva === 0 ? <p className="text-error">Se acabaron los cupos de reserva.</p>
        : !esCliente ? <Link to={'/login?volver=/producto/' + p.id} className="text-rosa">Inicia sesión para reservar</Link>
        : (
          <>
            <div className="flex gap-4">
              {[['yape', 'Yape'], ['tarjeta', 'Tarjeta (simulado)']].map(([k, nombre]) => (
                <label key={k} className="flex items-center gap-1">
                  <input type="radio" name="metodo-reserva" checked={metodo === k} onChange={() => { setMetodo(k); setError('') }} /> {nombre}
                </label>
              ))}
            </div>
            {metodo === 'yape' && (
              <input placeholder={`N.° de operación (yapea ${soles(p.monto_reserva)} al ${YAPE_TIENDA})`} value={operacion}
                onChange={(e) => setOperacion(e.target.value)} inputMode="numeric"
                className="w-full rounded-lg border border-tinta/15 bg-superficie px-3 py-2" />
            )}
            {error && <p className="text-error">{error}</p>}
            <button onClick={reservar} className="rounded-lg bg-rosa px-5 py-2 font-semibold text-white">Reservar con {soles(p.monto_reserva)}</button>
          </>
        )}
    </div>
  )
}