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
  parseEther 
} = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { base } = require('viem/chains');

const store = new Store();

if (!process.env.RESERVOIR_API_KEY || !process.env.OPENSEA_API_KEY) {
  console.error("ОШИБКА: RESERVOIR_API_KEY или OPENSEA_API_KEY не найдены в .env файле!");
}

// --- КЛИЕНТЫ ---
createClient({
  chains: [{
    id: 8453, // Base
    baseApiUrl: 'https://api-base.reservoir.tools',
    apiKey: process.env.RESERVOIR_API_KEY,
  }],
  source: 'noenemy.app'
});

const publicClient = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});


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
}

function registerIpcHandlers() {
  // --- УПРАВЛЕНИЕ КОШЕЛЬКАМИ ---
  ipcMain.handle('get-wallets', async () => {
    const wallets = store.get('wallets', []);
    try {
        const walletsWithBalances = await Promise.all(
            wallets.map(async (wallet) => {
                const ethBalance = await publicClient.getBalance({ address: wallet.address });
                const wethBalance = await publicClient.readContract({
                  address: '0x4200000000000000000000000000000000000006',
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

  // --- РАЗМЕЩЕНИЕ СТАВОК ---
  ipcMain.handle('place-bid', async (event, { walletAddress, contractAddress, tokenId, bidPrice, expirationTime }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false, message: 'Окно браузера не найдено.'};
    
    const wallets = store.get('wallets', []);
    const targetWallet = wallets.find(w => w.address === walletAddress);
    if (!targetWallet) return { success: false, message: 'Выбранный кошелек не найден.'};

    try {
      const account = privateKeyToAccount(targetWallet.privateKey);
      const walletClient = createWalletClient({ account, chain: base, transport: http() });
      const reservoirClient = getClient();
      
      win.webContents.send('bid-status-update', 'Кошелек создан, формируем валидный ордер для OpenSea...');

      await reservoirClient?.actions.placeBid({
        wallet: walletClient,
        bids: [{
          token: `${contractAddress}:${tokenId}`,
          weiPrice: parseEther(bidPrice).toString(),
          orderbook: 'opensea',
          orderKind: 'seaport-v1.5',
          currency: '0x4200000000000000000000000000000000000006',
          expirationTime: expirationTime,
          automatedRoyalties: true,
          options: {
            "openseaApiKey": process.env.OPENSEA_API_KEY,
          }
        }],
        onProgress: (steps) => {
          const currentStep = steps.find(step => step.status === 'incomplete');
          if (currentStep) {
            console.log('Шаг выполнения ставки:', currentStep.action);
            win.webContents.send('bid-status-update', `Выполняется: ${currentStep.action}`);
          }
        },
      });
      
      return { success: true, message: 'Ставка успешно размещена через SDK (с параметрами OpenSea)!' };

    } catch (e) {
      console.error('Произошла ошибка при размещении ставки через SDK:', e);
      return { success: false, message: e.message };
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