import React from 'react';
import { NavLink } from 'react-router-dom';

function Navbar() {
  return (
    <nav className="navbar">
      {/* <div className="navbar-header">
        <h2>noenemy</h2>
      </div> */}
      <ul className="nav-links">
        <li><NavLink to="/" className="nav-link">Dashboard</NavLink></li>
        <li><NavLink to="/tasks" className="nav-link">Tasks</NavLink></li>
        <li><NavLink to="/collections" className="nav-link">Collections</NavLink></li>
        <li><NavLink to="/logs" className="nav-link">Logs</NavLink></li>
        <li><NavLink to="/wallets" className="nav-link">Wallets</NavLink></li>
        <li><NavLink to="/temp-bids" className="nav-link" style={{color: '#f39c12'}}>Temp Bids</NavLink></li>
      </ul>
    </nav>
  );
}

export default Navbar;