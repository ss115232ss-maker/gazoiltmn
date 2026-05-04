import TelegramBot from 'node-telegram-bot-api';
import type { PrismaClient } from '@prisma/client';

function getFuelName(fuelType: string): string {
  switch (fuelType) {
    case 'DIESEL':
      return '⚫ Дизель';
    case 'AI95':
      return '🔵 АИ-95';
    case 'AI92':
      return '🟢 АИ-92';
    default:
      return fuelType;
  }
}

async function getUserFromMessage(
  msg: { from?: TelegramBot.User },
  client: PrismaClient
) {
  if (!msg.from) return null;
  return client.user.findUnique({
    where: { telegramId: msg.from.id.toString() },
  });
}

export function setupBot(bot: TelegramBot, client: PrismaClient) {
  const webhookBase = process.env.WEBHOOK_URL;
  if (webhookBase) {
    void bot.setWebHook(`${webhookBase.replace(/\/$/, '')}/webhook`);
  }

  void bot.setMyCommands([
    { command: 'start', description: 'Начать работу с ботом' },
    { command: 'order', description: 'Заказать топливо' },
    { command: 'balance', description: 'Баланс бонусных баллов' },
    { command: 'prices', description: 'Актуальные цены на топливо' },
    { command: 'support', description: 'Связаться с поддержкой' },
  ]);

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    if (!user) return;

    await client.user.upsert({
      where: { telegramId: user.id.toString() },
      update: {
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
      },
      create: {
        telegramId: user.id.toString(),
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name || '',
      },
    });

    const miniUrl = process.env.MINI_APP_URL;
    const keyboard: TelegramBot.InlineKeyboardMarkup = {
      inline_keyboard: [
        ...(miniUrl
          ? [[{ text: '🚛 Заказать топливо', web_app: { url: miniUrl } } as const]]
          : []),
        [{ text: '💰 Мой баланс', callback_data: 'balance' }],
        [{ text: '💲 Цены на топливо', callback_data: 'prices' }],
      ],
    };

    await bot.sendMessage(
      chatId,
      `🛢 Добро пожаловать в Топливо Тюмени!\n\n` +
        `Заказывайте доставку топлива прямо в Telegram:\n` +
        `• Дизель, АИ-95, АИ-92\n` +
        `• Доставка по Тюмени и области\n` +
        `• Система лояльности: 1 литр = 1 балл = 1 рубль\n\n` +
        `${miniUrl ? 'Нажмите "Заказать топливо" чтобы начать!' : 'Укажите MINI_APP_URL для кнопки Mini App.'}`,
      { reply_markup: keyboard }
    );
  });

  bot.onText(/\/balance/, async (msg) => {
    const u = await getUserFromMessage(msg, client);
    if (!u) {
      await bot.sendMessage(msg.chat.id, 'Сначала нажмите /start');
      return;
    }
    await bot.sendMessage(
      msg.chat.id,
      `💰 Ваш баланс: ${u.loyaltyPoints} баллов\n` +
        `Это равно ${u.loyaltyPoints} рублей скидки!`
    );
  });

  bot.onText(/\/prices/, async (msg) => {
    const prices = await client.fuelPrice.findMany();
    let priceText = '💲 Актуальные цены:\n\n';
    prices.forEach((price) => {
      priceText += `${getFuelName(price.fuelType)}: ${price.price} руб/л\n`;
    });
    priceText += '\n+ стоимость доставки';
    await bot.sendMessage(msg.chat.id, priceText);
  });

  bot.onText(/\/order|\/support/, async (msg) => {
    const miniUrl = process.env.MINI_APP_URL;
    if (miniUrl) {
      await bot.sendMessage(msg.chat.id, 'Откройте Mini App:', {
        reply_markup: {
          inline_keyboard: [[{ text: '🚛 Заказать', web_app: { url: miniUrl } }]],
        },
      });
    } else {
      await bot.sendMessage(msg.chat.id, 'Свяжитесь с поддержкой через оператора (MINI_APP_URL не задан).');
    }
  });

  bot.on('callback_query', async (query) => {
    const msg = query.message;
    if (!msg) return;

    if (query.data === 'balance') {
      const user = await getUserFromMessage(query.from, client);
      if (user) {
        await bot.answerCallbackQuery(query.id, {
          text: `Ваш баланс: ${user.loyaltyPoints} баллов`,
          show_alert: true,
        });
      } else {
        await bot.answerCallbackQuery(query.id, { text: 'Сначала /start' });
      }
      return;
    }

    if (query.data === 'prices') {
      const prices = await client.fuelPrice.findMany();
      let priceText = '';
      prices.forEach((price) => {
        priceText += `${getFuelName(price.fuelType)}: ${price.price} руб/л\n`;
      });
      await bot.answerCallbackQuery(query.id, {
        text: priceText || 'Цены не заданы',
        show_alert: true,
      });
    }
  });
}
