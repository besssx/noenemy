const { contextBridge, ipcRenderer } = require('electron');

const validInvokeChannels = [
  'get-wallets',
  'add-wallet',
  'delete-wallet',
  'place-bid',
  'get-market-data'
];
const validOnChannels = [ 
  'bid-status-update', 
  'market-data-update' // Теперь только один канал для обновлений футера
];

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel, ...args) => {
    if (validInvokeChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
  },
  receive: (channel, func) => {
    if (validOnChannels.includes(channel)) {
      const subscription = (event, ...args) => func(...args);
      ipcRenderer.on(channel, subscription);
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    }
  },
});