import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import './App.css';
import { BidsProvider } from './contexts/BidsContext'; // 1. Импортируем провайдер

function Layout() {
  return (
    // 2. Оборачиваем layout в провайдер
    <BidsProvider>
      <div className="layout">
        <Navbar />
        <div className="main-content">
          <main className="content">
            <Outlet /> 
          </main>
          <Footer />
        </div>
      </div>
    </BidsProvider>
  );
}

export default Layout;