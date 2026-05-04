import { PrismaClient, FuelType } from '@prisma/client';

const prisma = new PrismaClient();

const DEV_TELEGRAM_ID = '123456789';

async function main() {
  const devUser = await prisma.user.upsert({
    where: { telegramId: DEV_TELEGRAM_ID },
    update: { firstName: 'Локальный', lastName: 'Тест' },
    create: {
      telegramId: DEV_TELEGRAM_ID,
      firstName: 'Локальный',
      lastName: 'Тест',
      loyaltyPoints: 500,
    },
  });

  const defaults: { fuelType: FuelType; price: number }[] = [
    { fuelType: 'DIESEL', price: 72 },
    { fuelType: 'AI95', price: 58 },
    { fuelType: 'AI92', price: 54 },
  ];

  for (const row of defaults) {
    await prisma.fuelPrice.upsert({
      where: { fuelType: row.fuelType },
      update: { price: row.price, updatedBy: devUser.id },
      create: { fuelType: row.fuelType, price: row.price, updatedBy: devUser.id },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
