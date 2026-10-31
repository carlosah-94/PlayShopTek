// HU-26: "Mi cuenta": el cliente cambia sus datos de contacto y su contraseña, como en el prototipo.
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api, guardarSesion, leerSesion } from '../api.js'
import Icono from '../components/Iconos.jsx'
import { botonRosa, campo } from '../components/PiezasPanel.jsx'

const Etiqueta = ({ htmlFor, children }) => <label htmlFor={htmlFor} className="mb-1 block text-xs text-tinta/70">{children}</label>

export default function MiCuenta() {
  const sesion = leerSesion()
  const [seccion, setSeccion] = useState('datos')
  const [perfil, setPerfil] = useState(null)
  const [clave, setClave] = useState({ actual: '', nueva: '', repetir: '' })
  const [aviso, setAviso] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { if (sesion?.usuario.rol === 'cliente') api('/mi/perfil').then(setPerfil).catch((e) => setError(e.message)) }, [])
  if (sesion?.usuario.rol !== 'cliente') return <Navigate to="/login?volver=/mi-cuenta" />

  const elegir = (s) => { setSeccion(s); setAviso(''); setError('') }
  const guardar = async (e) => {
    e.preventDefault()
    setAviso(''); setError('')
    try {
      const p = await api('/mi/perfil', { metodo: 'PUT', cuerpo: { ...perfil, telefono: (perfil.telefono || '').replace(/\s/g, '') || null } })
      setPerfil(p)
      // El nombre y el correo de la cabecera se actualizan sin volver a iniciar sesión
      guardarSesion({ ...sesion, usuario: { ...sesion.usuario, nombre: p.nombre, email: p.email } })
      setAviso('Listo, tus datos se guardaron.')
    } catch (err) { setError(err.message) }
  }
  const cambiarClave = async (e) => {
    e.preventDefault()
    setAviso(''); setError('')
    if (clave.nueva !== clave.repetir) return setError('La nueva contraseña no coincide en los dos campos.')
    try {
      await api('/mi/clave', { metodo: 'POST', cuerpo: { actual: clave.actual, nueva: clave.nueva } })
      setClave({ actual: '', nueva: '', repetir: '' })
      setAviso('Listo, tu contraseña se cambió. Úsala la próxima vez que entres.')
    } catch (err) { setError(err.message) }
  }
  const poner = (k) => (e) => setPerfil({ ...perfil, [k]: e.target.value })
  const opcion = (s, ic, t) => (
    <button type="button" onClick={() => elegir(s)} aria-pressed={seccion === s}
      className={'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ' + (seccion === s ? 'border border-rosa/40 bg-rosa/15 font-semibold' : 'hover:bg-tinta/5')}>
      <Icono nombre={ic} tam={17} /> {t}
    </button>
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-semibold">Mi cuenta</h1>
        <p className="mt-1 text-sm text-tinta/70">Tus datos de contacto y la contraseña con la que entras a la tienda.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label="Secciones de mi cuenta" className="h-fit space-y-1 rounded-2xl border border-tinta/10 bg-superficie p-2 shadow-sm">
          {opcion('datos', 'usuario', 'Información general')}
          {opcion('clave', 'candado', 'Cambiar contraseña')}
        </nav>
        <section className="min-w-0 rounded-2xl border border-tinta/10 bg-superficie p-5 shadow-sm">
          {aviso && <p className="mb-4 rounded-lg border border-ok/40 p-3 text-sm text-ok">{aviso}</p>}
          {error && <p className="mb-4 rounded-lg border border-error/40 p-3 text-sm text-error">{error}</p>}
          {seccion === 'datos' && perfil && (
            <form onSubmit={guardar} className="space-y-4">
              <div>
                <h2 className="text-lg font-medium">Información general</h2>
                <p className="text-sm text-tinta/70">Con estos datos preparamos tus pedidos para recojo y tus reparaciones.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div><Etiqueta htmlFor="mc-nombre">Nombre y apellido</Etiqueta>
                  <input id="mc-nombre" value={perfil.nombre} onChange={poner('nombre')} className={campo} required minLength={2} /></div>
                <div><Etiqueta htmlFor="mc-email">Correo</Etiqueta>
                  <input id="mc-email" type="email" value={perfil.email} onChange={poner('email')} className={campo} required /></div>
                <div><Etiqueta htmlFor="mc-tel">WhatsApp</Etiqueta>
                  <input id="mc-tel" value={perfil.telefono || ''} onChange={poner('telefono')} placeholder="9xx xxx xxx" className={campo}
                    pattern="9[0-9 ]{8,10}" title="9 dígitos, empieza con 9" /></div>
                <div><Etiqueta htmlFor="mc-distrito">Distrito</Etiqueta>
                  <input id="mc-distrito" value={perfil.distrito || ''} onChange={poner('distrito')} placeholder="Villa El Salvador" className={campo} /></div>
              </div>
              <button className={botonRosa}><Icono nombre="check" tam={16} /> Guardar cambios</button>
            </form>
          )}
          {seccion === 'clave' && (
            <form onSubmit={cambiarClave} className="max-w-md space-y-4">
              <h2 className="text-lg font-medium">Cambiar contraseña</h2>
              <div><Etiqueta htmlFor="mc-actual">Contraseña actual</Etiqueta>
                <input id="mc-actual" type="password" autoComplete="current-password" value={clave.actual} onChange={(e) => setClave({ ...clave, actual: e.target.value })} className={campo} required /></div>
              <div><Etiqueta htmlFor="mc-nueva">Nueva contraseña (mínimo 6 caracteres)</Etiqueta>
                <input id="mc-nueva" type="password" autoComplete="new-password" minLength={6} value={clave.nueva} onChange={(e) => setClave({ ...clave, nueva: e.target.value })} className={campo} required /></div>
              <div><Etiqueta htmlFor="mc-repetir">Repite la nueva contraseña</Etiqueta>
                <input id="mc-repetir" type="password" autoComplete="new-password" minLength={6} value={clave.repetir} onChange={(e) => setClave({ ...clave, repetir: e.target.value })} className={campo} required /></div>
              <button className={botonRosa}><Icono nombre="candado" tam={16} /> Cambiar contraseña</button>
            </form>
          )}
        </section>
      </div>
    </div>
  )
}
