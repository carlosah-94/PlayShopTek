// HU-09: asistente del chat. El backend clasifica el mensaje con IA (modelo entrenado, ver backend/app/ia/asistente.py)
// y devuelve la respuesta, los productos encontrados y botones de acción.
// HU-10: el chat también agrega productos al carrito y lleva al cliente a una sección.
// Mejora (como el prototipo): botón con robot, saludo según la encuesta de gustos (HU-27), tarjetas con foto,
// estado, precio y stock, "Agregar al carrito", "Favorito" y "Ver detalle", servicios del taller,
// asesores por WhatsApp y sugerencias rápidas.
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, leerSesion, urlImagen } from '../api.js'
import { agregarAlCarrito } from '../carrito.js'
import { useFavoritos } from '../favoritos.js'
import { enlaceWa } from './Asesores.jsx'
import Icono from './Iconos.jsx'

// Un id al azar por navegador para agrupar los mensajes de una misma conversación
function idDeSesion() {
  let id = sessionStorage.getItem('psk-chat')
  if (!id) { id = 'chat-' + Math.random().toString(36).slice(2, 12); sessionStorage.setItem('psk-chat', id) }
  return id
}

const SUGERENCIAS = ['¿Tienen GTA V?', 'Agrega FIFA 26 al carrito', '¿Qué reparaciones hacen?', 'Recomiéndame un juego', 'Llévame a ofertas']
const ICONO_SERVICIO = { 'ph ph-game-controller': 'mando', 'ph ph-wrench': 'llave', 'ph ph-disc': 'disco', 'ph ph-plug': 'enchufe', 'ph ph-cpu': 'pc', 'ph ph-desktop-tower': 'pc' }
const soles = (n) => 'S/ ' + Number(n).toLocaleString('es-PE')
const estadoDe = (p) => (p.es_preventa ? 'Preventa' : { nuevo: 'Nuevo', usado: 'Usado', reacondicionado: 'Reacondicionado' }[p.grupo_condicion])

function saludo(sesion, encuesta) {
  const nombre = sesion?.usuario.nombre.split(' ')[0]
  const puedo = 'Pregúntame por un juego, consola o mando: puedo agregarlo a tu carrito, guardarlo en favoritos o llevarte a cualquier sección.'
  if (!nombre || sesion.usuario.rol !== 'cliente') return 'Hola, soy el asistente de Play Shop Tek. ' + puedo
  if (encuesta?.perfil) return `Hola ${nombre}. Vi que ${encuesta.perfil.charAt(0).toLowerCase() + encuesta.perfil.slice(1)}. ${puedo} También te recomiendo según tus gustos.`
  return `Hola ${nombre}. ${puedo}`
}

// Tarjeta de un producto dentro del chat (como el prototipo)
function TarjetaChat({ p, ancho, favorito, onFavorito, alVer, esCliente }) {
  const [agregado, setAgregado] = useState(false)
  const [aviso, setAviso] = useState(false)
  const navegar = useNavigate()
  const agotado = p.stock <= 0 && !p.es_preventa
  const estado = estadoDe(p)
  const stock = p.stock > 0 ? (p.stock <= 2 ? `¡Últimas ${p.stock} unidades!` : `${p.stock} en stock`) : p.es_preventa ? 'Preventa · reserva con S/ 50' : 'Sin stock'
  const colorStock = p.stock > 0 ? (p.stock <= 2 ? 'text-rosa' : 'text-ok') : p.es_preventa ? 'text-morado' : 'text-error'
  const anadir = () => { agregarAlCarrito(p); setAgregado(true); setTimeout(() => setAgregado(false), 1500) }
  const avisar = async () => {
    if (!esCliente) return navegar('/login?volver=/producto/' + p.id)
    await api('/mi/avisos/' + p.id, { metodo: 'POST' }).catch(() => {})
    setAviso(true)
  }
  const boton = 'flex min-h-[34px] w-full items-center justify-center gap-1.5 rounded-lg px-2.5 py-1 text-[12.5px] font-semibold'
  const secundario = 'flex min-h-[32px] items-center justify-center gap-1.5 rounded-lg border border-tinta/15 px-2 py-1 text-xs font-semibold hover:bg-tinta/5'

  return (
    <div className={'flex shrink-0 snap-start flex-col gap-2.5 rounded-xl border border-tinta/10 bg-superficie p-2.5 ' + ancho}>
      <div className="flex items-start gap-2.5">
        <div className="relative grid aspect-[3/4] w-[62px] shrink-0 place-items-center overflow-hidden rounded-lg border border-tinta/10 bg-white">
          {p.foto ? <img src={urlImagen(p.foto)} alt="" loading="lazy" className="h-full w-full object-contain" />
            : <span className="text-rosa/60"><Icono nombre="mando" tam={24} /></span>}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="line-clamp-2 text-[13.5px] font-medium leading-tight">{p.nombre}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {p.plataforma && <span className="rounded-md bg-tinta/[0.07] px-1.5 py-px text-[10.5px]">{p.plataforma}</span>}
            {estado && <span className={'rounded-md px-1.5 py-px text-[10.5px] ' + (estado === 'Nuevo' ? 'border border-morado/40 text-morado' : estado === 'Preventa' ? 'border border-tinta/25' : 'bg-tinta/[0.07]')}>{estado}</span>}
          </div>
          <div className="flex flex-wrap items-baseline gap-1.5">
            <span className="text-base font-semibold">{soles(p.precio_final)}</span>
            {p.descuento && <><s className="text-[11.5px] text-tinta/70">{soles(p.precio)}</s><span className="rounded bg-[#DE1CBB] px-1 text-[11px] text-white">-{p.descuento}%</span></>}
          </div>
          <p className={'flex items-center gap-1.5 text-[11.5px] ' + colorStock}><span className="h-[7px] w-[7px] rounded-full bg-current" />{stock}</p>
        </div>
      </div>
      {agotado
        ? <button type="button" onClick={avisar} disabled={aviso} className={boton + ' bg-gradient-to-r from-rosa to-[#8b2fd9] text-white disabled:opacity-70'}>
            <Icono nombre={aviso ? 'check' : 'campanaAviso'} tam={15} /> {aviso ? 'Te avisaremos cuando llegue' : 'Avísame cuando llegue'}
          </button>
        : p.es_preventa
          ? <Link to={'/producto/' + p.id} onClick={alVer} className={boton + ' bg-gradient-to-r from-rosa to-[#8b2fd9] text-white'}><Icono nombre="carrito" tam={15} /> Reservar con S/ 50</Link>
          : <button type="button" onClick={anadir} className={boton + ' bg-gradient-to-r from-rosa to-[#8b2fd9] text-white'}>
              <Icono nombre={agregado ? 'check' : 'carrito'} tam={15} /> {agregado ? 'Agregado' : 'Agregar al carrito'}
            </button>}
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" onClick={() => onFavorito(p)} aria-pressed={favorito} className={secundario}>
          <span className="text-rosa"><Icono nombre={favorito ? 'corazonLleno' : 'corazon'} tam={14} /></span>{favorito ? 'En favoritos' : 'Favorito'}
        </button>
        <Link to={'/producto/' + p.id} onClick={alVer} className={secundario}><Icono nombre="abrir" tam={14} /> Ver detalle</Link>
      </div>
    </div>
  )
}

export default function Asistente() {
  const sesion = leerSesion()
  const esCliente = sesion?.usuario.rol === 'cliente'
  const [abierto, setAbierto] = useState(false)
  const [encuesta, setEncuesta] = useState(null)
  const [mensajes, setMensajes] = useState([])
  const [texto, setTexto] = useState('')
  const [pensando, setPensando] = useState(false)
  const [favoritos, alternarFavorito] = useFavoritos()
  const final = useRef(null)
  const ultimoProducto = useRef(null) // el último producto que mostró el chat, para entender "agrégalo"
  const navegar = useNavigate()

  // HU-27: el saludo usa lo que el cliente respondió en la encuesta
  useEffect(() => {
    if (abierto && esCliente && !encuesta) api('/mi/encuesta').then(setEncuesta).catch(() => {})
  }, [abierto, esCliente])
  // Cada vez que llega un mensaje, baja hasta el último
  useEffect(() => { final.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [mensajes, abierto, pensando])
  // Esc cierra el chat
  useEffect(() => {
    if (!abierto) return
    const tecla = (e) => e.key === 'Escape' && setAbierto(false)
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [abierto])

  async function enviar(mensaje) {
    mensaje = mensaje.trim()
    if (!mensaje || pensando) return
    setMensajes((m) => [...m, { autor: 'cliente', texto: mensaje }])
    setTexto('')
    setPensando(true)
    try {
      const r = await api('/asistente', {
        metodo: 'POST', cuerpo: { mensaje, sesion: idDeSesion(), ultimo_producto_id: ultimoProducto.current },
      })
      if (r.productos.length > 0) ultimoProducto.current = r.productos[0].id
      // HU-10: si el asistente decidió agregar un producto, se pone en el carrito del navegador
      const agregar = r.acciones.find((a) => a.tipo === 'agregar')
      if (agregar) agregarAlCarrito(r.productos.find((p) => p.id === agregar.producto_id))
      setMensajes((m) => [...m, { autor: 'bot', texto: r.respuesta, productos: r.productos, acciones: r.acciones, servicios: r.servicios, pregunta: mensaje }])
      // HU-10: si pidió ir a una sección concreta, lo lleva solo
      if (r.intencion === 'navegar' && r.acciones.length === 1) navegar(r.acciones[0].destino)
    } catch {
      setMensajes((m) => [...m, { autor: 'bot', texto: 'Ups, no pude responder. Intenta de nuevo en un momento.' }])
    } finally {
      setPensando(false)
    }
  }
  const cerrar = () => setAbierto(false)
  const todos = [{ autor: 'bot', texto: saludo(sesion, encuesta) }, ...mensajes]

  return (
    <>
      <button type="button" onClick={() => setAbierto(!abierto)} aria-expanded={abierto} aria-label={abierto ? 'Cerrar asistente' : 'Abrir asistente Play Shop Tek'}
        className="fixed bottom-[88px] right-5 z-[56] grid h-14 w-14 place-items-center rounded-full border border-rosa/60 bg-gradient-to-br from-[#DE1CBB] to-[#5546E4] text-white shadow-[0_0_26px_rgba(222,28,187,.55)]">
        <Icono nombre="robot" tam={27} />
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-[55]" onClick={cerrar} aria-hidden="true" />
          <section aria-label="Asistente Play Shop Tek"
            className="fixed bottom-[154px] right-5 z-[60] flex max-h-[calc(100vh-180px)] w-[min(370px,calc(100vw-40px))] flex-col overflow-hidden rounded-[18px] border border-rosa/35 bg-superficie shadow-[0_20px_50px_rgba(26,16,64,.22)]">
            <div className="flex items-center gap-2.5 border-b border-tinta/10 px-4 py-3">
              <span className="grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-gradient-to-br from-[#DE1CBB] to-[#5546E4] text-white"><Icono nombre="robot" tam={19} /></span>
              <div className="flex-1">
                <h2 className="text-[14.5px] font-semibold">Asistente Play Shop Tek</h2>
                <p className="text-[11px] text-tinta/70">Conoce tus gustos y el stock de la tienda</p>
              </div>
              <button type="button" onClick={cerrar} aria-label="Cerrar asistente" className="grid h-9 w-9 place-items-center rounded-lg border border-tinta/15 hover:bg-tinta/5"><Icono nombre="cerrar" tam={16} /></button>
            </div>

            <div className="flex min-h-[140px] flex-1 basis-[400px] flex-col gap-3 overflow-y-auto p-3.5" aria-live="polite">
              {todos.map((m, i) => (
                <div key={i} className={'flex w-full flex-col gap-2 ' + (m.autor === 'cliente' ? 'items-end' : 'items-start')}>
                  <p className={'max-w-[86%] rounded-[13px] border px-3 py-2.5 text-[13.5px] leading-relaxed ' +
                    (m.autor === 'cliente' ? 'border-rosa/40 bg-rosa/[0.14]' : 'border-morado/35 bg-morado/[0.12]')}>{m.texto}</p>

                  {m.productos?.length > 0 && (
                    <div className="flex w-full snap-x snap-mandatory gap-2 overflow-x-auto pb-1">
                      {m.productos.map((p) => (
                        <TarjetaChat key={p.id} p={p} ancho={m.productos.length > 1 ? 'w-[262px]' : 'w-full'} esCliente={esCliente}
                          favorito={favoritos.has(p.id)} onFavorito={alternarFavorito} alVer={cerrar} />
                      ))}
                    </div>
                  )}

                  {m.servicios?.length > 0 && (
                    <ul className="flex w-full flex-col gap-1.5">
                      {m.servicios.map((v) => (
                        <li key={v.nombre} className="flex items-center gap-2.5 rounded-[10px] border border-tinta/10 bg-superficie px-2.5 py-2">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-morado/10 text-morado"><Icono nombre={ICONO_SERVICIO[v.icono] || 'llave'} tam={17} /></span>
                          <span className="min-w-0 flex-1"><span className="block text-[13px] font-medium">{v.nombre}</span>
                            <span className="text-[11.5px] text-tinta/75">Diagnóstico gratis{v.tiempo ? ' · ' + v.tiempo : ''}</span></span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {m.acciones?.some((a) => a.tipo === 'whatsapp') && (
                    <div className="flex w-full flex-col gap-1.5">
                      {m.acciones.filter((a) => a.tipo === 'whatsapp').map((a, n) => (
                        <a key={a.destino} href={enlaceWa(a.destino, 'Hola, les escribo desde el asistente de la web: ' + (m.pregunta || '').slice(0, 120))} target="_blank" rel="noreferrer"
                          className="flex items-center gap-2.5 rounded-[10px] border border-[#25D366]/45 bg-[#25D366]/[0.08] px-2.5 py-2 hover:bg-[#25D366]/15">
                          <span className="relative grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#5546E4] to-[#DE1CBB] text-xs font-semibold text-white">
                            {n + 1}<span className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full border-2 border-superficie bg-[#25D366]" />
                          </span>
                          <span className="min-w-0 flex-1 text-[13px] font-medium">{a.etiqueta}</span>
                          <span className="flex items-center gap-1 text-[11px] text-ok"><span className="h-[7px] w-[7px] rounded-full bg-[#25D366]" />Disponible</span>
                          <span className="text-[#1f9d55]"><Icono nombre="whatsapp" tam={19} /></span>
                        </a>
                      ))}
                    </div>
                  )}

                  {m.acciones?.some((a) => a.tipo !== 'whatsapp') && (
                    <div className="flex flex-wrap gap-1.5">
                      {m.acciones.filter((a) => a.tipo !== 'whatsapp').map((a) => (
                        <Link key={a.etiqueta} to={a.destino} onClick={cerrar}
                          className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-gradient-to-r from-rosa to-[#8b2fd9] px-3 py-1 text-[12.5px] font-semibold text-white">
                          {a.etiqueta} <Icono nombre="flechaDer" tam={12} />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {pensando && <p className="text-[12.5px] text-tinta/70">• • • escribiendo…</p>}
              <div ref={final} />
            </div>

            <div className="flex flex-wrap gap-1.5 px-3.5">
              {SUGERENCIAS.map((s) => (
                <button key={s} type="button" onClick={() => enviar(s)} disabled={pensando}
                  className="rounded-full bg-tinta/[0.07] px-2.5 py-1 text-[11.5px] hover:bg-tinta/[0.12]">{s}</button>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); enviar(texto) }} className="flex gap-2 px-3.5 pb-1.5 pt-3">
              <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={300} aria-label="Escribe tu pregunta"
                placeholder="¿Tienen FIFA 26?" className="min-w-0 flex-1 rounded-lg border border-tinta/15 bg-fondo px-3 py-2 text-sm" />
              <button disabled={pensando} aria-label="Enviar" className="grid min-w-[44px] place-items-center rounded-lg bg-gradient-to-r from-rosa to-[#8b2fd9] text-white disabled:opacity-50">
                <Icono nombre="enviar" tam={18} />
              </button>
            </form>
            <p className="flex items-center gap-1.5 px-3.5 pb-2.5 text-[10.5px] leading-snug text-tinta/70">
              <Icono nombre="destello" tam={12} /> Asistente con IA · entiende tu mensaje con un modelo entrenado con preguntas de clientes
            </p>
          </section>
        </>
      )}
    </>
  )
}
