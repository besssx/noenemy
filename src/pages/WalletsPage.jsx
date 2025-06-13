import React, { useState, useEffect } from 'react';

function WalletsPage() {
  const [wallets, setWallets] = useState([]);
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletKey, setNewWalletKey] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Функция для загрузки и обновления списка кошельков
  const loadWallets = async () => {
    setIsLoading(true);
    try {
      const walletsWithBalances = await window.electronAPI.invoke('get-wallets');
      setWallets(walletsWithBalances);
    } catch (error) {
      setMessage(`Ошибка загрузки кошельков: ${error.message}`);
    }
    setIsLoading(false);
  };

  // Загружаем кошельки один раз при загрузке страницы
  useEffect(() => {
    loadWallets();
  }, []);

  const handleAddWallet = async () => {
    if (!newWalletName || !newWalletKey) {
      setMessage('Ошибка: Имя и приватный ключ не могут быть пустыми.');
      return;
    }
    setMessage('Добавляем кошелек...');
    const result = await window.electronAPI.invoke('add-wallet', newWalletName, newWalletKey);
    
    if (result.success) {
      setMessage('Кошелек успешно добавлен! Обновляем балансы...');
      setNewWalletName('');
      setNewWalletKey('');
      await loadWallets(); // Обновляем список кошельков с балансами
      setMessage('Готово.');
    } else {
      setMessage(`Ошибка: ${result.message}`);
    }
  };
  
  const handleDeleteWallet = async (address) => {
    setMessage(`Удаляем кошелек ${address.substring(0, 6)}...`);
    await window.electronAPI.invoke('delete-wallet', address);
    await loadWallets(); // Обновляем список
    setMessage('Кошелек удален.');
  };


  return (
    <div>
      <h1>Управление кошельками</h1>
      
      <div className="card" style={{ maxWidth: '800px' }}>
        <h2>Добавить новый кошелек</h2>
        <div className="input-group">
          <label>Имя кошелька (для себя)</label>
          <input type="text" value={newWalletName} onChange={(e) => setNewWalletName(e.target.value)} placeholder="Например, 'Мой главный'" />
        </div>
        <div className="input-group">
          <label>Приватный ключ</label>
          <input type="password" value={newWalletKey} onChange={(e) => setNewWalletKey(e.target.value)} placeholder="0x..." />
        </div>
        <button onClick={handleAddWallet}>Добавить кошелек</button>
        {message && <p style={{color: 'lightgreen'}}>{message}</p>}
      </div>

      <div className="card" style={{ maxWidth: '800px', marginTop: '20px' }}>
        <h2>Сохраненные кошельки</h2>
        <button onClick={loadWallets} disabled={isLoading}>
          {isLoading ? 'Обновление...' : 'Обновить балансы'}
        </button>
        <table className="wallets-table">
          <thead>
            <tr>
              <th>Имя</th>
              <th>Адрес</th>
              <th>ETH Баланс</th>
              <th>WETH Баланс</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {wallets.map(wallet => (
              <tr key={wallet.address}>
                <td>{wallet.name}</td>
                <td>{wallet.address}</td>
                <td>{wallet.ethBalance}</td>
                <td>{wallet.wethBalance}</td>
                <td><button onClick={() => handleDeleteWallet(wallet.address)} className="button-danger">Удалить</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default WalletsPage;