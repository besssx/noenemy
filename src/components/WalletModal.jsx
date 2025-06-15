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
      setMessage('Error: Name and private key cannot be empty.');
      return;
    }
    setMessage('Adding wallet...');
    const result = await window.electronAPI.invoke('add-wallet', newWalletName, newWalletKey);
    if (result.success) {
      setNewWalletName('');
      setNewWalletKey('');
      await loadWallets();
      setMessage('Wallet added successfully!');
    } else {
      setMessage(`Error: ${result.message}`);
    }
  };
  
  const handleDeleteWallet = async (address) => {
    await window.electronAPI.invoke('delete-wallet', address);
    await loadWallets();
    setMessage('Wallet deleted.');
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      className="modal"
      overlayClassName="overlay"
      contentLabel="Wallet Manager"
    >
      <h1>Wallet Management</h1>
      <button onClick={onRequestClose} className="close-button">X</button>
      
      <div className="card">
        <h2>Add New Wallet</h2>
        <div className="input-group">
          <label>Wallet Name</label>
          <input type="text" value={newWalletName} onChange={(e) => setNewWalletName(e.target.value)} placeholder="e.g., 'My Main Wallet'" />
        </div>
        <div className="input-group">
          <label>Private Key</label>
          <input type="password" value={newWalletKey} onChange={(e) => setNewWalletKey(e.target.value)} placeholder="0x..." />
        </div>
        <button onClick={handleAddWallet}>Add</button>
        {message && <p>{message}</p>}
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <h2>Saved Wallets</h2>
        <button onClick={loadWallets} disabled={isLoading}>
          {isLoading ? 'Refreshing...' : 'Refresh Balances'}
        </button>
        <table className="wallets-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Address</th>
              <th>ETH</th>
              <th>WETH</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {wallets.map(wallet => (
              <tr key={wallet.address}>
                <td>{wallet.name}</td>
                <td><a href={`https://basescan.org/address/${wallet.address}`} target="_blank" rel="noopener noreferrer">{wallet.address.substring(0, 6)}...{wallet.address.substring(wallet.address.length - 4)}</a></td>
                <td>{wallet.ethBalance}</td>
                <td>{wallet.wethBalance}</td>
                <td><button onClick={() => handleDeleteWallet(wallet.address)} className="button-danger">Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

export default WalletModal;