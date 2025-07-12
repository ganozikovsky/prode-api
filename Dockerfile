# Dockerfile
FROM node:18-alpine

# Instalar dependencias del sistema y crear directorio en una sola capa
RUN apk add --no-cache openssl && \
    mkdir -p /app

WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production && npm cache clean --force

# Copiar el resto de los archivos
COPY . .

# Generar Prisma Client y compilar en una sola capa
RUN npx prisma generate && \
    npm run build

# Exponer puerto
EXPOSE 3000

# Comando por defecto
CMD ["npm", "run", "start:prod"]