# Filtro de Excepciones de Prisma

## 🎯 Funcionalidad

El `PrismaExceptionFilter` captura automáticamente todas las excepciones de Prisma en la aplicación y las convierte en respuestas HTTP apropiadas.

## 🔧 Implementación

### Archivo: `src/common/filters/prisma-exception.filter.ts`

Filtro global que captura `PrismaClientKnownRequestError` y las transforma en:
- **HTTP Status Code** apropiado
- **Mensaje de error** amigable al usuario
- **Logging** para debugging
- **Información adicional** en desarrollo

### Códigos de Error Manejados

| Código Prisma | HTTP Status | Descripción |
|---------------|-------------|-------------|
| `P2002` | 409 Conflict | Violación de constraint única |
| `P2025` | 404 Not Found | Registro no encontrado |
| `P2003` | 400 Bad Request | Violación de constraint de clave foránea |
| `P2014` | 400 Bad Request | Relación requerida faltante |
| **Otros** | 500 Internal Server Error | Error genérico de base de datos |

## 🚀 Ventajas

### 1. **Manejo Centralizado**
- No necesitas try/catch en cada método
- Consistencia en todas las respuestas de error
- Fácil mantenimiento y modificación

### 2. **Código Limpio**
```typescript
// ANTES (con try/catch manual)
async createBulk(pronostics: CreatePronosticDto[], userId: number) {
  try {
    return await this.prisma.$transaction(upsertPromises);
  } catch (error) {
    throw new InternalServerErrorException('Error al crear pronósticos');
  }
}

// DESPUÉS (con filtro global)
async createBulk(pronostics: CreatePronosticDto[], userId: number) {
  return this.prisma.$transaction(upsertPromises);
}
```

### 3. **Respuestas Consistentes**
```json
{
  "statusCode": 409,
  "timestamp": "2024-07-11T19:00:00.000Z",
  "path": "/pronostics/bulk",
  "method": "POST",
  "message": "Ya existe un registro con esos datos únicos",
  "error": "Unique constraint failed on the constraint: externalId_userId" // Solo en desarrollo
}
```

## 📋 Configuración

### Aplicación Global
```typescript
// src/main.ts
app.useGlobalFilters(new PrismaExceptionFilter());
```

### Casos de Uso Comunes

1. **Constraint Única** (P2002):
   - Usuario intenta crear pronóstico duplicado
   - Respuesta: 409 Conflict

2. **Registro No Encontrado** (P2025):
   - Intento de actualizar/eliminar registro inexistente
   - Respuesta: 404 Not Found

3. **Clave Foránea** (P2003):
   - Referencia a usuario que no existe
   - Respuesta: 400 Bad Request

## 🛠️ Personalización

Para agregar más códigos de error:

```typescript
switch (exception.code) {
  case 'P2016':
    status = HttpStatus.BAD_REQUEST;
    message = 'Consulta malformada';
    break;
  // ... más casos
}
```

## 🧪 Testing

El filtro se aplica automáticamente a todos los endpoints que usan Prisma. No necesitas configuración adicional en los métodos del servicio.

## 🔒 Seguridad

- **Producción**: Solo muestra mensajes genéricos
- **Desarrollo**: Incluye detalles técnicos del error
- **Logging**: Registra errores completos para debugging 