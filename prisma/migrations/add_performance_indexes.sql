-- Migración Manual: Índices de Optimización de Performance
-- Ejecutar con: npx prisma db execute --file ./prisma/migrations/add_performance_indexes.sql

-- 1. Índices para búsquedas frecuentes de pronósticos
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pronostic_user_external 
ON "Pronostic"("userId", "externalId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pronostic_processed_external 
ON "Pronostic"("processed", "externalId") 
WHERE "processed" = false;

-- 2. Índices para rankings de torneos
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tournament_participant_points 
ON "TournamentParticipant"("tournamentId", "points" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matchday_points_ranking 
ON "MatchdayPoints"("tournamentId", "matchday", "points" DESC);

-- 3. Índice compuesto para búsquedas de puntos por usuario
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matchday_points_user_tournament 
ON "MatchdayPoints"("userId", "tournamentId", "matchday");

-- 4. Índices para auditoría de cron jobs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cron_job_date_range 
ON "cron_job_executions"("jobName", "startedAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cron_job_status 
ON "cron_job_executions"("status", "startedAt" DESC);

-- 5. Índice para búsquedas de pronósticos por fecha de creación
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pronostic_created_at 
ON "Pronostic"("createdAt" DESC);

-- 6. Índice para búsquedas de torneos activos
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tournament_active 
ON "Tournament"("isActive", "createdAt" DESC) 
WHERE "isActive" = true;

-- 7. Índice para optimizar JOINs usuario-pronóstico
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_pronostics 
ON "Pronostic"("userId", "createdAt" DESC);

-- 8. Estadísticas de tabla para el query planner
ANALYZE "Pronostic";
ANALYZE "TournamentParticipant";
ANALYZE "MatchdayPoints";
ANALYZE "Tournament";
ANALYZE "User";
ANALYZE "cron_job_executions";

-- Verificar índices creados
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('Pronostic', 'TournamentParticipant', 'MatchdayPoints', 'Tournament', 'cron_job_executions')
ORDER BY tablename, indexname;