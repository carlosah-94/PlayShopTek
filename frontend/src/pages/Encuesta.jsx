// HU-27: encuesta de gustos, como el prototipo. Sale la primera vez, apenas el cliente crea su cuenta
// (y cuando él quiere, con "Ajustar mis gustos"). 3 pasos: géneros, si juega en línea y qué consola tiene.
// Con las respuestas, el recomendador del servidor arma "Recomendado para ti" (backend/app/ia/recomendador.py).
import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { api, leerSesion } from '../api.js'
import Icono from '../components/Iconos.jsx'

const ICONO_GENERO = { accion: 'espada', aventura: 'brujula', deportes: 'pelota', carreras: 'auto', shooter: 'mira', pelea: 'guante',
  rol: 'varita', terror: 'fantasma', estrategia: 'estrategia', familiar: 'familia' }
const MODOS = [['online', 'Sí, en línea', 'Juego con amigos por internet', 'grupo'], ['local', 'Solo en casa', 'Dos mandos en la misma pantalla', 'sofa'],
  ['solo', 'Prefiero un jugador', 'Historias y campañas', 'persona']]
const CONSOLAS = [['PS5', 'PlayStation 5'], ['PS5PRO', 'PS5 Pro'], ['PS4', 'PlayStation 4'], ['PS3', 'PlayStation 3'], ['PS2', 'PlayStation 2'], ['NO', 'Todavía no tengo']]
const PREGUNTAS = [
  ['¿Qué géneros prefieres?', 'Elige todos los que quieras. Con esto armamos tu vitrina.'],
  ['¿Juegas en línea con otros?', 'Así sabemos si te conviene PS Plus y juegos multijugador.'],
  ['¿Qué consola tienes hoy?', 'Te mostramos juegos y mandos compatibles.'],
]

// Botón que se marca al elegirlo (rosa como en el prototipo)
const opcion = (elegido) => 'rounded-xl border transition ' +
  (elegido ? 'border-rosa bg-rosa/15 shadow-[0_0_0_3px_rgba(222,28,187,.12)]' : 'border-tinta/20 bg-tinta/[0.03] hover:border-tinta/40')

export default function Encuesta() {
  const sesion = leerSesion()
  const navegar = useNavigate()
  const [paso, setPaso] = useState(1)
  const [generos, setGeneros] = useState([]) // los que existen en la tienda: [{ id, nombre }]
  const [r, setR] = useState({ generos: [], modo: null, consola: null }) // respuestas
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/generos').then((gs) => setGeneros(gs.filter((g) => g.juegos > 0))).catch(() => {}) // solo los que tienen juegos
    // "Ajustar mis gustos": se abre con lo que respondió antes
    api('/mi/encuesta').then((e) => e.hecha && setR({ generos: e.generos, modo: e.modo, consola: e.consola })).catch(() => {})
  }, [])

  if (sesion?.usuario.rol !== 'cliente') return <Navigate to="/login" replace />

  const guardar = async (respuestas, aviso) => {
    setGuardando(true)
    try {
      await api('/mi/encuesta', { metodo: 'PUT', cuerpo: respuestas })
      navegar('/', { state: { aviso } })
    } catch (e) {
      setError(e.message)
      setGuardando(false)
    }
  }
  const siguiente = () => (paso < 3 ? setPaso(paso + 1) : guardar(r, 'Listo, tu vitrina está personalizada.'))
  const marcarGenero = (id) => setR({ ...r, generos: r.generos.includes(id) ? r.generos.filter((g) => g !== id) : [...r.generos, id] })
  const consola = CONSOLAS.find(([id]) => id === r.consola)
  const [titulo, detalle] = PREGUNTAS[paso - 1]

  return (
    <main className="grid min-h-screen place-items-center p-5 sm:p-12">
      <section className="w-full max-w-[720px] space-y-5 rounded-3xl border border-tinta/10 bg-superficie p-6 shadow-2xl sm:p-8">
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="" className="h-11 w-11 rounded-[10px] object-cover" />
          <div className="flex-1">
            <p className="text-[11px] uppercase tracking-[.14em] text-morado">Paso {paso} de 3</p>
            <h1 className="text-xl font-semibold">Hola {sesion.usuario.nombre.split(' ')[0]}, cuéntanos cómo juegas</h1>
          </div>
          <button type="button" onClick={() => guardar({}, '')} disabled={guardando} className="rounded-lg px-3 py-2 text-sm text-tinta/70 hover:bg-tinta/5">Saltar</button>
        </div>
        <div className="h-[5px] overflow-hidden rounded bg-tinta/10" role="progressbar" aria-label="Avance de la encuesta" aria-valuemin={1} aria-valuemax={3} aria-valuenow={paso}>
          <div className="h-full bg-gradient-to-r from-[#5546E4] to-[#DE1CBB] shadow-[0_0_14px_rgba(222,28,187,.6)] transition-all duration-300" style={{ width: Math.round((paso / 3) * 100) + '%' }} />
        </div>

        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">{titulo}</h2>
            <p className="text-sm text-tinta/75">{detalle}</p>
          </div>

          {paso === 1 && (
            <div className="flex flex-wrap gap-2">
              {generos.map((g) => (
                <button key={g.id} type="button" onClick={() => marcarGenero(g.id)} aria-pressed={r.generos.includes(g.id)}
                  className={opcion(r.generos.includes(g.id)) + ' inline-flex items-center gap-2 px-3.5 py-2 text-sm'}>
                  <Icono nombre={ICONO_GENERO[g.id] || 'mando'} tam={16} /> {g.nombre}
                </button>
              ))}
            </div>
          )}

          {paso === 2 && (
            <div className="grid gap-2.5 sm:grid-cols-3">
              {MODOS.map(([id, nombre, texto, icono]) => (
                <button key={id} type="button" onClick={() => setR({ ...r, modo: id })} aria-pressed={r.modo === id}
                  className={opcion(r.modo === id) + ' flex flex-col items-start gap-1 p-3.5 text-left'}>
                  <span className="text-rosa"><Icono nombre={icono} tam={22} /></span>
                  <span className="text-[15px] font-medium">{nombre}</span>
                  <span className="text-xs text-tinta/75">{texto}</span>
                </button>
              ))}
            </div>
          )}

          {paso === 3 && (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {CONSOLAS.map(([id, nombre]) => (
                <button key={id} type="button" onClick={() => setR({ ...r, consola: id })} aria-pressed={r.consola === id}
                  className={opcion(r.consola === id) + ' flex flex-col items-center gap-1.5 px-3 py-4 text-[15px]'}>
                  <span className="text-morado"><Icono nombre="mando" tam={26} /></span>{nombre}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-error">{error}</p>}
        <div className="flex items-center justify-between gap-3 border-t border-tinta/10 pt-4">
          <button type="button" onClick={() => setPaso(paso - 1)} disabled={paso === 1}
            className="inline-flex items-center gap-2 rounded-lg border border-tinta/20 px-4 py-2.5 text-sm font-semibold hover:bg-tinta/5 disabled:opacity-40">
            <Icono nombre="atras" tam={16} /> Atrás
          </button>
          <p className="hidden text-xs text-tinta/70 sm:block">{r.generos.length} géneros · {consola ? consola[1] : 'sin consola'}</p>
          <button type="button" onClick={siguiente} disabled={guardando}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-rosa to-[#8b2fd9] px-5 py-2.5 text-sm font-semibold text-white shadow-md disabled:opacity-60">
            {paso === 3 ? 'Ver mis recomendaciones' : 'Siguiente'} <Icono nombre="adelante" tam={16} />
          </button>
        </div>
      </section>
    </main>
  )
}
