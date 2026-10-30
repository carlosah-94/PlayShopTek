// HU-24: "Servicios técnicos". Lo que Ángel enciende aquí es lo que el cliente ve en la página de inicio
// (sección de servicio técnico), sin precios: el precio se acuerda por WhatsApp.
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api, leerSesion } from '../api.js'
import Icono from '../components/Iconos.jsx'
import { Caja, Encabezado, botonRosa, campo } from '../components/PiezasPanel.jsx'

const ICONO = { 'ph ph-game-controller': 'mando', 'ph ph-wrench': 'llave', 'ph ph-disc': 'disco', 'ph ph-plug': 'enchufe', 'ph ph-cpu': 'pc', 'ph ph-desktop-tower': 'pc', 'ph ph-hard-drives': 'paquete' }
const VACIO = { nombre: '', detalle: '', tiempo: '' }

export default function ServiciosTecnicos() {
  const sesion = leerSesion()
  const [lista, setLista] = useState([])
  const [form, setForm] = useState(VACIO)
  const [error, setError] = useState('')
  useEffect(() => { api('/servicios?todos=true').then(setLista).catch((e) => setError(e.message)) }, [])
  if (!sesion || sesion.usuario.rol !== 'dueno') return <Navigate to="/login" />

  const alternar = async (s) => {
    try {
      const n = await api('/servicios/' + s.id, { metodo: 'PATCH', cuerpo: { activo: !s.activo } })
      setLista(lista.map((x) => (x.id === s.id ? n : x)))
    } catch (err) { setError(err.message) }
  }
  const agregar = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const n = await api('/servicios', { metodo: 'POST', cuerpo: { nombre: form.nombre, detalle: form.detalle || null, tiempo: form.tiempo || null } })
      setLista([...lista, n]); setForm(VACIO)
    } catch (err) { setError(err.message) }
  }
  const poner = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  return (
    <div className="space-y-5">
      <Encabezado titulo="Tipos de reparación que ofrecemos" detalle="Lo que enciendas acá es lo que el cliente ve en la tienda, sin precios." />
      {error && <p className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <ul className="space-y-3">
          {lista.map((s) => (
            <li key={s.id} className={'flex flex-wrap items-center gap-3 rounded-2xl border bg-superficie p-4 shadow-sm ' + (s.activo ? 'border-rosa/20' : 'border-tinta/10')}>
              <span className={s.activo ? 'text-rosa' : 'text-tinta/50'}><Icono nombre={ICONO[s.icono] || 'llave'} tam={22} /></span>
              <div className="min-w-0 flex-1 basis-48">
                <p className="font-medium">{s.nombre}</p>
                <p className="text-sm text-tinta/60">{[s.detalle, s.tiempo].filter(Boolean).join(' · ')}</p>
              </div>
              <button type="button" onClick={() => alternar(s)} aria-pressed={s.activo}
                className={'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold ' + (s.activo ? 'border-ok/40 text-ok' : 'border-tinta/20 text-tinta/70')}>
                <Icono nombre={s.activo ? 'check' : 'apagado'} tam={15} /> {s.activo ? 'Activo' : 'Apagado'}
              </button>
            </li>
          ))}
        </ul>
        <Caja titulo="Agregar un tipo nuevo" className="h-fit">
          <form onSubmit={agregar} className="space-y-3">
            <label className="block"><span className="mb-1 block text-xs text-tinta/60">Nombre del servicio</span>
              <input id="ns-nombre" value={form.nombre} onChange={poner('nombre')} placeholder="Ej: Cambio de pantalla PS Portal" className={campo} required minLength={3} /></label>
            <label className="block"><span className="mb-1 block text-xs text-tinta/60">Qué incluye</span>
              <input id="ns-detalle" value={form.detalle} onChange={poner('detalle')} placeholder="Diagnóstico, repuesto y prueba" className={campo} /></label>
            <label className="block"><span className="mb-1 block text-xs text-tinta/60">Tiempo aproximado</span>
              <input id="ns-tiempo" value={form.tiempo} onChange={poner('tiempo')} placeholder="1 a 2 días" className={campo} /></label>
            <button className={botonRosa + ' w-full'}><Icono nombre="mas" tam={16} /> Agregar servicio</button>
          </form>
          <p className="mt-3 border-t border-tinta/10 pt-3 text-xs text-tinta/60">Los servicios apagados dejan de aparecer en la tienda. No se muestran precios: se acuerdan por WhatsApp.</p>
        </Caja>
      </div>
    </div>
  )
}
