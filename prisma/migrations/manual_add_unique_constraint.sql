-- Migración manual para agregar constraint única
-- Ejecutar solo en entornos donde sea posible crear constraints

-- Eliminar duplicados antes de agregar la constraint (si existen)
-- NOTA: Esto mantiene solo el pronóstico más reciente por usuario y partido
DELETE FROM "Pronostic" p1
WHERE p1.id NOT IN (
    SELECT p2.id
    FROM "Pronostic" p2
    WHERE p2."externalId" = p1."externalId" AND p2."userId" = p1."userId"
    ORDER BY p2."updatedAt" DESC
    LIMIT 1
);

-- Agregar constraint única
ALTER TABLE "Pronostic" 
ADD CONSTRAINT "Pronostic_externalId_userId_key" 
UNIQUE ("externalId", "userId");

-- Comentario: Esta constraint garantiza que un usuario solo pueda tener un pronóstico por partido 