// HU-16: una sola entrada para todos; te lleva a la tienda o al panel según tu cuenta.
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, guardarSesion } from '../api.js'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navegar = useNavigate()
  const [params] = useSearchParams()

  const entrar = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const datos = await api('/auth/login', { metodo: 'POST', cuerpo: { email, password } })
      guardarSesion(datos)
      navegar(params.get('volver') || (datos.usuario.rol === 'cliente' ? '/' : '/panel'))
    } catch (err) {
      setError(err.message)
    }
  }

  const campo = 'w-full rounded-lg border border-tinta/15 bg-superficie px-3 py-2'
  return (
    <form onSubmit={entrar} className="mx-auto mt-6 max-w-sm space-y-3 rounded-xl border border-tinta/10 bg-superficie/50 p-6">
      <h1 className="text-xl font-bold">Iniciar sesión</h1>
      <input type="email" placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} className={campo} required />
      <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} className={campo} required />
      {error && <p className="text-sm text-error">{error}</p>}
      <button className="w-full rounded-lg bg-rosa py-2 font-semibold text-white">Entrar</button>
      {/* Solo en la PC del programador (npm run dev); en la web publicada no aparece */}
      {import.meta.env.DEV && (
        <p className="text-xs text-tinta/60">Prueba: angel@playshoptek.pe / tienda123 · linda@playshoptek.pe / tienda123 · cliente@demo.pe / demo123</p>
      )}
    </form>
  )
}