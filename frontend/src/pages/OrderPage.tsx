import React, { useState, useEffect, useMemo } from 'react';
import { YMaps, Map, Placemark } from 'react-yandex-maps';
import DatePicker from 'react-datepicker';
import { api } from '../api/client';
import 'react-datepicker/dist/react-datepicker.css';

export interface OrderUser {
  id: number;
  username?: string;
  first_name: string;
}

interface FuelPrice {
  fuelType: string;
  price: number;
}

const TYUMEN: [number, number] = [57.1522, 65.5272];

const OrderPage: React.FC<{ user: OrderUser | null }> = ({ user }) => {
  const [fuelType, setFuelType] = useState('AI95');
  const [quantity, setQuantity] = useState(20);
  const [deliveryTime, setDeliveryTime] = useState(new Date());
  const [address, setAddress] = useState('');
  const [coordinates, setCoordinates] = useState<[number, number]>(TYUMEN);
  const [prices, setPrices] = useState<FuelPrice[]>([]);
  const [userBalance, setUserBalance] = useState(0);
  const [pointsToUse, setPointsToUse] = useState(0);

  const mapKey = import.meta.env.VITE_YANDEX_MAPS_API_KEY;

  const priceFor = (type: string) => prices.find((p) => p.fuelType === type)?.price ?? 0;

  const currentPrice = useMemo(() => priceFor(fuelType), [fuelType, prices]);

  const maxPoints = useMemo(
    () => Math.min(userBalance, Math.max(0, quantity * currentPrice + 200)),
    [userBalance, quantity, currentPrice]
  );

  const effectivePoints = Math.min(pointsToUse, maxPoints);

  useEffect(() => {
    void loadFuelPrices();
  }, []);

  useEffect(() => {
    if (user) void loadUserData();
  }, [user]);

  useEffect(() => {
    setPointsToUse((p) => Math.min(p, maxPoints));
  }, [maxPoints]);

  const loadFuelPrices = async () => {
    try {
      const response = await api.get<FuelPrice[]>('/api/fuel-prices');
      setPrices(response.data);
    } catch (e) {
      console.error('Ошибка загрузки цен:', e);
    }
  };

  const loadUserData = async () => {
    if (!user) return;
    try {
      const response = await api.get(`/api/user/${user.id}`);
      const pts = (response.data as { loyaltyPoints?: number } | null)?.loyaltyPoints ?? 0;
      setUserBalance(pts);
    } catch (e) {
      console.error('Ошибка загрузки данных пользователя:', e);
    }
  };

  const calculateTotal = () => {
    const subtotal = quantity * currentPrice;
    const deliveryFee = 200;
    return Math.max(0, subtotal + deliveryFee - effectivePoints);
  };

  const handleMapClick = (e: { get: (k: string) => [number, number] }) => {
    const coords = e.get('coords');
    setCoordinates(coords);
  };

  const submitOrder = async () => {
    if (!user) return;
    try {
      const orderData = {
        telegramId: String(user.id),
        fuelType,
        quantity,
        deliveryAddress: address,
        deliveryLat: coordinates[0],
        deliveryLng: coordinates[1],
        deliveryTime: deliveryTime.toISOString(),
        pointsUsed: effectivePoints,
      };

      await api.post('/api/orders', orderData);
      alert('Заказ успешно создан!');
      setPointsToUse(0);
      await loadUserData();
    } catch (e) {
      console.error('Ошибка создания заказа:', e);
      alert('Ошибка создания заказа');
    }
  };

  if (!user) {
    return (
      <div className="loading">
        Загрузка… Откройте приложение из Telegram или задайте VITE_DEV_MOCK_USER для локальной разработки.
      </div>
    );
  }

  return (
    <div className="order-page">
      <header className="header">
        <h1>🛢 Топливо Тюмени</h1>
        <div className="balance">💰 Баланс: {userBalance} баллов</div>
      </header>

      <div className="order-form">
        <div className="fuel-selector">
          <h3>Выберите тип топлива:</h3>
          <div className="fuel-buttons">
            {(['DIESEL', 'AI95', 'AI92'] as const).map((type) => (
              <button
                key={type}
                type="button"
                className={`fuel-btn ${fuelType === type ? 'active' : ''}`}
                onClick={() => setFuelType(type)}
              >
                {type === 'DIESEL' ? '⚫ Дизель' : type === 'AI95' ? '🔵 АИ-95' : '🟢 АИ-92'}
                <div className="price">{priceFor(type)} руб/л</div>
              </button>
            ))}
          </div>
        </div>

        <div className="quantity-selector">
          <h3>Количество литров:</h3>
          <div className="quantity-controls">
            <button type="button" onClick={() => setQuantity(Math.max(10, quantity - 10))}>
              -10
            </button>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              min={10}
              max={1000}
            />
            <button type="button" onClick={() => setQuantity(quantity + 10)}>
              +10
            </button>
          </div>
        </div>

        <div className="map-section">
          <h3>Место доставки:</h3>
          <input
            type="text"
            placeholder="Введите адрес"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="address-input"
          />
          {!mapKey ? (
            <div className="map-placeholder">Укажите VITE_YANDEX_MAPS_API_KEY для карты</div>
          ) : (
            <YMaps query={{ apikey: mapKey, lang: 'ru_RU' }}>
              <Map
                defaultState={{
                  center: coordinates,
                  zoom: 12,
                }}
                state={{ center: coordinates, zoom: 12 }}
                onClick={handleMapClick}
                width="100%"
                height="300px"
              >
                <Placemark geometry={coordinates} />
              </Map>
            </YMaps>
          )}
        </div>

        <div className="datetime-selector">
          <h3>Время доставки:</h3>
          <DatePicker
            selected={deliveryTime}
            onChange={(d) => d && setDeliveryTime(d)}
            showTimeSelect
            timeFormat="HH:mm"
            timeIntervals={30}
            dateFormat="dd.MM.yyyy HH:mm"
            minDate={new Date()}
          />
        </div>

        <div className="loyalty-points">
          <h3>Использовать баллы:</h3>
          <input
            type="range"
            min={0}
            max={maxPoints}
            value={effectivePoints}
            onChange={(e) => setPointsToUse(Number(e.target.value))}
          />
          <div>
            Использовать: {effectivePoints} баллов (-{effectivePoints} руб)
          </div>
        </div>

        <div className="order-summary">
          <h3>Итого:</h3>
          <div>
            Топливо: {quantity}л × {currentPrice} руб = {quantity * currentPrice} руб
          </div>
          <div>Доставка: 200 руб</div>
          <div>Скидка баллами: -{effectivePoints} руб</div>
          <div className="total">К оплате: {calculateTotal()} руб</div>
          <div className="points-earn">Вы получите: {Math.floor(quantity)} баллов</div>
        </div>

        <button
          type="button"
          className="submit-btn"
          onClick={() => void submitOrder()}
          disabled={!address || calculateTotal() < 0}
        >
          🚛 Заказать доставку
        </button>
      </div>
    </div>
  );
};

export default OrderPage;
