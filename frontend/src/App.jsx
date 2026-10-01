import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Automations from './pages/Automations.jsx';
import Templates from './pages/Templates.jsx';
import Activity from './pages/Activity.jsx';
import Credentials from './pages/Credentials.jsx';
import Editor from './pages/Editor.jsx';
import { AUTH_ENABLED } from './api.js';

function RequireAuth({ children }) {
  if (!AUTH_ENABLED) {
    return children;
  }
  const token = sessionStorage.getItem('flowbox_token');
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={AUTH_ENABLED ? <Login /> : <Navigate to="/" replace />}
        />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/automations"
          element={
            <RequireAuth>
              <Automations />
            </RequireAuth>
          }
        />
        <Route
          path="/templates"
          element={
            <RequireAuth>
              <Templates />
            </RequireAuth>
          }
        />
        <Route
          path="/activity"
          element={
            <RequireAuth>
              <Activity />
            </RequireAuth>
          }
        />
        <Route
          path="/credentials"
          element={
            <RequireAuth>
              <Credentials />
            </RequireAuth>
          }
        />
        <Route
          path="/workflows/:id"
          element={
            <RequireAuth>
              <Editor />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
