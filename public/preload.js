const { contextBridge, ipcRenderer } = require('electron');

// Белый список каналов, по которым разрешено общение.
const validChannels = ['to-main', 'from-main'];

contextBridge.exposeInMainWorld('api', {
  // Функция для отправки сообщений из React в Electron
  send: (channel, data) => {
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  // Функция для получения сообщений в React из Electron
  receive: (channel, func) => {
    if (validChannels.includes(channel)) {
      // Убираем обертку события и передаем только данные
      const subscription = (event, ...args) => func(...args);
      ipcRenderer.on(channel, subscription);
      
      // Возвращаем функцию для отписки, чтобы избежать утечек памяти
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    }
  },
});