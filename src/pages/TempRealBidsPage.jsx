import React, { useState, useEffect, useCallback } from 'react';

// Вспомогательная функция для форматирования времени
const formatExpiration = (timestamp) => {
  if (!timestamp) return 'N/A';
  const now = new Date();
  const endDate = new Date(timestamp * 1000);
  const diffTime = endDate - now;
  if (diffTime <= 0) return "Истекла";

  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
  const diffMinutes = Math.ceil(diffTime / (1000 * 60));

  if (diffDays > 1) return `через ${diffDays} д.`;
  if (diffHours > 1) return `через ${diffHours} ч.`;
  return `через ${diffMinutes} мин.`;
};

function TempRealBidsPage() {
  const [bids, setBids] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("Ожидание...");

  const loadBids = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    setStatus("Загрузка ставок...");
    try {
      const fetchedBids = await window.electronAPI.invoke('get-temp-bids');
      if (fetchedBids) {
        setBids(fetchedBids.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        setStatus(`Загружено ${fetchedBids.length} ставок.`);
      }
    } catch (error) {
      console.error("Error loading temp bids:", error);
      setStatus(`Ошибка загрузки: ${error.message}`);
    }
    setIsLoading(false);
  }, [isLoading]);

  useEffect(() => {
    loadBids();
  }, []); // Пустой массив, чтобы запускалось один раз

  return (
    <div>
      <h1>Мониторинг реальных ставок</h1>
      <p>Отображение активных ставок с кошелька `0x047...`</p>
      
      <div className="card" style={{ maxWidth: '1200px', marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Активные ставки <span style={{fontSize: '0.7em', color: '#ccc'}}>({status})</span></h2>
          <button onClick={loadBids} disabled={isLoading}>
            {isLoading ? 'Обновление...' : 'Обновить'}
          </button>
        </div>
        <table className="wallets-table">
          <thead>
            <tr>
              <th>Токен</th>
              <th>Наша ставка (WETH)</th>
              <th>Окончание</th>
            </tr>
          </thead>
          <tbody>
            {bids.map(bid => (
              <tr key={bid.id}>
                <td>
                  <a 
                    href={`https://opensea.io/assets/mainnet/${bid.contractAddress}/${bid.tokenId}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    #{bid.tokenId}
                  </a>
                </td>
                <td>{bid.bidPrice}</td>
                <td>{formatExpiration(bid.expiration)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TempRealBidsPage;