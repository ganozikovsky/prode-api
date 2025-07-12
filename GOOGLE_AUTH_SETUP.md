# Configuración de Google OAuth

## Variables de Entorno Necesarias

Agrega estas variables a tu archivo `.env`:

```bash
# JWT
JWT_SECRET="tu-clave-secreta-jwt-muy-segura-cambiala-en-produccion"

# Google OAuth
GOOGLE_CLIENT_ID="tu-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="tu-google-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:3000/auth/google/callback"

# Frontend (opcional para redirección)
FRONTEND_URL="http://localhost:3001"
```

## Configuración en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita la API de Google+ (Google+ API)
4. Ve a "Credenciales" y crea credenciales OAuth 2.0
5. Configura las URLs autorizadas:
   - **Orígenes JavaScript autorizados**: `http://localhost:3000`
   - **URIs de redirección autorizadas**: `http://localhost:3000/auth/google/callback`

## Rutas de Autenticación

- `GET /auth/google` - Iniciar login con Google
- `GET /auth/google/callback` - Callback de Google (automático)
- `GET /auth/profile` - Obtener perfil del usuario autenticado (requiere JWT)

## Uso

1. El usuario hace clic en "Iniciar sesión con Google"
2. Se redirige a `GET /auth/google`
3. Google redirige a `/auth/google/callback`
4. Se genera un JWT y se retorna al usuario
5. El usuario puede usar el JWT para acceder a rutas protegidas

## Proteger Rutas

Para proteger una ruta, usa el guard JWT:

```typescript
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Get('ruta-protegida')
@UseGuards(AuthGuard('jwt'))
async rutaProtegida() {
  // Solo usuarios autenticados pueden acceder
}
```

## Obtener Usuario Actual

```typescript
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Get('mi-perfil')
@UseGuards(AuthGuard('jwt'))
async miPerfil(@CurrentUser() user: any) {
  return user;
}
``` 