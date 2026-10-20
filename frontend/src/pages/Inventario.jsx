// HU-12: Ángel cambia precio, stock y tráiler de cada producto.
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api, leerSesion } from '../api.js'

export default function Inventario() {
  const sesion = leerSesion()
  const [productos, setProductos] = useState([])
  const [cambios, setCambios] = useState({}) // { id: { precio, stock, trailer_url } } solo de las filas editadas
  const [buscar, setBuscar] = useState('')
  const [aviso, setAviso] = useState('')

  useEffect(() => { api('/productos').then(setProductos).catch((e) => setAviso(e.message)) }, [])

  if (!sesion || sesion.usuario.rol !== 'dueno') return <Navigate to="/login" />

  const editar = (id, campo, valor) => setCambios({ ...cambios, [id]: { ...cambios[id], [campo]: valor } })

  const guardar = async (p) => {
    const c = cambios[p.id]
    const cuerpo = {}
    if (c.precio !== undefined) cuerpo.precio = Number(c.precio)
    if (c.stock !== undefined) cuerpo.stock = Number(c.stock)
    if (c.trailer_url !== undefined) cuerpo.trailer_url = c.trailer_url.trim()
    try {
      const nuevo = await api('/productos/' + p.id, { metodo: 'PATCH', cuerpo })
      setProductos(productos.map((x) => (x.id === p.id ? nuevo : x)))
      const { [p.id]: _, ...resto } = cambios
      setCambios(resto)
      setAviso('Guardado: ' + p.nombre)
    } catch (err) {
      setAviso(err.message)
    }
  }

  const visibles = productos.filter((p) => p.nombre.toLowerCase().includes(buscar.toLowerCase()))
  const celda = 'w-full rounded border border-white/15 bg-fondo px-2 py-1'

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-bold">Inventario</h1>
          <p className="text-sm text-white/60">Cambia el valor y presiona Guardar en esa fila.</p>
        </div>
        <input placeholder="Buscar producto..." value={buscar} onChange={(e) => setBuscar(e.target.value)}
          className="ml-auto rounded-lg border border-white/15 bg-superficie px-3 py-2 text-sm" />
      </div>
      {aviso && <p className="rounded-lg bg-white/10 p-2 text-sm">{aviso}</p>}

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-superficie text-left text-white/60">
            <tr><th className="p-3">Producto</th><th className="p-3 w-28">Precio S/</th><th className="p-3 w-24">Stock</th>
              <th className="p-3">Tráiler (YouTube)</th><th className="p-3 w-24"></th></tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {visibles.map((p) => {
              const c = cambios[p.id] || {}
              return (
                <tr key={p.id} className={p.stock <= 2 && !p.es_preventa ? 'bg-red-500/5' : ''}>
                  <td className="p-3">
                    <p className="font-semibold">{p.nombre}</p>
                    <p className="text-xs text-white/50">{p.categoria}{p.descuento ? ` · oferta -${p.descuento}%` : ''}</p>
                  </td>
                  <td className="p-3"><input type="number" min="0" value={c.precio ?? Number(p.precio)}
                    onChange={(e) => editar(p.id, 'precio', e.target.value)} className={celda} /></td>
                  <td className="p-3"><input type="number" min="0" value={c.stock ?? p.stock}
                    onChange={(e) => editar(p.id, 'stock', e.target.value)} className={celda} /></td>
                  <td className="p-3"><input placeholder="https://www.youtube.com/watch?v=..." value={c.trailer_url ?? (p.trailer_url || '')}
                    onChange={(e) => editar(p.id, 'trailer_url', e.target.value)} className={celda} /></td>
                  <td className="p-3">
                    <button onClick={() => guardar(p)} disabled={!cambios[p.id]}
                      className="rounded-lg bg-rosa px-3 py-1 font-semibold text-white disabled:opacity-30">Guardar</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}