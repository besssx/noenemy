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

const chainConfigs = {
  mainnet: { name: 'mainnet', id: 1, viemChain: mainnet, reservoirBaseUrl: 'https://api.reservoir.tools', publicRpcUrl: process.env.ALCHEMY_MAINNET_RPC_URL, wethAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
  base: { name: 'base', id: 8453, viemChain: base, reservoirBaseUrl: 'https://api-base.reservoir.tools', publicRpcUrl: process.env.ALCHEMY_BASE_RPC_URL || 'https://mainnet.base.org', wethAddress: '0x4200000000000000000000000000000000000006' }
};

const activeChainName = process.env.CHAIN_NAME || 'base';
const activeChainConfig = chainConfigs[activeChainName];
console.log(`Приложение настроено для работы в сети: ${activeChainName}`);

if (!process.env.RESERVOIR_API_KEY || !process.env.ALCHEMY_MAINNET_RPC_URL) {
  console.error("ОШИБКА: Ключи API или RPC URL для Mainnet не найдены в .env файле!");
}

createClient({
  chains: [{ id: activeChainConfig.id, baseApiUrl: activeChainConfig.reservoirBaseUrl, apiKey: process.env.RESERVOIR_API_KEY, }],
  source: 'noenemy.app'
});

const publicClient = createPublicClient({ chain: activeChainConfig.viemChain, transport: http(activeChainConfig.publicRpcUrl) });
const mainnetPublicClient = createPublicClient({ chain: mainnet, transport: http(process.env.ALCHEMY_MAINNET_RPC_URL) });

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
  startMarketDataSubscription(win);
}

function startMarketDataSubscription(win) {
  let ethPrice = 'N/A';
  let lastEthPriceFetch = 0;
  mainnetPublicClient.watchBlocks({
    onBlock: async (block) => {
      try {
        const gasPriceWei = await mainnetPublicClient.getGasPrice();
        const gasPrice = parseFloat(formatGwei(gasPriceWei)).toFixed(2);
        const now = Date.now();
        if (now - lastEthPriceFetch > 60000) {
            const ethPriceResponse = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
            ethPrice = ethPriceResponse.data.ethereum.usd;
            lastEthPriceFetch = now;
        }
        if (!win.isDestroyed()) {
          win.webContents.send('market-data-update', { success: true, ethPrice, gasPrice });
        }
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
                  address: activeChainConfig.wethAddress,
                  abi: [{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}],
                  functionName: 'balanceOf',
                  args: [wallet.address]
                });
                return { ...wallet, ethBalance: parseFloat(formatEther(ethBalance)).toFixed(4), wethBalance: parseFloat(formatEther(wethBalance)).toFixed(4) };
            })
        );
        return walletsWithBalances;
    } catch (error) {
        return wallets.map(w => ({ ...w, ethBalance: 'Error', wethBalance: 'Error' }));
    }
  });

  ipcMain.handle('add-wallet', async (event, name, privateKey) => {
    try {
      const account = privateKeyToAccount(privateKey);
      const address = account.address;
      const currentWallets = store.get('wallets', []);
      if (currentWallets.some(w => w.address === address)) return { success: false, message: 'Кошелек уже существует.' };
      store.set('wallets', [...currentWallets, { name, address, privateKey }]);
      return { success: true };
    } catch (error) { return { success: false, message: 'Неверный приватный ключ.' }; }
  });

  ipcMain.handle('delete-wallet', async (event, address) => {
    const currentWallets = store.get('wallets', []);
    store.set('wallets', currentWallets.filter(w => w.address !== address));
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
      const walletClient = createWalletClient({ account, chain: activeChainConfig.viemChain, transport: http() });
      await getClient()?.actions.placeBid({
        wallet: walletClient,
        bids: [{
          token: `${contractAddress}:${tokenId}`,
          weiPrice: parseEther(bidPrice).toString(),
          orderbook: 'opensea',
          orderKind: 'seaport-v1.5',
          currency: activeChainConfig.wethAddress,
          expirationTime: expirationTime,
          automatedRoyalties: true,
          options: { "openseaApiKey": process.env.OPENSEA_API_KEY }
        }],
        onProgress: (steps) => {
          const currentStep = steps.find(step => step.status === 'incomplete');
          if (currentStep) win.webContents.send('bid-status-update', `Выполняется: ${currentStep.action}`);
        },
      });
      return { success: true, message: `Ставка успешно размещена в сети ${activeChainName}!` };
    } catch (e) { return { success: false, message: e.message }; }
  });

  ipcMain.handle('get-market-data', async () => {
    try {
      const ethPriceResponse = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      const gasPriceWei = await mainnetPublicClient.getGasPrice();
      return { success: true, ethPrice: ethPriceResponse.data.ethereum.usd, gasPrice: parseFloat(formatGwei(gasPriceWei)).toFixed(2) };
    } catch (error) { return { success: false, ethPrice: 'N/A', gasPrice: 'N/A' }; }
  });

  ipcMain.handle('get-temp-bids', async () => {
    console.log('[get-temp-bids] Обработчик вызван.');
    const hardcodedAddress = '0x047AA61fB65Df27c219d67025DdAE0683CecC37D';
    const mainnetConfig = chainConfigs['mainnet'];
    
    try {
        const apiUrl = `${mainnetConfig.reservoirBaseUrl}/users/${hardcodedAddress}/bids/v1`;
        console.log(`[get-temp-bids] Запрашиваем URL: ${apiUrl} с лимитом 50`);

        const api = axios.create({ baseURL: mainnetConfig.reservoirBaseUrl, headers: { 'x-api-key': process.env.RESERVOIR_API_KEY } });
        const response = await api.get(`/users/${hardcodedAddress}/bids/v1`, { 
            params: { status: 'active', limit: 50 } 
        });
        
        const activeBids = response.data.orders;
        console.log(`[get-temp-bids] Найдено ${activeBids.length} ставок.`);
        
        // Трансформируем данные прямо здесь
        const formattedBids = activeBids.map(bid => {
            const [, contract, tokenId] = bid.tokenSetId.split(':');
            return {
                id: bid.id,
                contractAddress: contract,
                tokenId: tokenId,
                bidPrice: bid.price.amount.native,
                expiration: bid.expiration,
                createdAt: bid.createdAt,
            };
        });
        return formattedBids;

    } catch (error) {
        console.error(`[get-temp-bids] Ошибка при загрузке ставок:`, error.message);
        return []; // В случае ошибки возвращаем пустой массив
    }
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});