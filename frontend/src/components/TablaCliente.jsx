// HU-26: piezas de "Mis compras" y "Mis reparaciones": título con las pestañas Compras / Reparaciones.
import { Link } from 'react-router-dom'

export function PestanasCliente({ actual }) {
  const pestana = (a, t) => (
    <Link to={a} aria-current={actual === a ? 'page' : undefined}
      className={'px-4 py-2 text-sm ' + (actual === a ? 'bg-rosa/15 font-semibold text-rosa' : 'bg-superficie hover:bg-tinta/5')}>{t}</Link>
  )
  return (
    <nav aria-label="Mis compras o mis reparaciones" className="flex overflow-hidden rounded-lg border border-tinta/15">
      {pestana('/mis-compras', 'Compras')}{pestana('/mis-reparaciones', 'Reparaciones')}
    </nav>
  )
}
