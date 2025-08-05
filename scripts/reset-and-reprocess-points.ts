#!/usr/bin/env ts-node

import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PointsService } from '../src/external-api/services/points.service';

const prisma = new PrismaClient();
const baseUrl = 'https://api.promiedos.com.ar';

async function resetPoints() {
  console.log('🔄 Reseteando puntos acumulados...');
  await prisma.matchdayPoints.updateMany({ data: { points: 0 } });
  await prisma.tournamentParticipant.updateMany({ data: { points: 0 } });
  await prisma.user.updateMany({ data: { globalPoints: 0 } });
  await prisma.pronostic.updateMany({ data: { processed: false, livePoints: 0 } });
  console.log('✅ Todos los puntos y estados de pronósticos reseteados.');
}

async function getFinalizedGamesOfMatchday(matchday: number) {
  const url = `${baseUrl}/league/games/hc/72_224_8_${matchday}`;
  const response = await axios.get(url);
  const games = response.data.games || [];
  // status.enum === 3 es finalizado
  return games.filter((g: any) => g.status?.enum === 3);
}

async function reprocessMatchday3() {
  console.log('🔁 Reprocesando partidos finalizados de la jornada 3...');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const pointsService = app.get(PointsService);

  // 1. Obtener partidos finalizados de la jornada 3
  const finalizedGames = await getFinalizedGamesOfMatchday(3);
  console.log(`📋 Partidos finalizados en jornada 3: ${finalizedGames.length}`);
  finalizedGames.forEach(g => {
    const home = g.teams?.[0]?.name || 'Local';
    const away = g.teams?.[1]?.name || 'Visitante';
    console.log(`- ${g.id}: ${home} vs ${away} (${g.scores?.join('-')})`);
  });

  // 2. Procesar pronósticos de cada partido finalizado
  let totalPronostics = 0;
  let totalUsers = new Set<number>();
  let userPoints: Record<number, number> = {};

  for (const game of finalizedGames) {
    const result = await pointsService['processGamePronosticsDetailed'](game, 3);
    totalPronostics += result.processedCount;
    result.userDetails.forEach(u => {
      totalUsers.add(u.userId);
      userPoints[u.userId] = (userPoints[u.userId] || 0) + u.pointsAwarded;
    });
  }

  await app.close();

  // 3. Mostrar resumen
  console.log('\n✅ Reprocesamiento completado.');
  console.log(`Pronósticos procesados: ${totalPronostics}`);
  console.log(`Usuarios afectados: ${totalUsers.size}`);
  if (Object.keys(userPoints).length > 0) {
    console.log('\n🏆 Puntos por usuario en jornada 3:');
    console.log('='.repeat(40));
    const users = await prisma.user.findMany({ where: { id: { in: Object.keys(userPoints).map(Number) } } });
    Object.entries(userPoints)
      .sort((a, b) => b[1] - a[1])
      .forEach(([userId, puntos]) => {
        const user = users.find(u => u.id === Number(userId));
        const name = user?.name || 'Sin nombre';
        console.log(`${name.padEnd(22)}${puntos.toString().padEnd(8)}`);
      });
    console.log('='.repeat(40));
  }
}

async function main() {
  await resetPoints();
  await reprocessMatchday3();
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); }); 