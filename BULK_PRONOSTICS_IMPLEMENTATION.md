# Implementación de Pronósticos en Bulk

## 🎯 Funcionalidad

La funcionalidad de pronósticos en bulk permite crear o actualizar múltiples pronósticos en una sola operación.

## 📋 Características

- **Upsert**: Crea nuevos pronósticos o actualiza existentes
- **Array directo**: El cliente envía directamente un array de pronósticos
- **Constraint única**: Un usuario solo puede tener un pronóstico por partido
- **Estadísticas**: Retorna cuántos fueron creados vs actualizados

## 🛠️ Implementación

### Endpoint
```
POST /pronostics/bulk
```

### Formato de Request
```json
[
  {
    "externalId": "partido1",
    "prediction": {
      "scores": [2, 1],
      "scorers": ["Messi", "Di María"]
    }
  },
  {
    "externalId": "partido2",
    "prediction": {
      "scores": [1, 1],
      "scorers": ["Cavani", "Suarez"]
    }
  }
]
```

### Formato de Response
```json
[
  {
    "id": 1,
    "externalId": "partido1",
    "userId": 1,
    "prediction": {
      "scores": [2, 1],
      "scorers": ["Messi", "Di María"]
    },
    "createdAt": "2024-07-11T19:00:00.000Z",
    "updatedAt": "2024-07-11T19:00:00.000Z",
    "user": {
      "id": 1,
      "name": "Juan Pérez",
      "email": "juan@ejemplo.com"
    }
  },
  {
    "id": 2,
    "externalId": "partido2",
    "userId": 1,
    "prediction": {
      "scores": [1, 1],
      "scorers": ["Cavani", "Suarez"]
    },
    "createdAt": "2024-07-11T19:00:00.000Z",
    "updatedAt": "2024-07-11T19:00:00.000Z",
    "user": {
      "id": 1,
      "name": "Juan Pérez",
      "email": "juan@ejemplo.com"
    }
  }
]
```

## 🔧 Cambios en el Código

### 1. Schema de Prisma
```prisma
model Pronostic {
  // ... otros campos
  
  // Constraint única: un usuario solo puede tener un pronóstico por partido
  @@unique([externalId, userId])
}
```

### 2. Servicio (PronosticService)
```typescript
async createBulk(pronostics: CreatePronosticDto[], userId: number) {
  // 1. Obtener pronósticos existentes para calcular estadísticas
  const existingPronostics = await this.prisma.pronostic.findMany({...});
  
  // 2. Crear promesas de upsert usando constraint única
  const upsertPromises = pronostics.map((pronostic) => {
    return this.prisma.pronostic.upsert({
      where: {
        externalId_userId: {
          externalId: pronostic.externalId,
          userId: userId,
        },
      },
      create: { /* datos nuevos */ },
      update: { /* datos actualizados */ },
    });
  });

  // 3. Ejecutar todas las operaciones en una transacción
  const upsertedPronostics = await this.prisma.$transaction(upsertPromises);
  
  // 4. Retornar estadísticas
}
```

### 3. Controlador (PronosticController)
```typescript
@Post('bulk')
@UseGuards(AuthGuard('jwt'))
async createBulk(
  @Body() pronostics: CreatePronosticDto[],
  @CurrentUser() user: any,
) {
  return this.pronosticService.createBulk(pronostics, user.id);
}
```

## 🚀 Ventajas

1. **Simplicidad**: El cliente envía directamente un array
2. **Eficiencia**: Menos llamadas HTTP, operaciones paralelas
3. **Flexibilidad**: Crea o actualiza según sea necesario
4. **Atomicidad**: Todas las operaciones en una transacción
5. **Manejo de errores**: Filtro global de excepciones de Prisma

## 🔒 Validaciones

- Autenticación JWT requerida
- Validación de DTOs
- Constraint única a nivel de base de datos
- Filtro global de excepciones de Prisma
- Manejo automático de errores con respuestas HTTP apropiadas

## 📝 Migración

Para entornos donde sea posible, ejecutar:
```sql
-- Ver archivo: prisma/migrations/manual_add_unique_constraint.sql
```

## 🧪 Testing

Usar el archivo `examples/api-examples.http` sección `11b` para probar la funcionalidad.

## 📝 Código Final Implementado

### Upsert con Transacción (Implementación Final)
```typescript
async createBulk(pronostics: CreatePronosticDto[], userId: number) {
  const upsertPromises = pronostics.map((pronostic) => {
    return this.prisma.pronostic.upsert({
      where: {
        externalId_userId: {
          externalId: pronostic.externalId,
          userId: userId,
        },
      },
      create: {
        externalId: pronostic.externalId,
        userId: userId,
        prediction: pronostic.prediction as Prisma.JsonObject,
      },
      update: {
        prediction: pronostic.prediction as Prisma.JsonObject,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  });

  return this.prisma.$transaction(upsertPromises);
}
```

### Ventajas de la Implementación Final

1. **Upsert nativo de Prisma**: Más eficiente y limpio
2. **Transacción**: Atomicidad garantizada con `$transaction`
3. **Constraint única**: Garantiza integridad a nivel de DB
4. **Código simple**: Sin try/catch, sin cálculos de estadísticas
5. **Filtro global**: Manejo automático de excepciones de Prisma
6. **Operaciones paralelas**: Todas las operaciones se ejecutan en paralelo dentro de la transacción 