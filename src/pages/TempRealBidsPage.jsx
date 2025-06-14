import React, { useState, useEffect, useCallback } from 'react';

// Вспомогательная функция для форматирования времени
const formatExpiration = (timestamp) => {
  const now = new Date();
  const endDate = new Date(timestamp * 1000);
  const diffTime = endDate - now;
  if (diffTime <= 0) return "Expired";

  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
  const diffMinutes = Math.ceil(diffTime / (1000 * 60));

  if (diffDays > 1) return `in ${diffDays} days`;
  if (diffHours > 1) return `in ${diffHours} hours`;
  return `in ${diffMinutes} minutes`;
};

function TempRealBidsPage() {
  const [bids, setBids] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("Ожидание...");

  const loadBids = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    setStatus("Загрузка и обогащение данных...");
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
  }, []);

  const getStatusComponent = (bid) => {
    if (bid.bidPrice >= parseFloat(bid.topBid)) {
      return <span style={{ color: 'lightgreen', fontWeight: 'bold' }}>Top Bid</span>;
    }
    return <span style={{ color: 'lightcoral', fontWeight: 'bold' }}>Outbid</span>;
  };

  return (
    <div>
      <h1>Мониторинг реальных ставок</h1>
      <p>Отображение и фоновое отслеживание активных ставок с кошелька `0x047...`</p>
      
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
              <th>Коллекция</th>
              <th>Токен</th>
              <th>Floor (WETH)</th>
              <th>Наша ставка (WETH)</th>
              <th>Топ ставка (WETH)</th>
              <th>Окончание</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {bids.map(bid => (
              <tr key={bid.id}>
                <td>{bid.collectionSlug}</td>
                <td>
                  <a 
                    href={`https://opensea.io/assets/${bid.chain}/${bid.contractAddress}/${bid.tokenId}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    #{bid.tokenId}
                  </a>
                </td>
                <td>{bid.floorPrice}</td>
                <td>{bid.bidPrice}</td>
                <td>{bid.topBid}</td>
                <td>{formatExpiration(bid.expiration)}</td>
                <td>{getStatusComponent(bid)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TempRealBidsPage;