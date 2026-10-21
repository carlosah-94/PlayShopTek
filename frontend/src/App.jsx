import { useEffect, useState } from 'react'
import { Link, Route, Routes, useNavigate } from 'react-router-dom'
import Carrito from './pages/Carrito.jsx'
import Catalogo from './pages/Catalogo.jsx'
import Ficha from './pages/Ficha.jsx'
import Inventario from './pages/Inventario.jsx'
import Login from './pages/Login.jsx'
import MisCompras from './pages/MisCompras.jsx'
import Panel from './pages/Panel.jsx'
import Rastreo from './pages/Rastreo.jsx'
import Tablero from './pages/Tablero.jsx'
import Taller from './pages/Taller.jsx'
import { cerrarSesion, leerSesion } from './api.js'
import { leerCarrito, unidades } from './carrito.js'

export default function App() {
  const sesion = leerSesion()
  const navegar = useNavigate()
  const salir = () => { cerrarSesion(); navegar('/') }
  // Contador del carrito: se actualiza cada vez que carrito.js avisa un cambio
  const [enCarrito, setEnCarrito] = useState(unidades(leerCarrito()))
  useEffect(() => {
    const actualizar = () => setEnCarrito(unidades(leerCarrito()))
    window.addEventListener('carrito', actualizar)
    return () => window.removeEventListener('carrito', actualizar)
  }, [])

  return (
    <div className="min-h-screen">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-8">
        <Link to="/" className="flex items-center gap-2 font-bold tracking-wide">
          <img src="/logo.jpg" alt="" className="h-9 w-9 rounded-full object-cover" />
          PLAY SHOP TEK
        </Link>
        <nav className="ml-auto flex items-center gap-4 text-sm">
          <Link to="/" className="hover:text-rosa">Tienda</Link>
          <Link to="/rastreo" className="hover:text-rosa">Rastrear reparación</Link>
          <Link to="/carrito" className="hover:text-rosa">Carrito ({enCarrito})</Link>
          {sesion && sesion.usuario.rol === 'cliente' && <Link to="/mis-compras" className="hover:text-rosa">Mis compras</Link>}
          {sesion && sesion.usuario.rol !== 'cliente' && <Link to="/panel" className="hover:text-rosa">Panel</Link>}
          {sesion && sesion.usuario.rol !== 'cliente' && <Link to="/taller" className="hover:text-rosa">Taller</Link>}
          {sesion && sesion.usuario.rol === 'dueno' && <Link to="/inventario" className="hover:text-rosa">Inventario</Link>}
          {sesion && sesion.usuario.rol === 'dueno' && <Link to="/tablero" className="hover:text-rosa">Tablero</Link>}
          {sesion
            ? <button onClick={salir} className="rounded-lg border border-white/20 px-3 py-1.5">Salir ({sesion.usuario.nombre.split(' ')[0]})</button>
            : <Link to="/login" className="rounded-lg bg-rosa px-3 py-1.5 font-semibold text-white">Iniciar sesión</Link>}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
        <Routes>
          <Route path="/" element={<Catalogo />} />
          <Route path="/producto/:id" element={<Ficha />} />
          <Route path="/rastreo" element={<Rastreo />} />
          <Route path="/carrito" element={<Carrito />} />
          <Route path="/mis-compras" element={<MisCompras />} />
          <Route path="/login" element={<Login />} />
          <Route path="/panel" element={<Panel />} />
          <Route path="/taller" element={<Taller />} />
          <Route path="/inventario" element={<Inventario />} />
          <Route path="/tablero" element={<Tablero />} />
        </Routes>
      </main>
    </div>
  )
}