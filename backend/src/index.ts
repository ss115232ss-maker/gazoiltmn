import path from 'path';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import { prisma } from './db';
import { setupBot } from './bot/bot';
import { createApiRoutes } from './api/routes';
import { validateWebAppData } from './middleware/auth';

dotenv.config();

const app = express();
const token = process.env.BOT_TOKEN;
const bot = token ? new TelegramBot(token, { polling: false }) : null;

app.use(cors());
app.use(express.json());

const frontendDist = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/webhook', (req, res) => {
  if (bot) {
    bot.processUpdate(req.body);
  }
  res.sendStatus(200);
});

app.use('/api', validateWebAppData);
app.use('/api', createApiRoutes(prisma));

if (bot) {
  setupBot(bot, prisma);
} else {
  console.warn('BOT_TOKEN не задан: обработка апдейтов бота отключена');
}

app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
