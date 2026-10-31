// HU-16: una sola entrada para todos; te lleva a la tienda o al panel según tu cuenta.
// HU-26: con el diseño del prototipo y la opción "Crear una cuenta" para clientes nuevos.
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, guardarSesion } from '../api.js'
import Icono from '../components/Iconos.jsx'
import { campo } from '../components/PiezasPanel.jsx'

const Etiqueta = ({ htmlFor, children }) => <label htmlFor={htmlFor} className="mb-1 block text-xs text-tinta/70">{children}</label>

export default function Login() {
  const [params] = useSearchParams()
  const [modo, setModo] = useState(params.get('crear') ? 'crear' : 'entrar')
  const [datos, setDatos] = useState({ nombre: '', email: '', telefono: '', password: '' })
  const [error, setError] = useState('')
  const navegar = useNavigate()
  const poner = (k) => (e) => setDatos({ ...datos, [k]: e.target.value })

  const enviar = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const r = modo === 'entrar'
        ? await api('/auth/login', { metodo: 'POST', cuerpo: { email: datos.email, password: datos.password } })
        : await api('/auth/registro', { metodo: 'POST', cuerpo: { ...datos, telefono: datos.telefono.replace(/\s/g, '') || null } })
      guardarSesion(r)
      navegar(params.get('volver') || (r.usuario.rol === 'cliente' ? '/' : '/panel'))
    } catch (err) {
      setError(err.message)
    }
  }
  const cambiar = () => { setModo(modo === 'entrar' ? 'crear' : 'entrar'); setError('') }

  return (
    <form onSubmit={enviar} className="mx-auto mt-4 max-w-md space-y-4 rounded-2xl border border-tinta/10 bg-superficie p-7 shadow-sm">
      <div>
        <h1 className="text-3xl font-semibold">{modo === 'entrar' ? 'Iniciar sesión' : 'Crear una cuenta'}</h1>
        <p className="mt-1 text-sm text-tinta/70">
          {modo === 'entrar' ? 'Una sola entrada para todos: te llevamos a la tienda o al panel según tu cuenta.'
            : 'Con tu cuenta sigues tus compras y reparaciones, guardas favoritos y te avisamos cuando algo llegue.'}
        </p>
      </div>
      {modo === 'crear' && (
        <>
          <div><Etiqueta htmlFor="login-nombre">Nombre y apellido</Etiqueta>
            <input id="login-nombre" value={datos.nombre} onChange={poner('nombre')} autoComplete="name" className={campo} required minLength={2} /></div>
          <div><Etiqueta htmlFor="login-tel">WhatsApp (opcional: así ves también lo que compraste en la tienda)</Etiqueta>
            <input id="login-tel" value={datos.telefono} onChange={poner('telefono')} placeholder="9xx xxx xxx" autoComplete="tel" className={campo}
              pattern="9[0-9 ]{8,10}" title="9 dígitos, empieza con 9" /></div>
        </>
      )}
      <div><Etiqueta htmlFor="login-email">Correo</Etiqueta>
        <input id="login-email" type="email" placeholder="tucorreo@gmail.com" value={datos.email} onChange={poner('email')} autoComplete="email" className={campo} required /></div>
      <div><Etiqueta htmlFor="login-clave">Contraseña{modo === 'crear' ? ' (mínimo 6 caracteres)' : ''}</Etiqueta>
        <input id="login-clave" type="password" value={datos.password} onChange={poner('password')} minLength={modo === 'crear' ? 6 : undefined}
          autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} className={campo} required /></div>
      {error && <p className="rounded-lg border border-error/40 p-3 text-sm text-error">{error}</p>}
      <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-rosa to-[#8b2fd9] py-2.5 font-semibold text-white shadow-md">
        <Icono nombre={modo === 'entrar' ? 'entrar' : 'usuarioMas'} tam={17} /> {modo === 'entrar' ? 'Iniciar sesión' : 'Crear cuenta'}
      </button>
      <p className="text-center text-sm">
        {modo === 'entrar' ? '¿Primera vez aquí? ' : '¿Ya tienes cuenta? '}
        <button type="button" onClick={cambiar} className="font-semibold text-rosa hover:underline">{modo === 'entrar' ? 'Crear una cuenta' : 'Inicia sesión'}</button>
      </p>
      {modo === 'crear' && <p className="text-xs text-tinta/70">Al crear tu cuenta aceptas los <Link to="/terminos" className="underline">Términos</Link> y la <Link to="/privacidad" className="underline">Política de privacidad</Link>.</p>}
      {/* Solo en la PC del programador (npm run dev); en la web publicada no aparece */}
      {import.meta.env.DEV && (
        <p className="border-t border-tinta/10 pt-3 text-xs text-tinta/70"><b className="font-semibold uppercase tracking-wide text-morado">Cuentas de prueba</b><br />
          Cliente: cliente@demo.pe / demo123 · Dueño: angel@playshoptek.pe · Trabajadora: linda@playshoptek.pe / tienda123</p>
      )}
    </form>
  )
}
