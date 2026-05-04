import { createHmac } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export type TelegramWebAppUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

declare global {
  namespace Express {
    interface Request {
      telegramInitData?: string;
      telegramUser?: TelegramWebAppUser;
    }
  }
}

function parseInitData(initData: string): Record<string, string> {
  const params = new URLSearchParams(initData);
  const out: Record<string, string> = {};
  for (const [k, v] of params.entries()) {
    out[k] = v;
  }
  return out;
}

function verifyTelegramWebAppData(initData: string, botToken: string): boolean {
  const params = parseInitData(initData);
  const hash = params.hash;
  if (!hash) return false;
  const pairs = Object.entries(params)
    .filter(([k]) => k !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`);
  const dataCheckString = pairs.join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computed = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  return computed === hash;
}

function extractInitData(req: Request): string | undefined {
  const auth = req.headers.authorization;
  if (auth?.startsWith('tma ')) {
    return auth.slice(4).trim();
  }
  const header = req.headers['x-telegram-init-data'];
  if (typeof header === 'string' && header.length > 0) {
    return header;
  }
  return undefined;
}

export function validateWebAppData(req: Request, res: Response, next: NextFunction) {
  if (process.env.SKIP_WEBAPP_AUTH === '1' && process.env.NODE_ENV !== 'production') {
    const devId = process.env.DEV_TELEGRAM_ID;
    if (!devId) {
      return res.status(500).json({
        error: 'Задайте DEV_TELEGRAM_ID при SKIP_WEBAPP_AUTH=1',
      });
    }
    req.telegramUser = {
      id: Number(devId),
      first_name: 'Dev',
    };
    return next();
  }

  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    return res.status(500).json({ error: 'BOT_TOKEN не настроен' });
  }

  const initData = extractInitData(req);
  if (!initData) {
    return res.status(401).json({ error: 'Требуется Telegram WebApp initData' });
  }

  if (!verifyTelegramWebAppData(initData, botToken)) {
    return res.status(401).json({ error: 'Недействительные данные WebApp' });
  }

  const params = parseInitData(initData);
  const userJson = params.user;
  if (!userJson) {
    return res.status(401).json({ error: 'В initData нет user' });
  }

  try {
    req.telegramInitData = initData;
    req.telegramUser = JSON.parse(userJson) as TelegramWebAppUser;
    return next();
  } catch {
    return res.status(401).json({ error: 'Некорректный user в initData' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const ids = (process.env.ADMIN_TELEGRAM_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const uid = req.telegramUser?.id;
  if (uid == null || !ids.includes(String(uid))) {
    return res.status(403).json({ error: 'Недостаточно прав' });
  }
  return next();
}
