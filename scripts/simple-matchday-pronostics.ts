#!/usr/bin/env ts-node

import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const baseUrl = 'https://api.promiedos.com.ar';

function getMatchResult(scores: number[]): string {
  if (!scores || scores.length !== 2) return 'none';
  if (scores[0] > scores[1]) return 'home';
  if (scores[1] > scores[0]) return 'away';
  return 'draw';
}

function getAcertadoLabel(realScores: number[], predictedScores: number[]): string {
  if (!realScores || !predictedScores || realScores.length !== 2 || predictedScores.length !== 2) return '❓';
  if (realScores[0] === predictedScores[0] && realScores[1] === predictedScores[1]) return '🎯 Exacto';
  if (getMatchResult(realScores) === getMatchResult(predictedScores)) return '⚽ Resultado';
  return '❌ Falló';
}

async function showMatchdayPronostics(matchday: number) {
  try {
    console.log(`🔍 Mostrando pronósticos de la jornada ${matchday}...\n`);

    // 1. Obtener partidos de la jornada desde la API de Promiedos
    const url = `${baseUrl}/league/games/hc/72_224_8_${matchday}`;
    const response = await axios.get(url);
    const games = response.data.games || [];
    const matchIds = games.map((g: any) => g.id);
    const matchScores: Record<string, number[]> = {};
    games.forEach((g: any) => {
      matchScores[g.id] = g.scores;
    });

    if (matchIds.length === 0) {
      console.log('❌ No se encontraron partidos para esta jornada en la API');
      return;
    }

    // 2. Buscar pronósticos para esos partidos
    const pronostics = await prisma.pronostic.findMany({
      where: {
        externalId: { in: matchIds }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`📊 Encontrados ${pronostics.length} pronósticos para jornada ${matchday}\n`);

    if (pronostics.length === 0) {
      console.log('❌ No hay pronósticos para esta jornada');
      return;
    }

    // Ordenar por nombre de usuario
    pronostics.sort((a, b) => {
      const nameA = (a.user.name || '').toLowerCase();
      const nameB = (b.user.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

    // Crear un mapa de equipos por partido
    const matchTeams: Record<string, string> = {};
    games.forEach((g: any) => {
      const home = g.teams?.[0]?.name || 'Local';
      const away = g.teams?.[1]?.name || 'Visitante';
      matchTeams[g.id] = `${home} vs ${away}`;
    });

    // Mostrar pronósticos
    console.log('📝 PRONÓSTICOS DE LA JORNADA');
    console.log('='.repeat(120));
    // Truncar nombre si es muy largo
    function truncate(str: string, n: number) {
      return str.length > n ? str.slice(0, n - 1) + '…' : str;
    }
    const equiposWidth = 36; // Largo de 'Central Córdoba SdE vs Defensa y Justicia'
    console.log(`${'Usuario'.padEnd(18)} ${'Partido'.padEnd(20)} ${'Equipos'.padEnd(equiposWidth)} ${'Pronóstico'.padEnd(13)} ${'Real'.padEnd(9)} ${'Estado'.padEnd(8)} ${'Acierto'.padEnd(12)}`);
    console.log('='.repeat(120));

    pronostics.forEach(pronostic => {
      const userName = truncate(pronostic.user.name || 'Sin nombre', 17).padEnd(18);
      const game = pronostic.externalId.padEnd(20);
      let equipos = (matchTeams[pronostic.externalId] || '').padEnd(equiposWidth);
      if (equipos.length > equiposWidth) equipos = equipos.slice(0, equiposWidth - 1) + '…';
      let predictedScores: number[] = [];
      if (typeof pronostic.prediction === 'object' && pronostic.prediction !== null && 'scores' in pronostic.prediction) {
        predictedScores = (pronostic.prediction as any).scores;
      } else if (typeof pronostic.prediction === 'string') {
        try {
          const parsed = JSON.parse(pronostic.prediction);
          if (parsed && Array.isArray(parsed.scores)) {
            predictedScores = parsed.scores;
          }
        } catch {}
      }
      const prediction = JSON.stringify(predictedScores).padEnd(13);
      const real = matchScores[pronostic.externalId] ? JSON.stringify(matchScores[pronostic.externalId]).padEnd(9) : 'N/A'.padEnd(9);
      const status = pronostic.processed ? '✅'.padEnd(8) : '⏳'.padEnd(8);
      const acertado = getAcertadoLabel(matchScores[pronostic.externalId], predictedScores).padEnd(12);

      console.log(`${userName} ${game} ${equipos} ${prediction} ${real} ${status} ${acertado}`);
    });

    console.log('='.repeat(100));

    // Estadísticas simples
    const uniqueUsers = new Set(pronostics.map(p => p.userId)).size;
    const processedCount = pronostics.filter(p => p.processed).length;
    const pendingCount = pronostics.filter(p => !p.processed).length;

    console.log('\n📈 ESTADÍSTICAS');
    console.log('='.repeat(30));
    console.log(`👥 Usuarios: ${uniqueUsers}`);
    console.log(`📝 Total pronósticos: ${pronostics.length}`);
    console.log(`✅ Procesados: ${processedCount}`);
    console.log(`⏳ Pendientes: ${pendingCount}`);

    // Calcular puntos por usuario
    const userPoints: Record<string, { name: string, puntos: number }> = {};
    pronostics.forEach(pronostic => {
      let predictedScores: number[] = [];
      if (typeof pronostic.prediction === 'object' && pronostic.prediction !== null && 'scores' in pronostic.prediction) {
        predictedScores = (pronostic.prediction as any).scores;
      } else if (typeof pronostic.prediction === 'string') {
        try {
          const parsed = JSON.parse(pronostic.prediction);
          if (parsed && Array.isArray(parsed.scores)) {
            predictedScores = parsed.scores;
          }
        } catch {}
      }
      const realScores = matchScores[pronostic.externalId];
      let puntos = 0;
      if (realScores && predictedScores.length === 2) {
        if (realScores[0] === predictedScores[0] && realScores[1] === predictedScores[1]) puntos = 3;
        else if (getMatchResult(realScores) === getMatchResult(predictedScores)) puntos = 1;
      }
      const userKey = pronostic.user.id + '|' + (pronostic.user.name || 'Sin nombre');
      if (!userPoints[userKey]) userPoints[userKey] = { name: pronostic.user.name || 'Sin nombre', puntos: 0 };
      userPoints[userKey].puntos += puntos;
    });

    // Mostrar tabla de puntos por usuario
    const tabla = Object.entries(userPoints)
      .map(([key, val]) => ({ name: val.name, puntos: val.puntos }))
      .sort((a, b) => b.puntos - a.puntos || a.name.localeCompare(b.name));
    if (tabla.length > 0) {
      console.log('\n🏆 PUNTOS POR USUARIO EN LA JORNADA');
      console.log('='.repeat(40));
      console.log(`${'Usuario'.padEnd(22)}${'Puntos'.padEnd(8)}`);
      console.log('='.repeat(40));
      tabla.forEach(row => {
        console.log(`${row.name.padEnd(22)}${row.puntos.toString().padEnd(8)}`);
      });
      console.log('='.repeat(40));
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Función principal
async function main() {
  const args = process.argv.slice(2);
  const matchday = parseInt(args[0]) || 1;

  await showMatchdayPronostics(matchday);
}

// Ejecutar script
main().catch(console.error); 