# 🔗 Integración de Google OAuth en React + Vite

## 🎯 Opción 1: Google Identity Services (Recomendada)

### 1. Instalar dependencias

```bash
npm install @google-cloud/local-auth google-auth-library
# O más simple, usar el CDN en el HTML
```

### 2. Configurar en `index.html`

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Prode App</title>
  
  <!-- Google Identity Services -->
  <script src="https://accounts.google.com/gsi/client" async defer></script>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

### 3. Componente de Login con Google

```jsx
// src/components/GoogleLogin.jsx
import { useEffect, useState } from 'react';

const GoogleLogin = ({ onSuccess, onError }) => {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Inicializar Google Identity Services
    if (window.google) {
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
      });

      // Renderizar el botón
      window.google.accounts.id.renderButton(
        document.getElementById('google-signin-button'),
        {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          width: 300,
        }
      );
    }
  }, []);

  const handleCredentialResponse = async (response) => {
    setIsLoading(true);
    
    try {
      // Enviar el token de Google a tu backend
      const backendResponse = await fetch('http://localhost:3000/auth/google/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credential: response.credential,
        }),
      });

      const result = await backendResponse.json();
      
      if (backendResponse.ok) {
        // Guardar el token JWT en localStorage
        localStorage.setItem('token', result.access_token);
        localStorage.setItem('user', JSON.stringify(result.user));
        
        onSuccess(result);
      } else {
        onError(result.message || 'Error al autenticar');
      }
    } catch (error) {
      onError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="google-login-container">
      <h2>Iniciar sesión en Prode</h2>
      
      {isLoading ? (
        <div>Iniciando sesión...</div>
      ) : (
        <div id="google-signin-button"></div>
      )}
    </div>
  );
};

export default GoogleLogin;
```

### 4. Variables de entorno en Vite

```bash
# .env
VITE_GOOGLE_CLIENT_ID=tu-google-client-id.apps.googleusercontent.com
VITE_API_URL=http://localhost:3000
```

### 5. Hook para manejar autenticación

```jsx
// src/hooks/useAuth.js
import { useState, useEffect, createContext, useContext } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Verificar si hay token guardado al cargar la app
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    
    setIsLoading(false);
  }, []);

  const login = (userData) => {
    setUser(userData.user);
    setToken(userData.access_token);
    localStorage.setItem('token', userData.access_token);
    localStorage.setItem('user', JSON.stringify(userData.user));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const value = {
    user,
    token,
    isLoading,
    login,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
};
```

### 6. Componente principal de la App

```jsx
// src/App.jsx
import { useAuth } from './hooks/useAuth';
import GoogleLogin from './components/GoogleLogin';
import Dashboard from './components/Dashboard';

function App() {
  const { user, isLoading, login, logout } = useAuth();

  if (isLoading) {
    return <div>Cargando...</div>;
  }

  return (
    <div className="App">
      {user ? (
        <Dashboard user={user} onLogout={logout} />
      ) : (
        <GoogleLogin
          onSuccess={login}
          onError={(error) => console.error('Error:', error)}
        />
      )}
    </div>
  );
}

export default App;
```

### 7. Hook para hacer peticiones autenticadas

```jsx
// src/hooks/useApi.js
import { useAuth } from './useAuth';

export const useApi = () => {
  const { token, logout } = useAuth();
  const API_URL = import.meta.env.VITE_API_URL;

  const apiCall = async (endpoint, options = {}) => {
    const url = `${API_URL}${endpoint}`;
    
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      ...options,
    };

    try {
      const response = await fetch(url, defaultOptions);
      
      if (response.status === 401) {
        // Token expirado, cerrar sesión
        logout();
        return null;
      }
      
      const data = await response.json();
      return { data, ok: response.ok, status: response.status };
    } catch (error) {
      console.error('Error en API:', error);
      return { error: error.message, ok: false };
    }
  };

  return { apiCall };
};
```

### 8. Ejemplo de uso en componente

```jsx
// src/components/MyPronostics.jsx
import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';

const MyPronostics = () => {
  const [pronostics, setPronostics] = useState([]);
  const [loading, setLoading] = useState(true);
  const { apiCall } = useApi();

  useEffect(() => {
    loadPronostics();
  }, []);

  const loadPronostics = async () => {
    const result = await apiCall('/pronostics/my-pronostics');
    
    if (result.ok) {
      setPronostics(result.data.pronostics);
    }
    
    setLoading(false);
  };

  const createPronostic = async (pronosticData) => {
    const result = await apiCall('/pronostics', {
      method: 'POST',
      body: JSON.stringify(pronosticData),
    });

    if (result.ok) {
      setPronostics([result.data, ...pronostics]);
    }
  };

  if (loading) return <div>Cargando pronósticos...</div>;

  return (
    <div>
      <h2>Mis Pronósticos</h2>
      {pronostics.map((pronostic) => (
        <div key={pronostic.id}>
          <h3>Partido: {pronostic.externalId}</h3>
          <p>Predicción: {JSON.stringify(pronostic.prediction)}</p>
        </div>
      ))}
    </div>
  );
};

export default MyPronostics;
```

## 🔧 Modificaciones necesarias en el Backend

Para que funcione mejor con React, necesitas agregar esta ruta en tu backend:

```typescript
// src/auth/auth.controller.ts - Agregar esta ruta
@Post('google/verify')
@ApiOperation({
  summary: 'Verificar token de Google desde frontend',
  description: 'Verifica el token de Google Identity Services y retorna JWT',
})
async verifyGoogleToken(@Body() body: { credential: string }) {
  try {
    // Decodificar el token JWT de Google
    const ticket = await this.authService.verifyGoogleToken(body.credential);
    const payload = ticket.getPayload();
    
    const user = await this.authService.validateGoogleUser({
      id: payload.sub,
      displayName: payload.name,
      emails: [{ value: payload.email }],
      photos: [{ value: payload.picture }],
    });

    const tokens = await this.authService.generateTokens(user);
    
    return {
      message: '🎉 Autenticación exitosa con Google',
      ...tokens,
    };
  } catch (error) {
    throw new BadRequestException('Token de Google inválido');
  }
}
```

Y en el servicio:

```typescript
// src/auth/auth.service.ts - Agregar este método
async verifyGoogleToken(credential: string) {
  const { OAuth2Client } = require('google-auth-library');
  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  
  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  
  return ticket;
}
```

## 📋 Resumen para tu amigo

**Dile que necesita:**

1. **Instalar dependencias básicas** (fetch ya está incluido)
2. **Usar el mismo GOOGLE_CLIENT_ID** que configuraste en el backend
3. **Agregar el script de Google Identity Services** en el HTML
4. **Crear los componentes y hooks** que te muestro arriba
5. **Configurar CORS** en tu backend para permitir peticiones desde su dominio

**El flujo será:**
1. Usuario hace clic en "Iniciar sesión con Google"
2. Google devuelve un token
3. El frontend envía ese token a tu backend (`/auth/google/verify`)
4. Tu backend verifica el token y retorna un JWT
5. El frontend usa ese JWT para todas las peticiones protegidas

¿Quieres que implemente la ruta `/auth/google/verify` en tu backend para que funcione perfectamente con el frontend de React? 