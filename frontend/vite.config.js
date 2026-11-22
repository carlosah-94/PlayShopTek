import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// En desarrollo, las llamadas a /api se reenvían al backend.
// Dentro de Docker el backend se llama "backend"; fuera, "localhost".
const destino = process.env.API_PROXY || 'http://localhost:8000'

// Mejora 3b: "saludar" al servidor de Render apenas abre la página (preconnect).
// Así la conexión (DNS + TCP + TLS) se arma mientras baja el código, y no después,
// cuando el catálogo o la ficha recién piden los productos. Solo en producción (VITE_API_URL).
const saludarServidor = {
  name: 'preconnect-api',
  transformIndexHtml() {
    const url = process.env.VITE_API_URL
    if (!url) return []
    return [{ tag: 'link', attrs: { rel: 'preconnect', href: new URL(url).origin, crossorigin: '' }, injectTo: 'head-prepend' }]
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss(), saludarServidor],
  server: {
    host: true,
    port: 5173,
    proxy: { '/api': { target: destino, changeOrigin: true } },
    watch: { usePolling: true }, // necesario para ver cambios en Docker sobre Windows
  },
})