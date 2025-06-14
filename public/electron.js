const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
require('dotenv').config();
const { createClient, getClient } = require('@reservoir0x/reservoir-sdk');
const { 
  createWalletClient, 
  createPublicClient,
  http, 
  formatEther,
  parseEther,
  formatGwei
} = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { base, mainnet } = require('viem/chains');
const axios = require('axios');

const store = new Store();

// --- ДИНАМИЧЕСКАЯ КОНФИГУРАЦИЯ СЕТИ ---
const chainName = process.env.CHAIN_NAME || 'base';
let chainConfig;

if (chainName === 'mainnet') {
  chainConfig = {
    id: 1,
    viemChain: mainnet,
    reservoirBaseUrl: 'https://api.reservoir.tools',
    publicRpcUrl: process.env.ALCHEMY_MAINNET_RPC_URL,
    wethAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
  };
  console.log('Приложение настроено для работы в сети: Ethereum Mainnet');
} else { // по умолчанию 'base'
  chainConfig = {
    id: 8453,
    viemChain: base,
    reservoirBaseUrl: 'https://api-base.reservoir.tools',
    publicRpcUrl: process.env.ALCHEMY_BASE_RPC_URL || 'https://mainnet.base.org',
    wethAddress: '0x4200000000000000000000000000000000000006'
  };
  console.log('Приложение настроено для работы в сети: Base');
}

if (!process.env.RESERVOIR_API_KEY || !process.env.ALCHEMY_MAINNET_RPC_URL) {
  console.error("ОШИБКА: Ключи API или RPC URL для Mainnet не найдены в .env файле!");
}

// --- КЛИЕНТЫ ---
createClient({
  chains: [{
    id: chainConfig.id,
    baseApiUrl: chainConfig.reservoirBaseUrl,
    apiKey: process.env.RESERVOIR_API_KEY,
  }],
  source: 'noenemy.app'
});

const publicClient = createPublicClient({
  chain: chainConfig.viemChain,
  transport: http(chainConfig.publicRpcUrl),
});

const mainnetPublicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ALCHEMY_MAINNET_RPC_URL),
});

// --- ГЛАВНАЯ ЛОГИКА ---

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const startUrl = 'http://localhost:5173';
  win.loadURL(startUrl);

  // Запускаем подписку на рыночные данные после создания окна
  startMarketDataSubscription(win);
}

function startMarketDataSubscription(win) {
  let ethPrice = 'N/A';

  const updateEthPrice = async () => {
    try {
      console.log('Обновляем цену ETH...');
      const ethPriceResponse = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      ethPrice = ethPriceResponse.data.ethereum.usd;
    } catch (error) {
      console.error('Ошибка при обновлении цены ETH:', error.message);
    }
  };

  // Вызываем один раз при запуске, чтобы цена была сразу
  updateEthPrice();
  // Затем обновляем по таймеру раз в минуту
  setInterval(updateEthPrice, 60000); 

  // Следим за блоками для обновления цены на газ
  mainnetPublicClient.watchBlocks({
    onBlock: async (block) => {
      try {
        const gasPriceWei = await mainnetPublicClient.getGasPrice();
        const gasPrice = parseFloat(formatGwei(gasPriceWei)).toFixed(2);
        console.log(`Новый блок: ${block.number}, Газ Mainnet: ${gasPrice} GWEI`);
        
        // Отправляем на фронтенд свежий газ и последнюю известную цену ETH
        win.webContents.send('market-data-update', { success: true, ethPrice, gasPrice });
      } catch (error) {
        console.error('Ошибка в watchBlocks (getGasPrice):', error.message);
      }
    }
  });
}

function registerIpcHandlers() {
  ipcMain.handle('get-wallets', async () => {
    const wallets = store.get('wallets', []);
    try {
        const walletsWithBalances = await Promise.all(
            wallets.map(async (wallet) => {
                const ethBalance = await publicClient.getBalance({ address: wallet.address });
                const wethBalance = await publicClient.readContract({
                  address: chainConfig.wethAddress,
                  abi: [{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}],
                  functionName: 'balanceOf',
                  args: [wallet.address]
                });
                return { 
                    ...wallet, 
                    ethBalance: parseFloat(formatEther(ethBalance)).toFixed(4),
                    wethBalance: parseFloat(formatEther(wethBalance)).toFixed(4)
                };
            })
        );
        return walletsWithBalances;
    } catch (error) {
        console.error("Failed to fetch balances:", error);
        return wallets.map(w => ({ ...w, ethBalance: 'Error', wethBalance: 'Error' }));
    }
  });

  ipcMain.handle('add-wallet', async (event, name, privateKey) => {
    try {
      const account = privateKeyToAccount(privateKey);
      const address = account.address;
      const currentWallets = store.get('wallets', []);
      if (currentWallets.some(w => w.address === address)) return { success: false, message: 'Кошелек уже существует.' };
      const updatedWallets = [...currentWallets, { name, address, privateKey }];
      store.set('wallets', updatedWallets);
      return { success: true };
    } catch (error) {
      return { success: false, message: 'Неверный приватный ключ.' };
    }
  });

  ipcMain.handle('delete-wallet', async (event, address) => {
    const currentWallets = store.get('wallets', []);
    const updatedWallets = currentWallets.filter(w => w.address !== address);
    store.set('wallets', updatedWallets);
    return { success: true };
  });

  ipcMain.handle('place-bid', async (event, { walletAddress, contractAddress, tokenId, bidPrice, expirationTime }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false, message: 'Окно браузера не найдено.'};
    const wallets = store.get('wallets', []);
    const targetWallet = wallets.find(w => w.address === walletAddress);
    if (!targetWallet) return { success: false, message: 'Выбранный кошелек не найден.'};
    try {
      const account = privateKeyToAccount(targetWallet.privateKey);
      const walletClient = createWalletClient({ account, chain: chainConfig.viemChain, transport: http() });
      const reservoirClient = getClient();
      await reservoirClient?.actions.placeBid({
        wallet: walletClient,
        bids: [{
          token: `${contractAddress}:${tokenId}`,
          weiPrice: parseEther(bidPrice).toString(),
          orderbook: 'opensea',
          orderKind: 'seaport-v1.5',
          currency: chainConfig.wethAddress,
          expirationTime: expirationTime,
          automatedRoyalties: true,
          options: { "openseaApiKey": process.env.OPENSEA_API_KEY }
        }],
        onProgress: (steps) => {
          const currentStep = steps.find(step => step.status === 'incomplete');
          if (currentStep) {
            console.log('Шаг выполнения ставки:', currentStep.action);
            win.webContents.send('bid-status-update', `Выполняется: ${currentStep.action}`);
          }
        },
      });
      return { success: true, message: `Ставка успешно размещена в сети ${chainName}!` };
    } catch (e) {
      console.error('Произошла ошибка при размещении ставки через SDK:', e);
      return { success: false, message: e.message };
    }
  });

  ipcMain.handle('get-market-data', async () => {
    try {
      const ethPriceResponse = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      const ethPrice = ethPriceResponse.data.ethereum.usd;
      const gasPriceWei = await mainnetPublicClient.getGasPrice();
      const gasPriceGwei = formatGwei(gasPriceWei);
      return { success: true, ethPrice, gasPrice: parseFloat(gasPriceGwei).toFixed(2) };
    } catch (error) {
      console.error("Failed to fetch market data:", error.message);
      return { success: false, ethPrice: 'N/A', gasPrice: 'N/A' };
    }
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});