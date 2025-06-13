const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
require('dotenv').config();
const axios = require('axios');

// Клиент SDK все еще нужен для будущих ДЕЙСТВИЙ (отправки ставок)
const { createClient } = require('@reservoir0x/reservoir-sdk');

const store = new Store();

const reservoirClient = createClient({
  chains: [{
    id: 1,
    baseApiUrl: 'https://api.reservoir.tools',
    apiKey: process.env.RESERVOIR_API_KEY,
  }],
  source: 'noenemy.app'
});

const reservoirApi = axios.create({
  baseURL: 'https://api.reservoir.tools',
  headers: {
    'accept': '*/*',
    'x-api-key': process.env.RESERVOIR_API_KEY
  }
});

// --- ЛОГИКА ОПРОСА (POLLING) ---

let pollingInterval; // Переменная для хранения нашего интервала
let lastKnownAskId = null; // ID последнего виденного нами ордера

function startPollingAsks(win) {
  // Если уже есть активный цикл, останавливаем его перед запуском нового
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }

  console.log('Запуск опроса (polling) новых ордеров...');
  win.webContents.send('from-main', { type: 'ws-status', payload: 'Опрос запущен (интервал: 1.5 сек)' });


  pollingInterval = setInterval(async () => {
    try {
      const collectionId = '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D'; // BAYC
      // Запрашиваем 5 самых новых ордеров, отсортированных по времени создания
      const response = await reservoirApi.get(`/orders/asks/v6?contracts=${collectionId}&sortBy=createdAt&limit=5`);
      const asks = response.data.orders;

      if (!asks || asks.length === 0) {
        return; // Если ордеров нет, ничего не делаем
      }

      // Самый свежий ордер будет первым в списке
      const latestAsk = asks[0];
      
      // Если это первый запуск, просто запоминаем ID
      if (lastKnownAskId === null) {
        lastKnownAskId = latestAsk.id;
        console.log(`Инициализация. Последний известный ордер: ${lastKnownAskId}`);
        return;
      }

      // Ищем реально новые ордера, которых мы еще не видели
      const newAsks = [];
      for (const ask of asks) {
        if (ask.id === lastKnownAskId) {
          break; // Мы дошли до уже известных ордеров, останавливаемся
        }
        newAsks.push(ask);
      }

      if (newAsks.length > 0) {
        console.log(`Обнаружено ${newAsks.length} новых ордеров!`);
        // Обновляем ID последнего известного ордера
        lastKnownAskId = newAsks[0].id;

        // Отправляем новые ордера на фронтенд
        // Мы переворачиваем массив, чтобы обработать их от старых к новым
        for (const newAsk of newAsks.reverse()) {
            win.webContents.send('from-main', { type: 'ws-event', payload: newAsk });
        }
      }

    } catch (error) {
      console.error('Ошибка при опросе ордеров:', error.message);
    }
  }, 1500); // Опрашиваем каждые 1.5 секунды, чтобы быть в рамках лимита (2 запроса/сек)
}


function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  
  startPollingAsks(win); // Запускаем наш цикл опроса после создания окна
  
  // ... остальной код без изменений
  const isDev = !app.isPackaged;
  const startUrl = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../dist/index.html')}`;

  win.loadURL(startUrl);

  ipcMain.on('to-main', async (event, data) => { /* ... */ });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (pollingInterval) clearInterval(pollingInterval); // Очищаем интервал при закрытии
    if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});