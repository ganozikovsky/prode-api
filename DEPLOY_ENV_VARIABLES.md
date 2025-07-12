# 🚀 Variables de Entorno para Deploy

## 📋 Variables OBLIGATORIAS para Producción

### 🔐 Autenticación Google OAuth
```bash
# Google OAuth (MISMAS credenciales que usas en desarrollo)
GOOGLE_CLIENT_ID="123456789-abc123def456.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx"
GOOGLE_CALLBACK_URL="https://tu-dominio.com/auth/google/callback"
```

### 🔑 JWT Security
```bash
# JWT (CAMBIAR por una clave MUY segura en producción)
JWT_SECRET="super-secret-jwt-key-production-change-this-12345678901234567890"
```

### 🗄️ Base de Datos
```bash
# PostgreSQL (proporcionada por tu hosting)
DATABASE_URL="postgresql://usuario:password@host:5432/database_name"

# Si usas connection pooling (recomendado para producción)
DATABASE_CONNECTION_POOL_URL="postgresql://usuario:password@host:5432/database_name?pgbouncer=true"
```

### 🌐 URLs y Configuración
```bash
# Puerto (generalmente lo maneja el hosting automáticamente)
PORT=3000

# Entorno
NODE_ENV="production"

# URL del frontend (para CORS y redirecciones)
FRONTEND_URL="https://tu-frontend.com"
```

### 📊 Monitoreo (Opcionales pero recomendadas)
```bash
# Sentry para tracking de errores
SENTRY_DSN="https://tu-sentry-dsn@sentry.io/proyecto"

# New Relic para monitoreo
NEW_RELIC_LICENSE_KEY="tu-new-relic-license-key"
NEW_RELIC_APP_NAME="prode-api-production"
```

## 🔧 Configuración por Plataforma

### Heroku
```bash
# Agregar las variables usando Heroku CLI:
heroku config:set GOOGLE_CLIENT_ID="tu-client-id"
heroku config:set GOOGLE_CLIENT_SECRET="tu-client-secret"
heroku config:set JWT_SECRET="tu-jwt-secret-super-seguro"
heroku config:set GOOGLE_CALLBACK_URL="https://tu-app.herokuapp.com/auth/google/callback"
heroku config:set FRONTEND_URL="https://tu-frontend.com"
heroku config:set NODE_ENV="production"

# DATABASE_URL se configura automáticamente cuando agregás Postgres
```

### Vercel
```bash
# En el dashboard de Vercel o usando CLI:
vercel env add GOOGLE_CLIENT_ID
vercel env add GOOGLE_CLIENT_SECRET  
vercel env add JWT_SECRET
vercel env add GOOGLE_CALLBACK_URL
vercel env add FRONTEND_URL
vercel env add DATABASE_URL
```

### Railway
```bash
# En el dashboard o usando CLI:
railway variables set GOOGLE_CLIENT_ID="tu-client-id"
railway variables set GOOGLE_CLIENT_SECRET="tu-client-secret"
railway variables set JWT_SECRET="tu-jwt-secret"
railway variables set GOOGLE_CALLBACK_URL="https://tu-app.railway.app/auth/google/callback"
railway variables set FRONTEND_URL="https://tu-frontend.com"
```

### DigitalOcean / Netlify Functions / AWS
```bash
# Configurar en el panel de cada plataforma:
GOOGLE_CLIENT_ID=tu-client-id
GOOGLE_CLIENT_SECRET=tu-client-secret
JWT_SECRET=tu-jwt-secret-super-seguro
GOOGLE_CALLBACK_URL=https://tu-dominio.com/auth/google/callback
FRONTEND_URL=https://tu-frontend.com
DATABASE_URL=postgresql://...
NODE_ENV=production
```

## ⚠️ IMPORTANTE: Configurar Google Cloud Console para Producción

### 1. Actualizar URLs autorizadas
En Google Cloud Console, agregar:

**URIs de origen JavaScript autorizados:**
```
https://tu-dominio.com
https://tu-frontend.com
```

**URIs de redirección autorizados:**
```
https://tu-dominio.com/auth/google/callback
```

### 2. Cambiar estado de la app
- Si está en "Testing" → cambiar a "In production"
- O mantener en Testing y agregar usuarios de prueba

## 🔒 Buenas Prácticas de Seguridad

### 1. JWT_SECRET
```bash
# Generar una clave súper segura (32+ caracteres)
JWT_SECRET="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
```

### 2. CORS
Tu app ya tiene CORS configurado para producción:
```typescript
origin: [
  process.env.FRONTEND_URL, // Tu frontend en producción
  // otros dominios si necesitas
]
```

### 3. Variables Sensibles
- ❌ **NUNCA** commitear variables de entorno al repositorio
- ✅ Usar el panel de tu hosting para configurarlas
- ✅ Usar diferentes valores para desarrollo y producción

## 📝 Checklist de Deploy

### Antes del deploy:
- [ ] Configurar todas las variables de entorno en tu hosting
- [ ] Actualizar URLs en Google Cloud Console
- [ ] Verificar que DATABASE_URL apunte a tu BD de producción
- [ ] Cambiar JWT_SECRET a un valor seguro único

### Después del deploy:
- [ ] Probar login con Google en producción
- [ ] Verificar que las rutas protegidas funcionen
- [ ] Comprobar que se crean usuarios en la BD de producción
- [ ] Testear CORS desde tu frontend

## 🐛 Debugging

Si algo no funciona en producción:

1. **Verificar logs del servidor**
2. **Comprobar que todas las variables estén configuradas**
3. **Verificar URLs en Google Cloud Console**
4. **Testear las rutas de auth individualmente**

### Variables mínimas para que funcione:
```bash
DATABASE_URL=postgresql://...
GOOGLE_CLIENT_ID=tu-client-id
GOOGLE_CLIENT_SECRET=tu-client-secret  
JWT_SECRET=tu-jwt-secret
GOOGLE_CALLBACK_URL=https://tu-dominio.com/auth/google/callback
NODE_ENV=production
```

¡Con esto tu API debería funcionar perfectamente en producción! 🚀 