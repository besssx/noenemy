import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import './App.css';

function Layout() {
  return (
    <div className="layout">
      <Navbar />
      <div className="main-content">
        <main className="content">
          <Outlet /> 
        </main>
        <Footer />
      </div>
    </div>
  );
}

export default Layout;