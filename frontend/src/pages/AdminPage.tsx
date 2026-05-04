import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { OrderUser } from './OrderPage';

interface FuelPrice {
  fuelType: string;
  price: number;
}

interface OrderRow {
  id: number;
  status: string;
  fuelType: string;
  quantity: number;
  totalPrice: number;
  deliveryAddress: string;
  createdAt: string;
  user?: { firstName: string; telegramId: string };
}

const AdminPage: React.FC<{ user: OrderUser | null }> = ({ user }) => {
  const [prices, setPrices] = useState<FuelPrice[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});

  const load = async () => {
    const [p, o] = await Promise.all([
      api.get<FuelPrice[]>('/api/fuel-prices'),
      api.get<OrderRow[]>('/api/admin/orders'),
    ]);
    setPrices(p.data);
    setOrders(o.data);
    const next: Record<string, string> = {};
    p.data.forEach((row) => {
      next[row.fuelType] = String(row.price);
    });
    setEdits(next);
  };

  useEffect(() => {
    void load().catch((e) => console.error(e));
  }, []);

  const savePrice = async (fuelType: string) => {
    const price = Number(edits[fuelType]);
    if (Number.isNaN(price)) return;
    await api.put(`/api/admin/fuel-prices/${fuelType}`, { price });
    await load();
  };

  if (!user) {
    return <div className="loading">Нет пользователя</div>;
  }

  return (
    <div className="admin-page">
      <header className="header">
        <h1>Админ</h1>
        <div className="balance">{user.first_name}</div>
      </header>

      <section className="order-form">
        <h3>Цены</h3>
        {prices.map((p) => (
          <div key={p.fuelType} className="admin-row">
            <span>{p.fuelType}</span>
            <input
              value={edits[p.fuelType] ?? ''}
              onChange={(e) => setEdits((s) => ({ ...s, [p.fuelType]: e.target.value }))}
            />
            <button type="button" onClick={() => void savePrice(p.fuelType)}>
              Сохранить
            </button>
          </div>
        ))}
      </section>

      <section className="order-form">
        <h3>Заказы</h3>
        <div className="admin-orders">
          {orders.map((o) => (
            <div key={o.id} className="admin-order-card">
              <div>
                <strong>#{o.id}</strong> {o.status}
              </div>
              <div>
                {o.fuelType} · {o.quantity} л · {o.totalPrice} руб
              </div>
              <div className="muted">{o.deliveryAddress}</div>
              <div className="muted">
                {o.user?.firstName} ({o.user?.telegramId})
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AdminPage;
