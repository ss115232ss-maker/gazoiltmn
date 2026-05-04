import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { requireAdmin } from '../middleware/auth';

export function createApiRoutes(prisma: PrismaClient) {
  const router = Router();

  router.get('/user/:telegramId', async (req, res) => {
    try {
      const paramId = req.params.telegramId;
      if (req.telegramUser && String(req.telegramUser.id) !== paramId) {
        return res.status(403).json({ error: 'Доступ только к своему профилю' });
      }

      const user = await prisma.user.findUnique({
        where: { telegramId: paramId },
        include: { orders: true },
      });
      res.json(user);
    } catch {
      res.status(500).json({ error: 'Ошибка получения данных пользователя' });
    }
  });

  router.get('/fuel-prices', async (_req, res) => {
    try {
      const prices = await prisma.fuelPrice.findMany();
      res.json(prices);
    } catch {
      res.status(500).json({ error: 'Ошибка получения цен' });
    }
  });

  router.post('/orders', async (req, res) => {
    try {
      const {
        telegramId,
        fuelType,
        quantity,
        deliveryAddress,
        deliveryLat,
        deliveryLng,
        deliveryTime,
        pointsUsed,
      } = req.body;

      if (req.telegramUser && String(req.telegramUser.id) !== String(telegramId)) {
        return res.status(403).json({ error: 'Несовпадение пользователя' });
      }

      const user = await prisma.user.findUnique({
        where: { telegramId: String(telegramId) },
      });

      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      const fuelPrice = await prisma.fuelPrice.findUnique({
        where: { fuelType },
      });

      if (!fuelPrice) {
        return res.status(404).json({ error: 'Цена на топливо не найдена' });
      }

      const pts = Number(pointsUsed) || 0;
      if (pts < 0 || pts > user.loyaltyPoints) {
        return res.status(400).json({ error: 'Некорректное количество баллов' });
      }

      const subtotal = quantity * fuelPrice.price;
      const deliveryFee = 200;
      const totalPrice = Math.max(0, subtotal + deliveryFee - pts);
      const pointsEarned = Math.floor(quantity);

      const order = await prisma.order.create({
        data: {
          userId: user.id,
          fuelType,
          quantity,
          pricePerLiter: fuelPrice.price,
          totalPrice,
          deliveryFee,
          pointsUsed: pts,
          pointsEarned,
          deliveryAddress,
          deliveryLat,
          deliveryLng,
          deliveryTime: new Date(deliveryTime),
        },
      });

      await prisma.user.update({
        where: { id: user.id },
        data: {
          loyaltyPoints: user.loyaltyPoints - pts + pointsEarned,
        },
      });

      res.json(order);
    } catch {
      res.status(500).json({ error: 'Ошибка создания заказа' });
    }
  });

  router.put('/admin/fuel-prices/:fuelType', requireAdmin, async (req, res) => {
    try {
      const { price } = req.body;
      const { fuelType } = req.params;
      const adminUser = await prisma.user.findUnique({
        where: { telegramId: String(req.telegramUser!.id) },
      });
      const updatedBy = adminUser?.id ?? 1;

      const updatedPrice = await prisma.fuelPrice.upsert({
        where: { fuelType: fuelType as 'DIESEL' | 'AI95' | 'AI92' },
        update: { price: Number(price) },
        create: {
          fuelType: fuelType as 'DIESEL' | 'AI95' | 'AI92',
          price: Number(price),
          updatedBy,
        },
      });

      res.json(updatedPrice);
    } catch {
      res.status(500).json({ error: 'Ошибка обновления цены' });
    }
  });

  router.get('/admin/orders', requireAdmin, async (_req, res) => {
    try {
      const orders = await prisma.order.findMany({
        include: { user: true },
        orderBy: { createdAt: 'desc' },
      });
      res.json(orders);
    } catch {
      res.status(500).json({ error: 'Ошибка получения заказов' });
    }
  });

  return router;
}
