// HU-24: recuadro para subir una foto (arrastrándola o con clic), como los del prototipo.
// Antes de enviarla, el navegador la achica y la pasa a WebP: así pesa poco y la página no se pone lenta.
import { useRef, useState } from 'react'
import { api, urlImagen } from '../api.js'
import Icono from './Iconos.jsx'

// Dibuja la foto en un lienzo (canvas) de como máximo `maxAncho` px y la devuelve como texto base64 WebP
function achicar(archivo, maxAncho) {
  return new Promise((resolver, rechazar) => {
    const img = new Image()
    img.onload = () => {
      const escala = Math.min(1, maxAncho / img.width)
      const lienzo = document.createElement('canvas')
      lienzo.width = Math.round(img.width * escala)
      lienzo.height = Math.round(img.height * escala)
      const ctx = lienzo.getContext('2d')
      ctx.fillStyle = '#ffffff' // las fotos con fondo transparente quedan con fondo blanco
      ctx.fillRect(0, 0, lienzo.width, lienzo.height)
      ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height)
      URL.revokeObjectURL(img.src)
      resolver(lienzo.toDataURL('image/webp', 0.82))
    }
    img.onerror = () => rechazar(new Error('No se pudo abrir esa imagen.'))
    img.src = URL.createObjectURL(archivo)
  })
}

export default function SubirFoto({ id, url, onCambio, etiqueta, proporcion = 'aspect-[3/4]', maxAncho = 1200 }) {
  const entrada = useRef(null)
  const [subiendo, setSubiendo] = useState(false)
  const [encima, setEncima] = useState(false) // un archivo se está arrastrando encima
  const [error, setError] = useState('')

  const subir = async (archivo) => {
    if (!archivo) return
    if (!/^image\/(jpeg|png|webp)$/.test(archivo.type)) return setError('Usa una foto JPG, PNG o WebP.')
    setError(''); setSubiendo(true)
    try {
      const datos = await achicar(archivo, maxAncho)
      const r = await api('/imagenes', { metodo: 'POST', cuerpo: { datos } })
      onCambio(r.url)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <div className="min-w-0">
      <button type="button" id={id} onClick={() => entrada.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setEncima(true) }} onDragLeave={() => setEncima(false)}
        onDrop={(e) => { e.preventDefault(); setEncima(false); subir(e.dataTransfer.files[0]) }}
        aria-label={(url ? 'Cambiar ' : 'Subir ') + etiqueta}
        className={'relative grid w-full place-items-center overflow-hidden rounded-xl border-2 border-dashed text-xs text-tinta/60 ' + proporcion + ' ' +
          (encima ? 'border-rosa bg-rosa/10' : 'border-morado/30 bg-gradient-to-br from-morado/10 to-rosa/10 hover:border-rosa/60')}>
        {url
          ? <img src={urlImagen(url)} alt="" className="absolute inset-0 h-full w-full bg-white object-contain" />
          : <span className="flex flex-col items-center gap-1 p-2 text-center"><Icono nombre="mas" tam={22} />{subiendo ? 'Subiendo…' : etiqueta}</span>}
        {url && subiendo && <span className="absolute inset-0 grid place-items-center bg-black/50 text-white">Subiendo…</span>}
      </button>
      <input ref={entrada} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" tabIndex={-1}
        onChange={(e) => { subir(e.target.files[0]); e.target.value = '' }} />
      {url && (
        <button type="button" onClick={() => onCambio(null)} className="mt-1 text-xs font-semibold text-error hover:underline">Quitar</button>
      )}
      {error && <p className="mt-1 text-xs text-error">{error}</p>}
    </div>
  )
}
