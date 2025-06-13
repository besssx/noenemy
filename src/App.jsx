import React, { useState, useEffect } from 'react';

function App() {
  const [floorPriceMessage, setFloorPriceMessage] = useState('');
  const [pollingStatus, setPollingStatus] = useState('Ожидание запуска...');
  const [events, setEvents] = useState([]);

  // ... функция getFloorPrice без изменений

  useEffect(() => {
    const cleanup = window.api.receive('from-main', (data) => {
      console.log('Сообщение от бэкенда:', data);
      
      switch (data.type) {
        case 'floor-price':
          setFloorPriceMessage(data.payload);
          break;
        case 'ws-status': // Мы переименовали ws-status в polling-status для ясности
          setPollingStatus(data.payload);
          break;
        case 'ws-event':
          // Структура данных из /orders/asks/v6 отличается
          const newEvent = {
            id: data.payload.id,
            price: data.payload.price.amount.native
          };
          setEvents(prevEvents => [newEvent, ...prevEvents].slice(0, 10));
          break;
        default:
          break;
      }
    });

    return cleanup;
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Проект noenemy</h1>
        
        {/* ... блок для ручного запроса без изменений */}

        {/* Блок для Polling */}
        <div style={{ border: '1px solid #555', padding: '10px', margin: '10px', borderRadius: '5px' }}>
          <h3>Статус: <span style={{ color: 'lightgreen' }}>{pollingStatus}</span></h3>
          <div style={{ textAlign: 'left', maxHeight: '300px', overflowY: 'auto', padding: '10px' }}>
            {events.length === 0 ? <p>Ожидание новых лотов...</p> : (
              <ul>
                {events.map((event, i) => (
                  <li key={i}>
                    Новый лот! ID ордера: {event.id}, Цена: {event.price} ETH
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </header>
    </div>
  );
}

export default App;