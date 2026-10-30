// Panel del equipo: cada perfil ve solo lo suyo.
// HU-24: Ángel ve el tablero del negocio; Linda ve "así va el taller hoy", sin las cifras del negocio.
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api, leerSesion } from '../api.js'
import Icono from '../components/Iconos.jsx'
import { Caja, Encabezado, Indicador } from '../components/PiezasPanel.jsx'
import Tablero, { ReparacionesActivas, StockBajo } from './Tablero.jsx'

// Lo que Linda puede y no puede hacer (tarjeta "Tu acceso" del prototipo)
const ACCESO = [
  [true, 'Reparaciones: recibir equipos, diagnosticar y actualizar estados'],
  [true, 'Ventas: registrar las del mostrador y WhatsApp, y avisar cuando un pedido está listo'],
  [true, 'Reseñas de productos y del servicio técnico'],
  [false, 'Ventas totales, ticket promedio y comparativas: solo Ángel'],
  [false, 'Precios y stock del catálogo: solo Ángel'],
]

function TableroTaller({ usuario }) {
  const [taller, setTaller] = useState([])
  const [stockBajo, setStockBajo] = useState([])
  const [error, setError] = useState('')
  useEffect(() => {
    api('/reparaciones').then(setTaller).catch((e) => setError(e.message))
    api('/productos/stock-bajo').then(setStockBajo).catch(() => {})
  }, [])

  const nombre = usuario.nombre.split(' ')[0]
  const pendientes = taller.filter((r) => r.pago === 'pendiente').length
  const listos = taller.filter((r) => r.estado === 'listo_para_recoger').length
  const aCargo = taller.filter((r) => r.tecnico === nombre).length
  const hoy = new Date().toISOString().slice(0, 10)
  const deHoy = taller.filter((r) => r.fecha_ingreso === hoy).length

  return (
    <div className="space-y-5">
      <Encabezado titulo={`Hola ${nombre}, así va el taller hoy`} detalle="Reparaciones registradas y su estado">
        <span className="inline-flex items-center gap-2 rounded-lg border border-rosa/40 px-3 py-2 text-xs text-rosa">
          <Icono nombre="candado" tam={14} /> Sin acceso a cifras del negocio
        </span>
      </Encabezado>
      {error && <p className="text-sm text-error">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador titulo="Pagos pendientes" valor={pendientes} icono="ventas" detalle="se cobran por Yape o en tienda" tono="text-aviso" />
        <Indicador titulo="Reparaciones activas" valor={taller.length} icono="llave" detalle={`${listos} listas para recoger`} tono="text-ok" />
        <Indicador titulo="Recibidas hoy" valor={deHoy} icono="check" detalle="equipos que entraron hoy" />
        <Indicador titulo="A mi cargo" valor={aCargo} icono="escudo" detalle={`Equipos asignados a ${nombre}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ReparacionesActivas lista={taller} />
        <StockBajo productos={stockBajo} puedeReponer={false} />
        <Caja titulo={<span className="flex items-center gap-2"><Icono nombre="escudo" tam={18} /> Tu acceso</span>}>
          <ul className="space-y-3 text-sm">
            {ACCESO.map(([puede, texto]) => (
              <li key={texto} className={'flex gap-2 ' + (puede ? '' : 'text-tinta/60')}>
                <span className={puede ? 'text-ok' : 'text-aviso'}><Icono nombre={puede ? 'check' : 'candado'} tam={18} /></span>
                <span>{texto}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-tinta/10 pt-3 text-xs text-tinta/60">¿Necesitas cambiar un precio del catálogo? Pídeselo a Ángel.</p>
        </Caja>
      </div>
    </div>
  )
}

export default function Panel() {
  const sesion = leerSesion()
  if (!sesion || sesion.usuario.rol === 'cliente') return <Navigate to="/login" />
  return sesion.usuario.rol === 'dueno' ? <Tablero usuario={sesion.usuario} /> : <TableroTaller usuario={sesion.usuario} />
}
