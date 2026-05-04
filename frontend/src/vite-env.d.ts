/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Продакшен: URL бэкенда без слэша в конце, например https://api-xx.up.railway.app */
  readonly VITE_API_URL: string;
  readonly VITE_ADMIN_IDS: string;
  readonly VITE_YANDEX_MAPS_API_KEY: string;
  readonly VITE_DEV_API: string;
  readonly VITE_DEV_MOCK_USER: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
