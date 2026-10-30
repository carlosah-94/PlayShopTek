// HU-24: "Banners de inicio". Ángel cambia las fotos del carrusel del inicio y de los dos cuadros de al lado,
// sin tocar el código. Cada diapositiva tiene foto para computadora, foto opcional para celular, textos y destino.
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api, leerSesion } from '../api.js'
import Icono from '../components/Iconos.jsx'
import { Caja, Encabezado, botonBorde, botonRosa, campo } from '../components/PiezasPanel.jsx'
import SubirFoto from '../components/SubirFoto.jsx'

// A dónde lleva la diapositiva al hacer clic (lo mismo que el prototipo)
export const DESTINOS = [['', 'Sin destino (no hace nada)'], ['ofertas', 'Ofertas'], ['reparaciones', 'Reparaciones'],
  ['catalogo', 'Catálogo completo'], ['tienda', 'Rastrea tu reparación'], ['PS5', 'Juegos PS5'], ['PS4', 'Juegos PS4'],
  ['PS3', 'Juegos PS3'], ['PS2', 'Juegos PS2'], ['Máquinas', 'Máquinas'], ['Mandos', 'Mandos'], ['PC y periféricos', 'PC y periféricos']]

function Diapositiva({ b, pos, total, onGuardar, onMover, onQuitar }) {
  const [d, setD] = useState(b)
  const [guardado, setGuardado] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  useEffect(() => setD(b), [b])
  const cambio = JSON.stringify(d) !== JSON.stringify(b)
  const poner = (k, v) => setD({ ...d, [k]: v })
  const guardar = async (datos = d) => {
    await onGuardar(datos)
    setGuardado(true)
    setTimeout(() => setGuardado(false), 1500)
  }
  const id = 'b' + b.id

  return (
    <Caja>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="font-titulo text-xl text-tinta/60">{pos}</span>
        <div className="flex overflow-hidden rounded-lg border border-tinta/15" role="group" aria-label="Tipo de diapositiva">
          {[[false, 'Solo imagen', 'imagen'], [true, 'Imagen con texto', 'lista']].map(([v, t, ic]) => (
            <button key={t} type="button" onClick={() => poner('con_texto', v)} aria-pressed={d.con_texto === v}
              className={'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm ' + (d.con_texto === v ? 'bg-rosa/15 font-semibold text-rosa' : 'hover:bg-tinta/5')}>
              <Icono nombre={ic} tam={14} /> {t}
            </button>
          ))}
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-rosa/40 px-3 py-1 text-sm">
          <input id={id + '-activo'} type="checkbox" checked={d.activo} onChange={(e) => guardar({ ...d, activo: e.target.checked })} className="accent-[#cc19ab]" />
          {d.activo ? 'Activa' : 'Apagada'}
        </label>
        <div className="ml-auto flex gap-1">
          <button type="button" disabled={pos === 1} onClick={() => onMover(-1)} aria-label="Subir diapositiva" className="grid h-8 w-8 place-items-center rounded-lg border border-tinta/15 disabled:opacity-30"><Icono nombre="arriba" tam={15} /></button>
          <button type="button" disabled={pos === total} onClick={() => onMover(1)} aria-label="Bajar diapositiva" className="grid h-8 w-8 place-items-center rounded-lg border border-tinta/15 disabled:opacity-30"><Icono nombre="abajo" tam={15} /></button>
          {confirmar
            ? <button type="button" onClick={onQuitar} className="rounded-lg bg-error px-2 text-xs font-semibold text-white">Sí, borrar</button>
            : <button type="button" onClick={() => setConfirmar(true)} aria-label="Borrar diapositiva" className="grid h-8 w-8 place-items-center rounded-lg border border-tinta/15 hover:text-error"><Icono nombre="basura" tam={15} /></button>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
        <div><p className="mb-1 text-xs text-tinta/60">Computadora · 1920 × 600 px</p>
          <SubirFoto id={id + '-pc'} url={d.imagen_url} onCambio={(u) => poner('imagen_url', u)} etiqueta="Foto para computadora" proporcion="aspect-[16/5]" maxAncho={1600} /></div>
        <div><p className="mb-1 text-xs text-tinta/60">Celular · opcional</p>
          <SubirFoto id={id + '-movil'} url={d.imagen_movil_url} onCambio={(u) => poner('imagen_movil_url', u)} etiqueta="1:1" proporcion="aspect-square" maxAncho={1080} /></div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {d.con_texto && (
          <>
            <label className="block"><span className="mb-1 block text-xs text-tinta/60">Título</span>
              <input id={id + '-titulo'} value={d.titulo} onChange={(e) => poner('titulo', e.target.value)} className={campo} /></label>
            <label className="block"><span className="mb-1 block text-xs text-tinta/60">Texto debajo del título</span>
              <input id={id + '-sub'} value={d.subtitulo || ''} onChange={(e) => poner('subtitulo', e.target.value)} className={campo} /></label>
          </>
        )}
        <label className="block"><span className="mb-1 block text-xs text-tinta/60">Texto alternativo (qué se ve en la foto)</span>
          <input id={id + '-alt'} value={d.texto_alternativo || ''} onChange={(e) => poner('texto_alternativo', e.target.value)} className={campo} /></label>
        <label className="block"><span className="mb-1 block text-xs text-tinta/60">Al hacer clic lleva a</span>
          <select id={id + '-destino'} value={d.destino || ''} onChange={(e) => poner('destino', e.target.value)} className={campo}>
            {DESTINOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select></label>
      </div>
      {(cambio || guardado) && (
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => guardar()} disabled={!cambio} className={botonRosa}>{guardado ? '¡Guardado!' : 'Guardar cambios'}</button>
          {cambio && <button type="button" onClick={() => setD(b)} className={botonBorde}>Deshacer</button>}
        </div>
      )}
    </Caja>
  )
}

export default function Banners() {
  const sesion = leerSesion()
  const [lista, setLista] = useState([])
  const [error, setError] = useState('')
  const cargar = () => api('/banners/todos').then(setLista).catch((e) => setError(e.message))
  useEffect(() => { cargar() }, [])
  if (!sesion || sesion.usuario.rol !== 'dueno') return <Navigate to="/login" />

  const carrusel = lista.filter((b) => b.ubicacion === 'carrusel').sort((a, b) => a.orden - b.orden)
  const cuadros = lista.filter((b) => b.ubicacion !== 'carrusel').sort((a, b) => a.orden - b.orden)

  const guardar = async (b) => {
    setError('')
    try {
      const nuevo = await api('/banners/' + b.id, { metodo: 'PUT', cuerpo: b })
      setLista((l) => l.map((x) => (x.id === b.id ? nuevo : x)))
    } catch (err) {
      setError(err.message)
      throw err
    }
  }
  // Cambia el orden con la vecina de arriba o de abajo
  const mover = async (i, lado) => {
    const a = carrusel[i], b = carrusel[i + lado]
    await guardar({ ...a, orden: b.orden })
    await guardar({ ...b, orden: a.orden })
  }
  const agregar = async () => {
    try {
      await api('/banners', { metodo: 'POST', cuerpo: { titulo: 'Nueva diapositiva', activo: false } })
      cargar()
    } catch (err) {
      setError(err.message)
    }
  }
  const quitar = async (b) => {
    try {
      await api('/banners/' + b.id, { metodo: 'DELETE' })
      setLista(lista.filter((x) => x.id !== b.id))
    } catch (err) {
      setError(err.message)
    }
  }

  const activas = carrusel.filter((b) => b.activo).length
  return (
    <div className="space-y-5">
      <Encabezado titulo="Banners de inicio"
        detalle="El carrusel y los dos cuadros de la portada. Arrastra una foto a cada recuadro: para computadora, horizontal 1920 × 600 px; para celular, opcional y cuadrada (1080 × 1080 px). Si no subes la de celular, se usa la de computadora.">
        <button type="button" onClick={agregar} className={botonRosa}><Icono nombre="mas" tam={16} /> Agregar diapositiva</button>
      </Encabezado>
      <p className="-mt-3 text-sm text-tinta/60">{carrusel.length} diapositivas · {activas} activas · avanzan solas cada 5 segundos y se pausan al pasar el mouse</p>
      {error && <p className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}

      {carrusel.map((b, i) => (
        <Diapositiva key={b.id} b={b} pos={i + 1} total={carrusel.length} onGuardar={guardar} onMover={(lado) => mover(i, lado)} onQuitar={() => quitar(b)} />
      ))}
      {carrusel.length === 0 && <Caja><p className="text-sm text-tinta/60">No hay diapositivas. Agrega una para que el carrusel tenga contenido.</p></Caja>}

      <Caja titulo="Cuadros junto al carrusel">
        <p className="-mt-2 mb-4 text-sm text-tinta/60">Imagen de fondo de los dos cuadros a la derecha del carrusel (por ejemplo 600 × 520 px). Encima va una capa oscura degradada para que el texto siempre se lea.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {cuadros.map((b) => (
            <div key={b.id} className="space-y-2">
              <p className="font-medium">{b.titulo}</p>
              <SubirFoto id={'cuadro-' + b.id} url={b.imagen_url} onCambio={(u) => guardar({ ...b, imagen_url: u })} etiqueta={'Fondo de "' + b.titulo + '"'} proporcion="aspect-[6/5]" maxAncho={800} />
            </div>
          ))}
        </div>
      </Caja>
    </div>
  )
}
