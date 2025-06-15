const { app, BrowserWindow, ipcMain, shell } = require('electron');
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
const crypto = require('crypto');

const store = new Store();

const chainConfigs = {
  mainnet: { name: 'mainnet', id: 1, viemChain: mainnet, reservoirBaseUrl: 'https://api.reservoir.tools', publicRpcUrl: process.env.ALCHEMY_MAINNET_RPC_URL, wethAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
  base: { name: 'base', id: 8453, viemChain: base, reservoirBaseUrl: 'https://api-base.reservoir.tools', publicRpcUrl: process.env.ALCHEMY_BASE_RPC_URL || 'https://mainnet.base.org', wethAddress: '0x4200000000000000000000000000000000000006' }
};

const activeChainName = process.env.CHAIN_NAME || 'base';
const activeChainConfig = chainConfigs[activeChainName];
console.log(`Application configured to work on the network: ${activeChainName}`);

if (!process.env.RESERVOIR_API_KEY || !process.env.OPENSEA_API_KEY) {
  console.error("ERROR: RESERVOIR_API_KEY or OPENSEA_API_KEY not found in .env file!");
}

createClient({
  chains: Object.values(chainConfigs).map(c => ({ id: c.id, baseApiUrl: c.reservoirBaseUrl, apiKey: process.env.RESERVOIR_API_KEY, })),
  source: 'noenemy.app'
});

const publicClient = createPublicClient({ chain: activeChainConfig.viemChain, transport: http(activeChainConfig.publicRpcUrl) });
const mainnetPublicClient = createPublicClient({ chain: mainnet, transport: http(process.env.ALCHEMY_MAINNET_RPC_URL) });

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
        if (win.isDestroyed()) return;
        const gasPriceWei = await mainnetPublicClient.getGasPrice();
        const gasPrice = parseFloat(formatGwei(gasPriceWei)).toFixed(2);
        const now = Date.now();
        if (now - lastEthPriceFetch > 60000) {
          const ethPriceResponse = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
          ethPrice = ethPriceResponse.data.ethereum.usd;
          lastEthPriceFetch = now;
        }
        win.webContents.send('market-data-update', { success: true, ethPrice, gasPrice });
      } catch (error) {
        console.error('Error in watchBlocks (getGasPrice):', error.message);
      }
    }
  });
}

function registerIpcHandlers() {
  ipcMain.handle('get-wallets', async () => {
    const wallets = store.get('wallets', []);
    try {
        return await Promise.all(wallets.map(async (wallet) => {
            const ethBalance = await publicClient.getBalance({ address: wallet.address });
            const wethBalance = await publicClient.readContract({ address: activeChainConfig.wethAddress, abi: [{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}], functionName: 'balanceOf', args: [wallet.address] });
            return { ...wallet, ethBalance: parseFloat(formatEther(ethBalance)).toFixed(4), wethBalance: parseFloat(formatEther(wethBalance)).toFixed(4) };
        }));
    } catch (error) {
        return wallets.map(w => ({ ...w, ethBalance: 'Error', wethBalance: 'Error' }));
    }
  });

  ipcMain.handle('add-wallet', async (event, name, privateKey) => {
    try {
      const account = privateKeyToAccount(privateKey);
      const address = account.address;
      const currentWallets = store.get('wallets', []);
      if (currentWallets.some(w => w.address === address)) {
        return { success: false, message: 'Wallet already exists.' };
      }
      store.set('wallets', [...currentWallets, { name, address, privateKey }]);
      return { success: true };
    } catch (error) {
      return { success: false, message: 'Invalid private key.' };
    }
  });

  ipcMain.handle('delete-wallet', async (event, address) => {
    const currentWallets = store.get('wallets', []);
    store.set('wallets', currentWallets.filter(w => w.address !== address));
    return { success: true };
  });

  ipcMain.handle('place-bid', async (event, { walletAddress, contractAddress, tokenId, bidPrice, expirationTime }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const targetWallet = store.get('wallets', []).find(w => w.address === walletAddress);
    if (!targetWallet) return { success: false, message: 'Selected wallet not found.' };
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
          if (currentStep && !win.isDestroyed()) {
            win.webContents.send('bid-status-update', `Executing: ${currentStep.action}`);
          }
        },
      });
      return { success: true, message: `Bid successfully placed on network ${activeChainName}!` };
    } catch (e) {
      return { success: false, message: e.message };
    }
  });

  ipcMain.handle('get-market-data', async () => {
    try {
      const ethPriceResponse = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      const gasPriceWei = await mainnetPublicClient.getGasPrice();
      return { success: true, ethPrice: ethPriceResponse.data.ethereum.usd, gasPrice: parseFloat(formatGwei(gasPriceWei)).toFixed(2) };
    } catch (error) {
      return { success: false, ethPrice: 'N/A', gasPrice: 'N/A' };
    }
  });

  ipcMain.handle('get-temp-bids', async () => {
    const hardcodedAddress = '0x047AA61fB65Df27c219d67025DdAE0683CecC37D';
    const mainnetConfig = chainConfigs['mainnet'];
    try {
      const api = axios.create({ baseURL: mainnetConfig.reservoirBaseUrl, headers: { 'x-api-key': process.env.RESERVOIR_API_KEY } });
      const response = await api.get(`/users/${hardcodedAddress}/bids/v1`, { params: { status: 'active', limit: 50 } });
      const activeBids = response.data.orders;
      console.log(`[get-temp-bids] Found ${activeBids.length} bids. Starting enrichment...`);
      
      const enrichedBids = [];
      const collectionCache = new Map();

      for (const bid of activeBids) {
        const [, contract, tokenId] = bid.tokenSetId.split(':');
        let enrichedData = { collectionSlug: 'N/A', collectionName: 'N/A', topBid: 'N/A' };
        
        try {
          const [collectionResponse, topBidResponse] = await Promise.all([
            collectionCache.has(contract) 
                ? Promise.resolve(collectionCache.get(contract))
                : api.get(`/collections/v7?id=${contract}`),
            api.get(`/orders/bids/v6`, { params: { token: `${contract}:${tokenId}`, sortBy: 'price', limit: 1 } })
          ]);
          
          if (collectionResponse?.data?.collections?.[0]) {
            const collection = collectionResponse.data.collections[0];
            enrichedData.collectionSlug = collection.slug;
            enrichedData.collectionName = collection.name;
            if (!collectionCache.has(contract)) {
              collectionCache.set(contract, { data: { collections: [collection] } });
            }
          }

          if (topBidResponse?.data?.orders?.[0]) {
            enrichedData.topBid = topBidResponse.data.orders[0].price.amount.native.toString();
          }
        } catch (e) {
          console.error(`Error enriching bid ${bid.id}:`, e.message);
        }
        
        enrichedBids.push({
          id: bid.id,
          contractAddress: contract,
          tokenId: tokenId,
          bidPrice: bid.price.amount.native,
          expiration: bid.expiration,
          createdAt: bid.createdAt,
          ...enrichedData,
        });
        
        console.log(`[Enricher] Processed bid for token #${tokenId}. Pausing for 0.5 sec.`);
        await sleep(500);
      }
      
      console.log('[get-temp-bids] Enrichment complete.');
      return enrichedBids;

    } catch (error) {
      console.error(`[get-temp-bids] Critical error:`, error.message);
      return [];
    }
  });

  ipcMain.handle('open-external-link', async (event, url) => {
    await shell.openExternal(url);
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