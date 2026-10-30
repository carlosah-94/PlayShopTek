// HU-09: burbuja de chat en la esquina. El backend clasifica el mensaje con IA y devuelve
// la respuesta, los productos encontrados (con imagen y precio) y botones de acción.
// HU-10: el chat también agrega productos al carrito y lleva al cliente a una sección.
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { agregarAlCarrito } from '../carrito.js'

// Un id al azar por navegador para agrupar los mensajes de una misma conversación
function idDeSesion() {
  let id = sessionStorage.getItem('psk-chat')
  if (!id) { id = 'chat-' + Math.random().toString(36).slice(2, 12); sessionStorage.setItem('psk-chat', id) }
  return id
}

const BIENVENIDA = { autor: 'bot', texto: '¡Hola! Pregúntame por un juego, el taller o el horario. También puedo agregarlo a tu carrito.' }

export default function Asistente() {
  const [abierto, setAbierto] = useState(false)
  const [mensajes, setMensajes] = useState([BIENVENIDA])
  const [texto, setTexto] = useState('')
  const [pensando, setPensando] = useState(false)
  const final = useRef(null)
  const ultimoProducto = useRef(null) // el último producto que mostró el chat, para entender "agrégalo"
  const navegar = useNavigate()

  // Cada vez que llega un mensaje, baja hasta el último
  useEffect(() => { final.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensajes, abierto])

  async function enviar(e) {
    e.preventDefault()
    const mensaje = texto.trim()
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
      setMensajes((m) => [...m, { autor: 'bot', texto: r.respuesta, productos: r.productos, acciones: r.acciones }])
      // HU-10: si pidió ir a una sección concreta, lo lleva solo
      if (r.intencion === 'navegar' && r.acciones.length === 1) navegar(r.acciones[0].destino)
    } catch {
      setMensajes((m) => [...m, { autor: 'bot', texto: 'Ups, no pude responder. Intenta de nuevo en un momento.' }])
    } finally {
      setPensando(false)
    }
  }

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} aria-label="Abrir asistente"
        className="fixed bottom-24 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-rosa text-2xl shadow-lg">
        💬
      </button>
    )
  }

  return (
    <div className="fixed bottom-24 right-5 z-50 flex h-[32rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-tinta/10 bg-superficie shadow-2xl">
      <div className="flex items-center justify-between bg-morado px-4 py-3">
        <div>
          <p className="font-semibold">Asistente Play Shop Tek</p>
          <p className="text-xs text-tinta/70">Responde con inteligencia artificial</p>
        </div>
        <button onClick={() => setAbierto(false)} aria-label="Cerrar" className="text-xl">✕</button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {mensajes.map((m, i) => (
          <div key={i} className={m.autor === 'cliente' ? 'text-right' : ''}>
            <p className={'inline-block max-w-[85%] rounded-xl px-3 py-2 text-left text-sm ' +
              (m.autor === 'cliente' ? 'bg-rosa text-white' : 'bg-fondo')}>{m.texto}</p>

            {m.productos?.map((p) => (
              <div key={p.id} className="mt-2 flex items-center gap-3 rounded-xl border border-tinta/10 bg-fondo p-2">
                <Link to={'/producto/' + p.id} onClick={() => setAbierto(false)} className="flex min-w-0 flex-1 items-center gap-3 hover:text-rosa">
                  <img src="/logo.jpg" alt="" className="h-12 w-12 rounded-lg object-cover" />
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-semibold">{p.nombre}</p>
                    <p>
                      <span className="font-bold">S/ {Number(p.precio_final).toLocaleString('es-PE')}</span>
                      {p.descuento && <span className="ml-2 text-xs text-tinta/60 line-through">S/ {Number(p.precio).toLocaleString('es-PE')}</span>}
                    </p>
                    <p className="text-xs text-tinta/60">{p.stock > 0 ? p.stock + ' en stock' : 'Agotado'}</p>
                  </div>
                </Link>
                {p.stock > 0 && (
                  <button onClick={() => agregarAlCarrito(p)} aria-label={'Agregar ' + p.nombre + ' al carrito'}
                    className="rounded-lg bg-rosa px-2 py-1 text-xs font-semibold text-white">+ Carrito</button>
                )}
              </div>
            ))}

            {m.acciones?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {m.acciones.map((a) => a.tipo === 'whatsapp'
                  ? <a key={a.etiqueta} href={'https://wa.me/' + a.destino} target="_blank" rel="noreferrer"
                      className="rounded-lg border border-green-400/60 px-2 py-1 text-xs text-ok">{a.etiqueta}</a>
                  : <Link key={a.etiqueta} to={a.destino} onClick={() => setAbierto(false)}
                      className="rounded-lg border border-rosa/60 px-2 py-1 text-xs text-rosa">{a.etiqueta}</Link>)}
              </div>
            )}
          </div>
        ))}
        {pensando && <p className="text-sm text-tinta/60">Escribiendo…</p>}
        <div ref={final} />
      </div>

      <form onSubmit={enviar} className="flex gap-2 border-t border-tinta/10 p-3">
        <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={300}
          placeholder="Escribe tu pregunta…" className="flex-1 rounded-lg bg-fondo px-3 py-2 text-sm outline-none" />
        <button disabled={pensando} className="rounded-lg bg-rosa px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Enviar</button>
      </form>
    </div>
  )
}
