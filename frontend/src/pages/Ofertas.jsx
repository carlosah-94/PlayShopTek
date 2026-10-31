// HU-23: página "Ofertas" con todas las ofertas vigentes y su contador.
// HU-25: como el prototipo: filtros a la izquierda y las ofertas en grilla, con "Ordenar por".
// HU-27: si el cliente respondió la encuesta, primero van las ofertas que calzan con sus gustos ("Para ti primero").
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, leerSesion } from '../api.js'
import FiltrosCatalogo, { pasa } from '../components/FiltrosCatalogo.jsx'
import { ordenarOfertas } from '../components/SeccionOfertas.jsx'
import Icono from '../components/Iconos.jsx'
import TarjetaOferta from '../components/TarjetaOferta.jsx'

const CLAVES = ['categoria', 'disp', 'genero', 'estado', 'plataforma', 'sub', 'origen']
const CONSOLA = { PS5: 'PS5', PS5PRO: 'PS5 Pro', PS4: 'PS4', PS3: 'PS3', PS2: 'PS2' }
const ORDENES = [['para-ti', 'Para ti primero'], ['termina', 'Las que terminan antes'], ['descuento', 'Mayor descuento'], ['precio', 'Precio: menor a mayor']]

export default function Ofertas() {
  const [parametros, setParametros] = useSearchParams()
  const v = Object.fromEntries(CLAVES.map((k) => [k, parametros.get(k) || '']))
  const [ofertas, setOfertas] = useState(null) // null = todavía cargando
  const [generos, setGeneros] = useState({})
  const [error, setError] = useState('')
  const [encuesta, setEncuesta] = useState(null) // HU-27: los gustos del cliente
  const [afinidad, setAfinidad] = useState({}) // { id del producto: puntos }
  const esCliente = leerSesion()?.usuario.rol === 'cliente'
  useEffect(() => {
    api('/productos').then((ps) => setOfertas(ordenarOfertas(ps))).catch((e) => setError(e.message))
    api('/generos').then((gs) => setGeneros(Object.fromEntries(gs.map((g) => [g.id, g.nombre])))).catch(() => {})
    if (esCliente) {
      api('/mi/encuesta').then(setEncuesta).catch(() => {})
      api('/mi/afinidad').then((as) => setAfinidad(Object.fromEntries(as.map((a) => [a.producto_id, a.puntos])))).catch(() => {})
    }
  }, [])
  const conGustos = !!encuesta?.perfil
  const orden = parametros.get('orden') || (conGustos ? 'para-ti' : 'termina')
  const ordenes = conGustos ? ORDENES : ORDENES.slice(1)
  // "Primero lo que calza con tu encuesta (PS5, deportes, acción)."
  const gustos = conGustos ? [CONSOLA[encuesta.consola], ...encuesta.generos.slice(0, 2).map((g) => (generos[g] || g).toLowerCase())].filter(Boolean) : []
  const quitar = (p) => setOfertas((os) => os.filter((o) => o.id !== p.id)) // cuando su contador llega a cero

  const poner = (cambios) => {
    const nuevo = new URLSearchParams(parametros)
    Object.entries(cambios).forEach(([k, valor]) => (valor ? nuevo.set(k, valor) : nuevo.delete(k)))
    setParametros(nuevo, { replace: true })
  }
  const visibles = (ofertas || []).filter((p) => pasa(p, v)).sort((a, b) =>
    orden === 'descuento' ? b.descuento - a.descuento : orden === 'precio' ? a.precio_final - b.precio_final
      : (orden === 'para-ti' ? (afinidad[b.id] || 0) - (afinidad[a.id] || 0) : 0) || new Date(a.oferta_termina) - new Date(b.oferta_termina))

  return (
    <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
      <FiltrosCatalogo productos={ofertas || []} v={v} poner={poner} limpiar={() => setParametros({}, { replace: true })} generos={generos} />
      <section className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rosa">⚡ Por tiempo limitado</p>
            <h1 className="text-3xl font-semibold">Ofertas</h1>
            <p className="mt-1 text-sm text-tinta/60">{ofertas ? `${visibles.length} productos con descuento por tiempo limitado` : 'Cargando ofertas… La primera visita del día puede tardar hasta 1 minuto.'}</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-tinta/70">Ordenar por
            <select id="ofertas-orden" value={orden} onChange={(e) => poner({ orden: e.target.value === ordenes[0][0] ? '' : e.target.value })}
              className="rounded-lg border border-tinta/15 bg-superficie px-3 py-2 text-sm text-tinta">
              {ordenes.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
          </label>
        </div>
        {orden === 'para-ti' && conGustos && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-morado/35 bg-morado/10 px-3.5 py-2.5 text-sm">
            <span className="text-morado"><Icono nombre="destello" tam={18} /></span>
            <span className="min-w-[220px] flex-1">Primero lo que calza con tu encuesta ({gustos.join(', ') || 'sin preferencias'}).</span>
            <Link to="/encuesta" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-rosa hover:bg-rosa/10"><Icono nombre="ajustes" tam={15} /> Ajustar mis gustos</Link>
          </div>
        )}
        {error && <p className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}
        {ofertas?.length === 0 && <p className="text-tinta/60">Por ahora no hay ofertas. ¡Vuelve pronto!</p>}
        {ofertas?.length > 0 && visibles.length === 0 && <p className="text-tinta/60">No hay ofertas con esos filtros.</p>}
        <h2 className="sr-only">Productos en oferta</h2>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {visibles.map((p) => <li key={p.id}><TarjetaOferta p={p} onTermina={quitar} vertical /></li>)}
        </ul>
      </section>
    </div>
  )
}
