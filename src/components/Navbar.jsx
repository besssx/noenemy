import React from 'react';
import { NavLink } from 'react-router-dom';

function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-header">
        <h2>noenemy</h2>
      </div>
      <ul className="nav-links">
        <li>
          <NavLink to="/" className="nav-link">Главная</NavLink>
        </li>
        <li>
          <NavLink to="/tasks" className="nav-link">Задачи</NavLink>
        </li>
        <li>
          <NavLink to="/collections" className="nav-link">Коллекции</NavLink>
        </li>
        <li>
          <NavLink to="/logs" className="nav-link">Логи</NavLink>
        </li>
        {/* Ссылка 'Кошельки' удалена */}
      </ul>
    </nav>
  );
}

export default Navbar;