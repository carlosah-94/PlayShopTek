// HU-24: "Mi equipo". Ángel crea las cuentas de sus trabajadoras (nadie del equipo se registra solo),
// les da una contraseña temporal y puede desactivar una cuenta sin perder su historial.
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api, leerSesion } from '../api.js'
import Icono from '../components/Iconos.jsx'
import { Caja, Encabezado, botonRosa, campo } from '../components/PiezasPanel.jsx'

const VACIO = { nombre: '', email: '', telefono: '' }
const desde = (iso) => (iso ? new Date(iso + 'T12:00').toLocaleDateString('es-PE', { month: 'long', year: 'numeric' }) : '')

export default function MiEquipo() {
  const sesion = leerSesion()
  const [lista, setLista] = useState([])
  const [form, setForm] = useState(VACIO)
  const [clave, setClave] = useState(null) // { nombre, email, clave } que se muestra una sola vez
  const [error, setError] = useState('')
  useEffect(() => { api('/equipo').then(setLista).catch((e) => setError(e.message)) }, [])
  if (!sesion || sesion.usuario.rol !== 'dueno') return <Navigate to="/login" />

  const reemplazar = (t) => setLista((l) => (l.some((x) => x.usuario_id === t.usuario_id) ? l.map((x) => (x.usuario_id === t.usuario_id ? t : x)) : [...l, t]))
  const mostrarClave = (t) => setClave({ nombre: t.nombre.split(' ')[0], email: t.email, clave: t.clave_temporal })

  const crear = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const t = await api('/equipo', { metodo: 'POST', cuerpo: { ...form, telefono: form.telefono.replace(/\s/g, '') || null } })
      reemplazar(t); mostrarClave(t); setForm(VACIO)
    } catch (err) {
      setError(err.message)
    }
  }
  const restablecer = async (t) => {
    try { const n = await api(`/equipo/${t.usuario_id}/clave`, { metodo: 'POST' }); reemplazar(n); mostrarClave(n) } catch (err) { setError(err.message) }
  }
  const activar = async (t) => {
    try { reemplazar(await api(`/equipo/${t.usuario_id}`, { metodo: 'PATCH', cuerpo: { activo: !t.activo } })) } catch (err) { setError(err.message) }
  }
  const activos = lista.filter((t) => t.activo).length
  const poner = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  return (
    <div className="space-y-5">
      <Encabezado titulo="Mi equipo" detalle="Las cuentas del personal las creas tú: nadie del equipo se registra por su cuenta. Al desactivar una cuenta se conserva todo el historial de reparaciones y ventas que atendió." />
      {error && <p className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}
      {clave && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-ok/40 bg-ok/10 p-4 text-sm">
          <Icono nombre="llaveClave" />
          <p className="min-w-0 flex-1 basis-64">Contraseña temporal de <b>{clave.nombre}</b> ({clave.email}): <code className="rounded bg-superficie px-2 py-0.5 font-mono text-base">{clave.clave}</code>. Dásela en persona o por WhatsApp; solo se muestra esta vez.</p>
          <button type="button" onClick={() => setClave(null)} className="text-sm font-semibold hover:underline">Entendido</button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Trabajadores <span className="text-sm font-normal text-tinta/60">{activos} activos de {lista.length} · las cuentas las crea Ángel</span></h2>
          {lista.map((t) => (
            <Caja key={t.usuario_id} className={t.activo ? '' : 'opacity-70'}>
              <div className="flex flex-wrap items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-rosa to-morado font-semibold text-white">{t.nombre[0]}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-lg">{t.nombre}
                    <span className={'rounded-md border px-2 py-0.5 text-xs ' + (t.activo ? 'border-morado/40 bg-morado/10 text-morado' : 'border-tinta/20 text-tinta/60')}>{t.activo ? 'Cuenta activa' : 'Desactivada'}</span>
                  </p>
                  <p className="text-sm text-tinta/60">Trabajadora · vendedora y técnica{t.fecha_ingreso ? ' · desde ' + desde(t.fecha_ingreso) : ''}</p>
                </div>
              </div>
              <div className="mt-3 grid gap-2 border-b border-tinta/10 pb-3 text-sm sm:grid-cols-3">
                <span className="flex items-center gap-2"><Icono nombre="correo" tam={16} /> {t.email}</span>
                <span className="flex items-center gap-2"><Icono nombre="whatsapp" tam={16} /> {t.telefono || '—'}</span>
                <span className="flex items-center gap-2"><Icono nombre="historial" tam={16} /> {t.reparaciones_atendidas} reparaciones atendidas</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => restablecer(t)} className="inline-flex items-center gap-2 rounded-lg border border-tinta/15 px-3 py-1.5 text-sm font-semibold hover:bg-tinta/5">
                  <Icono nombre="llaveClave" tam={15} /> Restablecer contraseña
                </button>
                <button type="button" onClick={() => activar(t)}
                  className={'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold ' + (t.activo ? 'border-aviso/40 text-aviso' : 'border-ok/40 text-ok')}>
                  <Icono nombre={t.activo ? 'usuarioMenos' : 'usuarioMas'} tam={15} /> {t.activo ? 'Desactivar cuenta' : 'Volver a activar'}
                </button>
              </div>
            </Caja>
          ))}
          {lista.length === 0 && <p className="text-sm text-tinta/60">Todavía no hay trabajadores.</p>}
        </div>

        <Caja titulo="Agregar un trabajador" className="h-fit">
          <p className="-mt-2 mb-3 text-sm text-tinta/60">Se crea su cuenta de acceso al panel: podrá registrar y actualizar reparaciones, nunca las cifras del negocio.</p>
          <form onSubmit={crear} className="space-y-3">
            <label className="block"><span className="mb-1 block text-xs text-tinta/60">Nombre y apellido</span>
              <input id="nt-nombre" value={form.nombre} onChange={poner('nombre')} placeholder="Ej: Rosa Huamán" className={campo} required minLength={3} /></label>
            <label className="block"><span className="mb-1 block text-xs text-tinta/60">Correo de acceso</span>
              <input id="nt-email" type="email" value={form.email} onChange={poner('email')} placeholder="rosa@playshoptek.pe" className={campo} required /></label>
            <label className="block"><span className="mb-1 block text-xs text-tinta/60">Teléfono</span>
              <input id="nt-tel" value={form.telefono} onChange={poner('telefono')} placeholder="9xx xxx xxx" className={campo} pattern="9[0-9 ]{8,10}" title="9 dígitos, empieza con 9" /></label>
            <button className={botonRosa + ' w-full'}><Icono nombre="usuarioMas" tam={16} /> Crear cuenta de acceso</button>
          </form>
          <p className="mt-3 border-t border-tinta/10 pt-3 text-xs text-tinta/60">Se crea con una contraseña temporal que verás aquí una sola vez para dársela a la trabajadora.</p>
        </Caja>
      </div>
    </div>
  )
}
