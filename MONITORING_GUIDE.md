# 📊 Guía Completa de Monitoreo - Prode API

## 🎯 Sistema Multi-Nivel de Monitoreo

Tu aplicación ahora tiene un **sistema de monitoreo completo** que aprovecha todos tus add-ons de Heroku para darte visibilidad total sobre tus cron jobs.

## 🔧 **Add-ons Disponibles**

### 1. 📋 **Papertrail** (Logs Centralizados)
- **Propósito**: Ver logs en tiempo real y búsquedas históricas
- **Acceso**: Dashboard Heroku → Papertrail
- **Uso**: Logs estructurados con emojis para fácil identificación

#### Buscar logs específicos:
```
# Logs de cron jobs
"⏰ Ejecutando cron job"
"✅ Cron job completado"
"❌ Error en cron job"

# Logs de auditoría
"🚀 Iniciada ejecución"
"✅ Ejecución.*completada"
"❌ Ejecución.*falló"

# Logs por tipo de cron job
"update-current-matchday"
"process-points-dynamic"
"check-matches-today"
"cleanup-audit-logs"
```

### 2. 🔴 **Sentry** (Tracking de Errores)
- **Propósito**: Captura automática de errores con contexto completo
- **Acceso**: Dashboard Heroku → Sentry
- **Configuración automática**: Los errores de cron jobs se reportan con:
  - Nombre del cron job
  - ID de ejecución
  - Stack trace completo
  - Contexto adicional (parámetros, tiempos, etc.)

#### Tags automáticos en Sentry:
```javascript
{
  "service": "matchday-scheduler",
  "cron_job": "update-current-matchday",
  "execution_id": "123"
}
```

### 3. 📈 **New Relic APM** (Métricas de Performance)
- **Propósito**: Métricas de rendimiento y alertas proactivas
- **Acceso**: Dashboard Heroku → New Relic
- **Métricas automáticas enviadas:**

```javascript
// Métricas personalizadas por cron job
"Cron/update-current-matchday/Duration" // Tiempo de ejecución
"Cron/update-current-matchday/Success"  // Ejecuciones exitosas
"Cron/update-current-matchday/Errors"   // Errores ocurridos
"Cron/update-current-matchday/Changes"  // Cuando cambia la fecha actual
```

### 4. 🗄️ **Heroku Postgres** (Auditoría Detallada)
- **Propósito**: Historial completo y persistente de todas las ejecuciones
- **Tabla**: `cron_job_executions`
- **Retención**: 30 días (limpieza automática los domingos)

#### Estructura de datos:
```sql
SELECT 
  job_name,
  status,
  execution_time_ms,
  previous_value,
  new_value,
  records_affected,
  started_at,
  completed_at,
  error_message,
  host_info
FROM cron_job_executions 
ORDER BY started_at DESC;
```

## 🚀 **Cron Jobs Monitoreados**

### 1. **update-current-matchday**
- **Horario**: 6:00 y 18:00 (Buenos Aires)
- **Función**: Actualiza automáticamente la fecha actual del torneo
- **Duración típica**: 1-3 segundos
- **Impacto**: Cambia `current_matchday` en la tabla `system_config`

#### Qué monitorear:
```bash
# En Papertrail buscar:
"current_matchday.*→.*CAMBIÓ"  # Cuando cambia la fecha
"Error en cron job update-current-matchday"  # Errores

# En New Relic verificar:
- Métrica: Cron/update-current-matchday/Duration < 5000ms
- Métrica: Cron/update-current-matchday/Success > 0
```

### 2. **check-matches-today**
- **Horario**: 11:00 AM diario (Buenos Aires)
- **Función**: Verifica si hay partidos hoy y activa procesamiento de puntos
- **Duración típica**: 500ms-2 segundos
- **Impacto**: Activa/desactiva el procesamiento dinámico de puntos

#### Qué monitorear:
```bash
# En Papertrail buscar:
"HAY partidos hoy"     # Cuando encuentra partidos
"NO hay partidos hoy"  # Cuando no hay partidos
"Activando procesamiento de puntos"  # Sistema activado
```

### 3. **process-points-dynamic**
- **Horario**: Cada 5 minutos (15:00-01:00, solo cuando hay partidos)
- **Función**: Procesa partidos finalizados y actualiza puntos
- **Duración típica**: 1-10 segundos
- **Impacto**: Actualiza tabla `pronostics` (field `processed`) y puntos de usuarios

#### Qué monitorear:
```bash
# En Papertrail buscar:
"Encontrados.*partidos finalizados"  # Partidos para procesar
"pronósticos procesados"             # Cantidad procesada
"No hay partidos finalizados"        # Sin actividad
```

### 4. **cleanup-audit-logs**
- **Horario**: Domingos 02:00 AM (Buenos Aires)
- **Función**: Limpia registros de auditoría mayores a 30 días
- **Duración típica**: 1-5 segundos
- **Impacto**: Elimina registros antiguos de `cron_job_executions`

## 📊 **Endpoints de Monitoreo**

### 1. Estado General
```http
GET /promiedos/monitoring/cron-jobs/status
```
**Retorna**: Estado actual de todos los cron jobs, próximas ejecuciones

### 2. Estadísticas de Rendimiento
```http
GET /promiedos/monitoring/cron-jobs/stats?hours=24
```
**Retorna**: Tasa de éxito, tiempo promedio, fallos recientes

### 3. Historial Detallado
```http
GET /promiedos/monitoring/cron-jobs/history?limit=50
```
**Retorna**: Historial completo con cambios y metadatos

### 4. Ejecución Manual (Testing)
```http
GET /promiedos/monitoring/cron-jobs/execute/update-current-matchday
```
**Propósito**: Ejecutar cron jobs manualmente para testing

## ⚠️ **Alertas y Problemas Comunes**

### 🔴 Alertas Críticas (Configurar en New Relic)

#### 1. Cron Jobs Fallando
```javascript
// Alerta si fallan más de 2 veces en 1 hora
NRQL: "SELECT count(*) FROM Metric WHERE metricName = 'Cron/*/Errors'"
```

#### 2. Tiempo de Ejecución Alto
```javascript
// Alerta si toma más de 10 segundos
NRQL: "SELECT average(duration) FROM Metric WHERE metricName LIKE 'Cron/%/Duration'"
```

#### 3. Sin Ejecuciones
```javascript
// Alerta si no hay ejecuciones en 13 horas (debería ejecutar cada 12h)
NRQL: "SELECT count(*) FROM Metric WHERE metricName = 'Cron/update-current-matchday/Success'"
```

### 🟡 Problemas Comunes y Soluciones

#### 1. Error: "Connection timeout"
- **Causa**: Problemas de conectividad con la API externa o base de datos
- **Solución**: El sistema reintenta automáticamente
- **Verificar**: Logs de Heroku Postgres para problemas de conexión

#### 2. Error: "Token de Google inválido"
- **Causa**: Problemas con la autenticación de Google OAuth
- **Solución**: Verificar variables de entorno `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- **Verificar**: En Sentry buscar errores de autenticación

#### 3. Tiempo de ejecución alto
- **Causa**: API externa lenta o muchos pronósticos para procesar
- **Normal**: Hasta 10 segundos es aceptable
- **Preocupante**: Más de 30 segundos

#### 4. No cambia la fecha automáticamente
- **Verificar**: Que los datos de la API externa sean válidos
- **Logs**: Buscar "FECHA ACTUALIZADA" o "sin cambios"
- **Manual**: Ejecutar manualmente para testing

## 🎛️ **Dashboard Personalizado (Recomendado)**

### En New Relic, crear queries personalizadas:

#### 1. **Rendimiento de Cron Jobs**
```sql
SELECT average(duration) FROM Metric 
WHERE metricName LIKE 'Cron/%/Duration' 
TIMESERIES 1 hour SINCE 1 day ago
```

#### 2. **Tasa de Éxito**
```sql
SELECT 
  sum(success) / (sum(success) + sum(errors)) * 100 as 'Success Rate'
FROM (
  SELECT latest(value) as success FROM Metric WHERE metricName LIKE 'Cron/%/Success'
  UNION ALL
  SELECT latest(value) as errors FROM Metric WHERE metricName LIKE 'Cron/%/Errors'
)
```

#### 3. **Frecuencia de Cambios en Fechas**
```sql
SELECT count(*) FROM Metric 
WHERE metricName LIKE 'Cron/update-current-matchday/Changes'
TIMESERIES 1 day SINCE 1 week ago
```

## 📱 **Cómo Revisar en Heroku**

### Via Web Dashboard:
1. **Heroku Dashboard** → Tu App → **More** → **View logs**
2. **Add-ons** → **Papertrail** → Buscar por términos específicos
3. **Add-ons** → **New Relic** → Ver métricas y alertas
4. **Add-ons** → **Sentry** → Ver errores con contexto completo

### Via CLI:
```bash
# Ver logs en tiempo real
heroku logs --tail --app tu-app-name

# Filtrar logs de cron jobs
heroku logs --tail --app tu-app-name | grep "cron job"

# Ver logs de auditoría
heroku logs --tail --app tu-app-name | grep "Ejecución"

# Ver solo errores
heroku logs --tail --app tu-app-name | grep "❌"
```

## 📈 **KPIs Sugeridos**

### Diarios:
- ✅ Tasa de éxito de cron jobs > 95%
- ⏱️ Tiempo promedio de ejecución < 5 segundos
- 🔄 Al menos 2 ejecuciones exitosas de `update-current-matchday`

### Semanales:
- 📊 Cantidad de partidos procesados
- 👥 Cantidad de pronósticos procesados
- 🧹 Limpieza de logs funcionando (domingos)

### Mensuales:
- 📈 Tendencia de tiempo de ejecución
- 🚨 Cantidad total de errores
- 💾 Crecimiento de base de datos

## 🎯 **Próximos Pasos**

1. **Configurar alertas en New Relic** para problemas críticos
2. **Crear webhook de Slack/Discord** para notificaciones automáticas
3. **Configurar backup automático** de registros de auditoría
4. **Dashboard personalizado** con métricas de negocio

¡Con este sistema tienes **visibilidad completa** de tus cron jobs y puedes detectar problemas antes de que afecten a los usuarios! 🚀 