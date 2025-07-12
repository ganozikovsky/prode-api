# 🚀 Resumen: Cómo Probar la Autenticación con Google OAuth

## 📋 Pasos para configurar y probar

### 1. Configurar Google Cloud Console (MUY IMPORTANTE)

1. **Ve a [Google Cloud Console](https://console.cloud.google.com/)**
2. **Crea un proyecto nuevo** llamado "prode-api-oauth"
3. **Configura la pantalla de consentimiento OAuth:**
   - Tipo: "Externo"
   - Nombre: "Prode API"
   - Email de soporte: tu email
4. **Crear credenciales OAuth 2.0:**
   - Tipo: "Aplicación web"
   - URIs de origen: `http://localhost:3000`
   - URIs de redirección: `http://localhost:3000/auth/google/callback`
5. **Copiar las credenciales:**
   - Client ID: `123456789-abc123def456.apps.googleusercontent.com`
   - Client Secret: `GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx`

### 2. Configurar Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```bash
# Base de datos (usar tu URL existente)
DATABASE_URL="tu-database-url-aqui"

# JWT 
JWT_SECRET="super-secret-jwt-key-change-in-production-123456789"

# Google OAuth (REEMPLAZAR CON TUS CREDENCIALES REALES)
GOOGLE_CLIENT_ID="123456789-abc123def456.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx"
GOOGLE_CALLBACK_URL="http://localhost:3000/auth/google/callback"

# Puerto
PORT=3000
NODE_ENV=development
```

### 3. Iniciar el Servidor

```bash
npm run start:dev
```

### 4. Probar la Autenticación (Paso a Paso)

#### 4.1 Autenticarse con Google
```bash
# Abrir en el navegador:
http://localhost:3000/auth/google
```

**Resultado esperado:**
- Te redirige a Google
- Te autentican con Google
- Te redirige de vuelta con un JSON que contiene:
  - `access_token`: JWT token
  - `user`: Datos del usuario

#### 4.2 Usar el Token en Rutas Protegidas
```bash
# Copiar el access_token y usarlo en esta ruta:
GET http://localhost:3000/auth/profile
Authorization: Bearer tu_access_token_aqui
```

**Resultado esperado:**
```json
{
  "message": "✅ Usuario autenticado",
  "user": {
    "id": 1,
    "email": "tu-email@gmail.com",
    "name": "Tu Nombre",
    "avatar": "https://lh3.googleusercontent.com/..."
  }
}
```

### 5. Probar Rutas de Pronósticos con Autenticación

#### 5.1 Crear un pronóstico (ahora requiere autenticación)
```bash
POST http://localhost:3000/pronostics
Content-Type: application/json
Authorization: Bearer tu_access_token_aqui

{
  "externalId": "72_224_8_1",
  "prediction": {
    "scores": [2, 1],
    "scorers": ["Messi", "Alvarez"]
  }
}
```

**Nota:** Ya no necesitas pasar `userId` - se toma automáticamente del token.

#### 5.2 Obtener MIS pronósticos
```bash
GET http://localhost:3000/pronostics/my-pronostics
Authorization: Bearer tu_access_token_aqui
```

#### 5.3 Actualizar un pronóstico (solo si eres el propietario)
```bash
PATCH http://localhost:3000/pronostics/1
Content-Type: application/json
Authorization: Bearer tu_access_token_aqui

{
  "prediction": {
    "scores": [3, 0],
    "scorers": ["Messi", "Di María", "Lautaro"]
  }
}
```

### 6. Verificar en la Base de Datos

Después de autenticarte, verifica que se haya creado un usuario con:
- `googleId`: ID único de Google
- `email`: Email de tu cuenta Google
- `name`: Nombre de tu cuenta Google  
- `avatar`: URL de tu foto de perfil

### 7. Documentación de Swagger

Ve a `http://localhost:3000/api/docs` para ver toda la documentación actualizada con autenticación.

## 🛠️ Rutas Disponibles

### Rutas de Autenticación
- `GET /auth/google` - Iniciar login
- `GET /auth/google/callback` - Callback (automático)
- `GET /auth/profile` - Perfil del usuario (🔒 requiere JWT)

### Rutas de Pronósticos
- `GET /pronostics` - Obtener todos (público)
- `GET /pronostics/my-pronostics` - Mis pronósticos (🔒 requiere JWT)
- `POST /pronostics` - Crear pronóstico (🔒 requiere JWT)
- `PATCH /pronostics/:id` - Actualizar (🔒 requiere JWT + ser propietario)
- `DELETE /pronostics/:id` - Eliminar (🔒 requiere JWT + ser propietario)

## ❗ Problemas Comunes

### "origin_mismatch"
- Verifica que `http://localhost:3000` esté en los URIs de origen autorizados

### "redirect_uri_mismatch"  
- Verifica que `http://localhost:3000/auth/google/callback` esté en los URIs de redirección

### "invalid_client"
- Verifica que las credenciales en `.env` sean correctas

### "access_denied"
- Agrega tu email a la lista de usuarios de prueba en Google Cloud Console

## 🎯 Próximos Pasos

1. **Funciona en desarrollo** ✅
2. **Para producción:** Cambiar URLs a tu dominio real
3. **Para frontend:** Modificar el callback para redirigir a tu app
4. **Seguridad:** Cambiar `JWT_SECRET` por una clave más segura

## 📝 Archivos Importantes

- `GOOGLE_AUTH_SETUP.md` - Guía detallada de configuración
- `TESTING_GOOGLE_AUTH.md` - Guía de pruebas  
- `examples/api-examples.http` - Ejemplos de uso actualizado
- `src/auth/` - Todo el código de autenticación 