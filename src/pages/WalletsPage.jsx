import React, { useState, useEffect } from 'react';

function WalletsPage() {
  const [wallets, setWallets] = useState([]);
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletKey, setNewWalletKey] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadWallets = async () => {
    setIsLoading(true);
    try {
      const walletsWithBalances = await window.electronAPI.invoke('get-wallets');
      setWallets(walletsWithBalances);
    } catch (error) {
      setMessage(`Error loading wallets: ${error.message}`);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadWallets();
  }, []);

  const handleAddWallet = async () => {
    if (!newWalletName || !newWalletKey) {
      setMessage('Error: Name and private key cannot be empty.');
      return;
    }
    setMessage('Adding wallet...');
    const result = await window.electronAPI.invoke('add-wallet', newWalletName, newWalletKey);
    
    if (result.success) {
      setMessage('Wallet added successfully! Refreshing balances...');
      setNewWalletName('');
      setNewWalletKey('');
      await loadWallets();
      setMessage('Done.');
    } else {
      setMessage(`Error: ${result.message}`);
    }
  };
  
  const handleDeleteWallet = async (address) => {
    setMessage(`Deleting wallet ${address.substring(0, 6)}...`);
    await window.electronAPI.invoke('delete-wallet', address);
    await loadWallets();
    setMessage('Wallet deleted.');
  };


  return (
    <div>
      <h1>Wallet Management</h1>
      
      <div className="card" style={{ maxWidth: '800px' }}>
        <h2>Add New Wallet</h2>
        <div className="input-group">
          <label>Wallet Name (for you)</label>
          <input type="text" value={newWalletName} onChange={(e) => setNewWalletName(e.target.value)} placeholder="e.g., 'My Main Wallet'" />
        </div>
        <div className="input-group">
          <label>Private Key</label>
          <input type="password" value={newWalletKey} onChange={(e) => setNewWalletKey(e.target.value)} placeholder="0x..." />
        </div>
        <button onClick={handleAddWallet}>Add Wallet</button>
        {message && <p style={{color: 'lightgreen'}}>{message}</p>}
      </div>

      <div className="card" style={{ maxWidth: '800px', marginTop: '20px' }}>
        <h2>Saved Wallets</h2>
        <button onClick={loadWallets} disabled={isLoading}>
          {isLoading ? 'Refreshing...' : 'Refresh Balances'}
        </button>
        <table className="wallets-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Address</th>
              <th>ETH Balance</th>
              <th>WETH Balance</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {wallets.map(wallet => (
              <tr key={wallet.address}>
                <td>{wallet.name}</td>
                <td>{wallet.address}</td>
                <td>{wallet.ethBalance}</td>
                <td>{wallet.wethBalance}</td>
                <td><button onClick={() => handleDeleteWallet(wallet.address)} className="button-danger">Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default WalletsPage;