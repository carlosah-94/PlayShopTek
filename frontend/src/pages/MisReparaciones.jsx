// HU-26: "Mis reparaciones": los equipos que el cliente dejó en el taller, con su estado (como el prototipo).
import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api, leerSesion } from '../api.js'
import Icono from '../components/Iconos.jsx'
import { Estado, Filtros, FILTROS_VACIOS, pasaFiltros, soles } from '../components/PiezasPanel.jsx'
import { PestanasCliente } from '../components/TablaCliente.jsx'

export default function MisReparaciones() {
  const sesion = leerSesion()
  const [lista, setLista] = useState(null)
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [error, setError] = useState('')
  useEffect(() => { if (sesion?.usuario.rol === 'cliente') api('/mi/reparaciones').then(setLista).catch((e) => setError(e.message)) }, [])
  if (sesion?.usuario.rol !== 'cliente') return <Navigate to="/login?volver=/mis-reparaciones" />

  const todas = lista || []
  const enCurso = todas.filter((r) => r.estado !== 'entregado').length
  const visibles = todas.filter((r) => pasaFiltros(filtros, { textos: [r.codigo, r.equipo, r.falla], estado: r.estado, fecha: r.fecha }))
  const th = 'px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-tinta/70'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Mis reparaciones</h1>
          <p className="mt-1 text-sm text-tinta/70">{lista ? `${todas.length} órdenes de servicio · ${enCurso} en curso · el estado lo actualiza la tienda` : 'Cargando…'}</p>
        </div>
        <PestanasCliente actual="/mis-reparaciones" />
      </div>
      {error && <p className="rounded-lg border border-error/40 p-3 text-sm text-error">{error}</p>}
      <section className="rounded-2xl border border-tinta/10 bg-superficie p-5 shadow-sm">
        <Filtros filtros={filtros} setFiltros={setFiltros} estados={['recibido', 'diagnosticado', 'en_reparacion', 'listo_para_recoger', 'entregado']}
          placeholder="Equipo, falla u orden" />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-tinta/10">
              <tr><th className={th}>Orden</th><th className={th}>Fecha</th><th className={th}>Equipo</th><th className={th}>Falla</th>
                <th className={th}>Precio</th><th className={th}>Estado</th><th className={th + ' text-right'}>Acciones</th></tr>
            </thead>
            <tbody className="divide-y divide-tinta/10">
              {visibles.map((r) => (
                <tr key={r.codigo}>
                  <td className="px-3 py-3 font-mono text-xs">{r.codigo}</td>
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums">{r.fecha}</td>
                  <td className="px-3 py-3 font-medium">{r.equipo}</td>
                  <td className="px-3 py-3">{r.falla}</td>
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums">{r.precio_acordado ? soles(r.costo) : 'Por acordar'}</td>
                  <td className="px-3 py-3"><Estado estado={r.estado} /></td>
                  <td className="px-3 py-3 text-right">
                    {/* El rastreo pide el código; lo llevamos ya escrito */}
                    <Link to={'/rastreo?codigo=' + r.codigo} className="inline-flex items-center gap-1 text-xs font-semibold text-rosa hover:underline"><Icono nombre="ver" tam={14} /> Seguir</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {lista && visibles.length === 0 && (
            <p className="py-6 text-center text-sm text-tinta/70">{todas.length ? 'No hay reparaciones con esos filtros.' : <>No tienes reparaciones registradas. <Link to="/reparaciones" className="text-rosa underline">Ver qué reparamos</Link></>}</p>
          )}
        </div>
      </section>
    </div>
  )
}
