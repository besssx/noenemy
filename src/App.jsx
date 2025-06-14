import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './Layout';
import DashboardPage from './pages/DashboardPage';
import TasksPage from './pages/TasksPage';
import CollectionsPage from './pages/CollectionsPage';
import LogsPage from './pages/LogsPage';
// import WalletsPage from './pages/WalletsPage'; // <-- УДАЛЯЕМ

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="collections" element={<CollectionsPage />} />
        <Route path="logs" element={<LogsPage />} />
        {/* Роут для /wallets удален */}
      </Route>
    </Routes>
  );
}

export default App;