import React, { useState, useEffect } from 'react';

function TasksPage() {
  const [contractAddress, setContractAddress] = useState('0xac52bf5b51a46e319a103c52a1c50e27c44d054e');
  const [tokenId, setTokenId] = useState('');
  const [bidPrice, setBidPrice] = useState('');
  const [wallets, setWallets] = useState([]);
  const [selectedWallet, setSelectedWallet] = useState('');
  const [expiration, setExpiration] = useState('1h');
  const [statusMessage, setStatusMessage] = useState('Waiting for a new task...');

  useEffect(() => {
    const loadWallets = async () => {
      const savedWallets = await window.electronAPI.invoke('get-wallets');
      setWallets(savedWallets);
      if (savedWallets.length > 0) {
        setSelectedWallet(savedWallets[0].address);
      }
    };
    loadWallets();
  }, []);

  useEffect(() => {
    const removeListener = window.electronAPI.receive('bid-status-update', (message) => {
      setStatusMessage(message);
    });
    return removeListener;
  }, []);

  const handlePlaceBid = async () => {
    if (!selectedWallet) {
      setStatusMessage("Error: No wallet selected. Please add one in the 'Wallets' tab.");
      return;
    }
    if (!contractAddress || !tokenId || !bidPrice) {
      setStatusMessage('Error: Please fill in all fields for the bid.');
      return;
    }
    setStatusMessage('Sending command to backend...');
    
    const now = Math.floor(Date.now() / 1000);
    let expirationTime;
    switch (expiration) {
      case '1m': expirationTime = now + 60; break;
      case '5m': expirationTime = now + 5 * 60; break;
      case '1h': expirationTime = now + 60 * 60; break;
      case '1d': expirationTime = now + 24 * 60 * 60; break;
      case '7d': expirationTime = now + 7 * 24 * 60 * 60; break;
      case '1mo': expirationTime = now + 30 * 24 * 60 * 60; break;
      default: expirationTime = now + 24 * 60 * 60;
    }
    
    const result = await window.electronAPI.invoke('place-bid', {
      walletAddress: selectedWallet,
      contractAddress,
      tokenId,
      bidPrice,
      expirationTime: expirationTime.toString(),
    });

    if (result.success) {
      setStatusMessage(`SUCCESS: ${result.message}`);
    } else {
      setStatusMessage(`ERROR: ${result.message}`);
    }
  };

  return (
    <div>
      <h1>Tasks</h1>
      
      <div className="card" style={{ maxWidth: '600px' }}>
        <h2>New Task: Place a Bid</h2>

        <div className="input-group">
          <label>Wallet for Bidding</label>
          <select value={selectedWallet} onChange={(e) => setSelectedWallet(e.target.value)}>
            {wallets.length > 0 ? (
              wallets.map(wallet => (
                <option key={wallet.address} value={wallet.address}>
                  {wallet.name} ({wallet.address.substring(0, 6)}...{wallet.address.substring(wallet.address.length - 4)})
                </option>
              ))
            ) : (
              <option disabled>No wallets available</option>
            )}
          </select>
        </div>

        <div className="input-group">
          <label>Contract Address</label>
          <input 
            type="text" 
            placeholder="0x..."
            value={contractAddress}
            onChange={(e) => setContractAddress(e.target.value)}
          />
        </div>
        <div className="input-group">
          <label>Token ID</label>
          <input 
            type="text" 
            placeholder="12345"
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
          />
        </div>
        <div className="input-group">
          <label>Bid Price (WETH)</label>
          <input 
            type="text" 
            placeholder="0.001"
            value={bidPrice}
            onChange={(e) => setBidPrice(e.target.value)}
          />
        </div>

        <div className="input-group">
            <label>Bid Expiration</label>
            <select value={expiration} onChange={(e) => setExpiration(e.target.value)}>
                <option value="1m">1 minute</option>
                <option value="5m">5 minutes</option>
                <option value="1h">1 hour</option>
                <option value="1d">1 day</option>
                <option value="7d">7 days</option>
                <option value="1mo">1 month</option>
            </select>
        </div>

        <button onClick={handlePlaceBid} className="button-primary">Place Bid</button>
      </div>

      <div className="card" style={{ maxWidth: '600px', marginTop: '20px' }}>
        <h2>Execution Status</h2>
        <p style={{ color: 'lightgreen', wordBreak: 'break-word' }}>{statusMessage}</p>
      </div>
    </div>
  );
}

export default TasksPage;