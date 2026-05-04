import axios from 'axios';
import { retrieveLaunchParams } from '@telegram-apps/sdk';

export function getInitDataRaw(): string {
  if (typeof window === 'undefined') return '';

  const tg = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp
    ?.initData;
  if (tg) return tg;

  try {
    const lp = retrieveLaunchParams() as { initDataRaw?: string };
    if (lp.initDataRaw) return lp.initDataRaw;
  } catch {
    /* вне Telegram Mini App */
  }

  return '';
}

const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export const api = axios.create({
  baseURL: apiBase || '/',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const raw = getInitDataRaw();
  if (raw) {
    config.headers.Authorization = `tma ${raw}`;
  }
  return config;
});
