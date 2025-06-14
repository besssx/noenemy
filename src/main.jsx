import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom';
import App from './App.jsx'
import Modal from 'react-modal'; // <-- ИМПОРТИРУЕМ

Modal.setAppElement('#root'); // <-- УКАЗЫВАЕМ КОРНЕВОЙ ЭЛЕМЕНТ

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
)