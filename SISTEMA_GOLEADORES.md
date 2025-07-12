# 🎯 Sistema de Predicción con Goleadores

## 📋 Resumen de Cambios

Se ha implementado un sistema de predicción con goleadores que permite a los usuarios predecir no solo el resultado del partido, sino también quién anotará goles en cada equipo.

## 🔧 Cambios Técnicos Realizados

### 1. **Estructura de Datos Actualizada**

La estructura de predicción cambió de:
```json
{
  "scores": [2, 1],
  "scorers": ["Messi", "Di María"]
}
```

A:
```json
{
  "scores": [2, 1],
  "scorers": {
    "local": "Messi",      // Goleador del equipo local (opcional)
    "visitor": "Di María"  // Goleador del equipo visitante (opcional)
  }
}
```

### 2. **Sistema de Puntos**

- **Resultado exacto**: 3 puntos (sin cambios)
- **Solo resultado correcto**: 1 punto (sin cambios)
- **Goleador local acertado**: 5 puntos (NUEVO)
- **Goleador visitante acertado**: 5 puntos (NUEVO)
- **Máximo posible**: 13 puntos (3 + 5 + 5)

### 3. **Validaciones Implementadas**

- Solo se permite 1 goleador por equipo
- Los goleadores son opcionales
- Se valida la estructura con `class-validator` y `class-transformer`
- Se comparan los nombres en minúsculas para evitar problemas de capitalización

### 4. **Archivos Modificados**

1. **DTOs actualizados**:
   - `src/pronostic/dto/prediction.dto.ts`
   - `src/pronostic/dto/create-pronostic.dto.ts`
   - `src/pronostic/dto/update-pronostic.dto.ts`

2. **Servicio de puntos**:
   - `src/external-api/services/points.service.ts`
   - Actualizado `calculatePoints()` para incluir goleadores
   - Nuevo tipo `PointType` con opciones combinadas

3. **Configuración global**:
   - `src/main.ts` - Agregado `ValidationPipe` global

4. **Documentación**:
   - `examples/api-examples.http` - Ejemplos actualizados

## 📝 Uso del Sistema

### Crear un pronóstico con goleadores:
```http
POST /pronostics
Authorization: Bearer {token}
Content-Type: application/json

{
  "externalId": "abc123",
  "prediction": {
    "scores": [2, 1],
    "scorers": {
      "local": "Julián Álvarez",
      "visitor": "Lautaro Martínez"
    }
  }
}
```

### Pronóstico sin goleadores (válido):
```http
{
  "prediction": {
    "scores": [1, 0],
    "scorers": {}
  }
}
```

### Pronóstico con solo un goleador (válido):
```http
{
  "prediction": {
    "scores": [1, 1],
    "scorers": {
      "local": "Messi"
    }
  }
}
```

## ⚠️ Consideraciones Importantes

1. **Integración con API Externa**: 
   - Actualmente el sistema asume que los datos de goleadores reales vendrán en el mismo formato desde la API de Promiedos
   - Si la API no provee esta información, será necesario:
     - Crear una interfaz administrativa para ingresar goleadores manualmente
     - O integrar otra fuente de datos

2. **Comparación de Nombres**:
   - Se usa comparación case-insensitive
   - Se recomienda normalizar nombres (ej: "Di Maria" vs "Di María")
   - Considerar usar IDs de jugadores en el futuro

3. **Base de Datos**:
   - No se requieren migraciones ya que el campo `prediction` es JSON
   - La estructura es retrocompatible con pronósticos antiguos

## 🚀 Próximos Pasos Recomendados

1. **Validar disponibilidad de datos de goleadores** en la API de Promiedos
2. **Crear interfaz de administración** para gestionar goleadores si no están disponibles
3. **Implementar normalización de nombres** de jugadores
4. **Agregar tests unitarios** para el nuevo cálculo de puntos
5. **Actualizar el frontend** para soportar la nueva estructura

## 🧪 Testing

Para probar el sistema:

1. Crear un pronóstico con goleadores
2. Simular un partido finalizado con goleadores
3. Ejecutar el procesamiento de puntos: `GET /promiedos/admin/points/process-now`
4. Verificar que los puntos se calculen correctamente

Los puntos por goleadores se sumarán automáticamente cuando el partido finalice y el sistema procese los resultados.