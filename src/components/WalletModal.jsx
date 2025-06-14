import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';

function WalletModal({ isOpen, onRequestClose }) {
  const [wallets, setWallets] = useState([]);
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletKey, setNewWalletKey] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadWallets = async () => {
    setIsLoading(true);
    const walletsWithBalances = await window.electronAPI.invoke('get-wallets');
    setWallets(walletsWithBalances);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadWallets();
    }
  }, [isOpen]);

  const handleAddWallet = async () => {
    if (!newWalletName || !newWalletKey) {
      setMessage('Ошибка: Имя и приватный ключ не могут быть пустыми.');
      return;
    }
    setMessage('Добавляем кошелек...');
    const result = await window.electronAPI.invoke('add-wallet', newWalletName, newWalletKey);
    if (result.success) {
      setNewWalletName('');
      setNewWalletKey('');
      await loadWallets();
      setMessage('Кошелек успешно добавлен!');
    } else {
      setMessage(`Ошибка: ${result.message}`);
    }
  };
  
  const handleDeleteWallet = async (address) => {
    await window.electronAPI.invoke('delete-wallet', address);
    await loadWallets();
    setMessage('Кошелек удален.');
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      className="modal"
      overlayClassName="overlay"
      contentLabel="Wallet Manager"
    >
      <h1>Управление кошельками</h1>
      <button onClick={onRequestClose} className="close-button">X</button>
      
      <div className="card">
        <h2>Добавить новый кошелек</h2>
        <div className="input-group">
          <label>Имя кошелька</label>
          <input type="text" value={newWalletName} onChange={(e) => setNewWalletName(e.target.value)} placeholder="Например, 'Мой главный'" />
        </div>
        <div className="input-group">
          <label>Приватный ключ</label>
          <input type="password" value={newWalletKey} onChange={(e) => setNewWalletKey(e.target.value)} placeholder="0x..." />
        </div>
        <button onClick={handleAddWallet}>Добавить</button>
        {message && <p>{message}</p>}
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <h2>Сохраненные кошельки</h2>
        <button onClick={loadWallets} disabled={isLoading}>
          {isLoading ? 'Обновление...' : 'Обновить балансы'}
        </button>
        <table className="wallets-table">
          <thead>
            <tr>
              <th>Имя</th>
              <th>Адрес</th>
              <th>ETH</th>
              <th>WETH</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {wallets.map(wallet => (
              <tr key={wallet.address}>
                <td>{wallet.name}</td>
                <td><a href={`https://basescan.org/address/${wallet.address}`} target="_blank" rel="noopener noreferrer">{wallet.address.substring(0, 6)}...{wallet.address.substring(wallet.address.length - 4)}</a></td>
                <td>{wallet.ethBalance}</td>
                <td>{wallet.wethBalance}</td>
                <td><button onClick={() => handleDeleteWallet(wallet.address)} className="button-danger">Удалить</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

export default WalletModal;