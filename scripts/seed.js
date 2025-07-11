const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seeding de la base de datos...');

  // Crear usuarios de ejemplo
  const user1 = await prisma.user.create({
    data: {
      email: 'juan@prode.com',
      name: 'Juan Pronósticos',
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: 'maria@prode.com',
      name: 'María Futbolera',
    },
  });

  console.log('Usuarios creados:', { user1, user2 });

  // Crear pronósticos de ejemplo
  const pronostic1 = await prisma.pronostic.create({
    data: {
      externalId: '72_224_8_1', // Fecha 1 del torneo
      userId: user1.id,
      prediction: {
        scores: [2, 1],
        scorers: ['Messi', 'Alvarez'],
      },
    },
  });

  const pronostic2 = await prisma.pronostic.create({
    data: {
      externalId: '72_224_3_1', // Fecha que ya finalizó
      userId: user2.id,
      prediction: {
        scores: [1, 2],
        scorers: ['Botta', 'Bebelo'],
      },
    },
  });

  const pronostic3 = await prisma.pronostic.create({
    data: {
      externalId: '72_224_8_1', // Mismo partido, diferente usuario
      userId: user2.id,
      prediction: {
        scores: [3, 0],
        scorers: ['Di María', 'Lautaro', 'Messi'],
      },
    },
  });

  console.log('Pronósticos creados:', { pronostic1, pronostic2, pronostic3 });

  console.log('Seeding completado exitosamente!');
}

main()
  .catch((e) => {
    console.error('Error durante el seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 