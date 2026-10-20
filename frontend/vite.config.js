import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// En desarrollo, las llamadas a /api se reenvían al backend.
// Dentro de Docker el backend se llama "backend"; fuera, "localhost".
const destino = process.env.API_PROXY || 'http://localhost:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    proxy: { '/api': { target: destino, changeOrigin: true } },
    watch: { usePolling: true }, // necesario para ver cambios en Docker sobre Windows
  },
})