import React, { useState, useEffect } from 'react';
import WalletModal from './WalletModal';

function Footer() {
  const [marketData, setMarketData] = useState({ ethPrice: '...', gasPrice: '...' });
  const [countdown, setCountdown] = useState(12);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [defaultWallet, setDefaultWallet] = useState(null);

  // Эта функция теперь будет запрашивать ТОЛЬКО кошельки
  const loadWallets = async () => {
    const wallets = await window.electronAPI.invoke('get-wallets');
    if (wallets.length > 0) {
      setDefaultWallet(wallets[0]);
    } else {
      setDefaultWallet(null);
    }
  };
  
  // Этот эффект отвечает только за рыночные данные и таймер
  useEffect(() => {
    // Первоначальный запрос рыночных данных
    const getInitialMarketData = async () => {
      const result = await window.electronAPI.invoke('get-market-data');
      if (result.success) {
        setMarketData({ ethPrice: result.ethPrice, gasPrice: result.gasPrice });
      }
    };
    getInitialMarketData();

    // Слушатель для real-time обновлений от бэкенда
    const removeDataListener = window.electronAPI.receive('market-data-update', (data) => {
      if (data.success) {
        setMarketData({ ethPrice: data.ethPrice, gasPrice: data.gasPrice });
      }
      setCountdown(12);
    });

    // Визуальный таймер
    const timer = setInterval(() => {
      setCountdown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      removeDataListener();
      clearInterval(timer);
    };
  }, []);

  // Этот эффект отвечает только за загрузку кошельков
  useEffect(() => {
    loadWallets();
  }, []);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    // Перезагружаем кошельки после закрытия окна, на случай если их удалили/добавили
    loadWallets();
  }

  return (
    <>
      <footer className="footer" onClick={() => setIsModalOpen(true)}>
        <div className="footer-section footer-wallets">
          {defaultWallet ? (
            <>
              <div className="footer-item">
                <span>Wallet:</span>
                <span className="footer-value">{defaultWallet.name} ({defaultWallet.address.substring(0, 6)}...)</span>
              </div>
              <div className="footer-item">
                <span>ETH:</span>
                <span className="footer-value">{defaultWallet.ethBalance}</span>
              </div>
              <div className="footer-item">
                <span>WETH:</span>
                <span className="footer-value">{defaultWallet.wethBalance}</span>
              </div>
            </>
          ) : (
            <div className="footer-item">Нажмите, чтобы добавить кошелек</div>
          )}
        </div>
        <div className="footer-section footer-market">
          <div className="footer-item">
            <span>ETH Price:</span>
            <span className="footer-value">${marketData.ethPrice}</span>
          </div>
          <div className="footer-item">
            <span>Gas (Mainnet):</span>
            <span className="footer-value">{marketData.gasPrice} GWEI</span>
          </div>
          <div className="footer-item">
            <span>Next Block:</span>
            <span className="footer-value">{countdown}s</span>
          </div>
        </div>
      </footer>
      <WalletModal isOpen={isModalOpen} onRequestClose={handleCloseModal} />
    </>
  );
}

export default Footer;