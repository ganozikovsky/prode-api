# 🧪 Guía para Probar la Autenticación con Google

## 1. Configurar Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```bash
# Base de datos (usar tu URL existente)
DATABASE_URL="tu-database-url-aqui"

# JWT (generar una clave secreta segura)
JWT_SECRET="super-secret-jwt-key-change-in-production-123456789"

# Google OAuth (REEMPLAZAR CON TUS CREDENCIALES REALES)
GOOGLE_CLIENT_ID="123456789-abc123def456.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx"
GOOGLE_CALLBACK_URL="http://localhost:3000/auth/google/callback"

# Puerto
PORT=3000
NODE_ENV=development
```

## 2. Iniciar el Servidor

```bash
npm run start:dev
```

## 3. Probar las Rutas de Autenticación

### Opción A: Usando el navegador

1. **Ir a la ruta de login con Google:**
   ```
   http://localhost:3000/auth/google
   ```

2. **Deberías ser redirigido a Google para autenticarte**

3. **Después de autenticarte, deberías ver una respuesta JSON con:**
   ```json
   {
     "message": "🎉 Autenticación exitosa con Google",
     "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "user": {
       "id": 1,
       "email": "tu-email@gmail.com",
       "name": "Tu Nombre",
       "avatar": "https://lh3.googleusercontent.com/..."
     }
   }
   ```

### Opción B: Usando herramientas como Thunder Client o Postman

1. **GET** `http://localhost:3000/auth/google`
   - Esto te dará un redirect a Google

2. **Después de autenticarte, copia el access_token**

3. **Probar ruta protegida:**
   ```
   GET http://localhost:3000/auth/profile
   Authorization: Bearer TU_ACCESS_TOKEN_AQUI
   ```

## 4. Verificar en la Base de Datos

Después de autenticarte, deberías ver un nuevo usuario en tu base de datos con:
- `googleId`: ID de Google
- `email`: Email de Google
- `name`: Nombre de Google
- `avatar`: URL de la foto de perfil

## 5. Problemas Comunes

### Error: "origin_mismatch"
- Verifica que `http://localhost:3000` esté en los "URIs de origen de JavaScript autorizados"

### Error: "redirect_uri_mismatch"
- Verifica que `http://localhost:3000/auth/google/callback` esté en los "URIs de redirección autorizados"

### Error: "invalid_client"
- Verifica que `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` estén correctos

### Error: "access_denied"
- Verifica que el usuario esté en la lista de usuarios de prueba (si la app está en modo testing)

## 6. Flujo Completo de Prueba

```bash
# 1. Iniciar servidor
npm run start:dev

# 2. Abrir navegador
http://localhost:3000

# 3. Hacer clic en login con Google
http://localhost:3000/auth/google

# 4. Autenticarse con Google

# 5. Usar el token para rutas protegidas
curl -H "Authorization: Bearer TU_TOKEN" http://localhost:3000/auth/profile
```

## 7. Siguiente Paso: Integrar con Frontend

Una vez que funcione, puedes modificar el callback para redirigir a tu frontend:

```typescript
// En auth.controller.ts
@Get('google/callback')
async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
  const user = req.user;
  const tokens = await this.authService.generateTokens(user);
  
  // Redirigir al frontend con el token
  res.redirect(`${process.env.FRONTEND_URL}/auth/success?token=${tokens.access_token}`);
}
```

## 8. Proteger Rutas Existentes

Para proteger cualquier ruta existente, agrega el guard:

```typescript
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Get('mi-ruta-protegida')
@UseGuards(AuthGuard('jwt'))
async rutaProtegida(@Req() req: Request) {
  return { user: req.user, message: 'Solo usuarios autenticados' };
}
``` 