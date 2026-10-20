# Imagen del frontend para DESARROLLO (servidor de Vite con recarga automática).
# En producción el frontend se publica en Vercel con "npm run build".
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev"]