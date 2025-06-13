import React, { useState, useEffect } from 'react';

function TasksPage() {
  // Состояния для полей ввода
  const [contractAddress, setContractAddress] = useState('0xac52bf5b51a46e319a103c52a1c50e27c44d054e'); // Onchain Gaias on Base
  const [tokenId, setTokenId] = useState('');
  const [bidPrice, setBidPrice] = useState('');
  
  // Состояния для кошельков
  const [wallets, setWallets] = useState([]);
  const [selectedWallet, setSelectedWallet] = useState('');

  // Новое состояние для срока действия ставки
  const [expiration, setExpiration] = useState('1h');
  
  // Состояние для отображения статуса
  const [statusMessage, setStatusMessage] = useState('Ожидание новой задачи...');

  // Загружаем кошельки при монтировании компонента
  useEffect(() => {
    const loadWallets = async () => {
      const savedWallets = await window.electronAPI.invoke('get-wallets');
      setWallets(savedWallets);
      // Если кошельки есть, выбираем первый по умолчанию
      if (savedWallets.length > 0) {
        setSelectedWallet(savedWallets[0].address);
      }
    };
    loadWallets();
  }, []);

  // Устанавливаем слушателя для промежуточных статусов
  useEffect(() => {
    const removeListener = window.electronAPI.receive('bid-status-update', (message) => {
      setStatusMessage(message);
    });
    // Эта функция будет вызвана при уходе со страницы для очистки
    return removeListener;
  }, []);

  const handlePlaceBid = async () => {
    if (!selectedWallet) {
      setStatusMessage('Ошибка: Не выбран кошелек. Добавьте его на вкладке "Кошельки".');
      return;
    }
    if (!contractAddress || !tokenId || !bidPrice) {
      setStatusMessage('Ошибка: Заполните все поля для ставки.');
      return;
    }
    setStatusMessage('Отправка команды на бэкенд...');
    
    // Рассчитываем временную метку UNIX для срока истечения
    const now = Math.floor(Date.now() / 1000);
    let expirationTime;
    switch (expiration) {
      case '1m': expirationTime = now + 60; break;
      case '5m': expirationTime = now + 5 * 60; break;
      case '1h': expirationTime = now + 60 * 60; break;
      case '1d': expirationTime = now + 24 * 60 * 60; break;
      case '7d': expirationTime = now + 7 * 24 * 60 * 60; break;
      case '1mo': expirationTime = now + 30 * 24 * 60 * 60; break;
      default: expirationTime = now + 24 * 60 * 60; // По умолчанию 1 день
    }
    
    const result = await window.electronAPI.invoke('place-bid', {
      walletAddress: selectedWallet,
      contractAddress,
      tokenId,
      bidPrice,
      expirationTime: expirationTime.toString(), // Передаем на бэкенд
    });

    // Отображаем финальный статус из ответа
    if (result.success) {
      setStatusMessage(`УСПЕХ: ${result.message}`);
    } else {
      setStatusMessage(`ОШИБКА: ${result.message}`);
    }
  };

  return (
    <div>
      <h1>Задачи</h1>
      
      <div className="card" style={{ maxWidth: '600px' }}>
        <h2>Новая задача: Сделать ставку</h2>

        <div className="input-group">
          <label>Кошелек для ставки</label>
          <select value={selectedWallet} onChange={(e) => setSelectedWallet(e.target.value)}>
            {wallets.length > 0 ? (
              wallets.map(wallet => (
                <option key={wallet.address} value={wallet.address}>
                  {wallet.name} ({wallet.address.substring(0, 6)}...{wallet.address.substring(wallet.address.length - 4)})
                </option>
              ))
            ) : (
              <option disabled>Нет доступных кошельков</option>
            )}
          </select>
        </div>

        <div className="input-group">
          <label>Адрес контракта</label>
          <input 
            type="text" 
            placeholder="0x..."
            value={contractAddress}
            onChange={(e) => setContractAddress(e.target.value)}
          />
        </div>
        <div className="input-group">
          <label>ID Токена</label>
          <input 
            type="text" 
            placeholder="12345"
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
          />
        </div>
        <div className="input-group">
          <label>Цена ставки (WETH)</label>
          <input 
            type="text" 
            placeholder="0.001"
            value={bidPrice}
            onChange={(e) => setBidPrice(e.target.value)}
          />
        </div>

        <div className="input-group">
            <label>Срок действия ставки</label>
            <select value={expiration} onChange={(e) => setExpiration(e.target.value)}>
                <option value="1m">1 минута</option>
                <option value="5m">5 минут</option>
                <option value="1h">1 час</option>
                <option value="1d">1 день</option>
                <option value="7d">7 дней</option>
                <option value="1mo">1 месяц</option>
            </select>
        </div>

        <button onClick={handlePlaceBid} className="button-primary">Сделать ставку</button>
      </div>

      <div className="card" style={{ maxWidth: '600px', marginTop: '20px' }}>
        <h2>Статус выполнения</h2>
        <p style={{ color: 'lightgreen', wordBreak: 'break-word' }}>{statusMessage}</p>
      </div>
    </div>
  );
}

export default TasksPage;