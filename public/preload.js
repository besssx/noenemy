const { contextBridge, ipcRenderer } = require('electron');

const validInvokeChannels = [ 'get-wallets', 'add-wallet', 'delete-wallet', 'place-bid' ];
const validOnChannels = [ 'bid-status-update' ]; // Канал для получения статусов

contextBridge.exposeInMainWorld('electronAPI', {
  // Для запросов "вопрос-ответ"
  invoke: (channel, ...args) => {
    if (validInvokeChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
  },
  // Для прослушивания событий от бэкенда
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