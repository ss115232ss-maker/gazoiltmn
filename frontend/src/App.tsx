import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Link } from 'react-router-dom';
import { init, retrieveLaunchParams } from '@telegram-apps/sdk';
import OrderPage from './pages/OrderPage';
import AdminPage from './pages/AdminPage';
import './App.css';

type TgUser = {
  id: number;
  username?: string;
  first_name: string;
};

function readUserFromEnv(): TgUser | null {
  const raw = import.meta.env.VITE_DEV_MOCK_USER;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TgUser;
  } catch {
    return null;
  }
}

function App() {
  const [user, setUser] = useState<TgUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    try {
      init();
    } catch {
      /* SDK вне Telegram */
    }

    const unsafe = (window as unknown as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: TgUser } } } })
      .Telegram?.WebApp?.initDataUnsafe?.user;
    if (unsafe) {
      setUser(unsafe);
      const adminIds = (import.meta.env.VITE_ADMIN_IDS || '').split(',').map((s) => s.trim());
      setIsAdmin(adminIds.includes(String(unsafe.id)));
      return;
    }

    try {
      const lp = retrieveLaunchParams() as { initData?: { user?: TgUser } };
      const u = lp.initData?.user;
      if (u) {
        setUser(u);
        const adminIds = (import.meta.env.VITE_ADMIN_IDS || '').split(',').map((s) => s.trim());
        setIsAdmin(adminIds.includes(String(u.id)));
        return;
      }
    } catch {
      /* retrieveLaunchParams недоступен */
    }

    const mock = readUserFromEnv();
    if (mock) {
      setUser(mock);
      const adminIds = (import.meta.env.VITE_ADMIN_IDS || '').split(',').map((s) => s.trim());
      setIsAdmin(adminIds.includes(String(mock.id)));
    }
  }, []);

  return (
    <HashRouter>
      <div className="app">
        {isAdmin && (
          <nav className="nav-admin">
            <Link to="/">Заказ</Link>
            <Link to="/admin">Админ</Link>
          </nav>
        )}
        <Routes>
          <Route path="/" element={<OrderPage user={user} />} />
          {isAdmin && <Route path="/admin" element={<AdminPage user={user} />} />}
        </Routes>
      </div>
    </HashRouter>
  );
}

export default App;
