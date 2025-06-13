import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './components/Navbar';
import './App.css';

function Layout() {
  return (
    <div className="layout">
      <Navbar />
      <main className="content">
        <Outlet /> 
      </main>
    </div>
  );
}

export default Layout;