import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Zap,
  LayoutDashboard,
  Layers,
  Sparkles,
  Activity,
  KeyRound,
  Plus,
  Terminal,
  LogOut,
} from 'lucide-react';
import { AUTH_ENABLED } from '../api.js';

export default function Navbar({ onOpenWizard, workflowCount = 0 }) {
  const location = useLocation();
  const navigate = useNavigate();

  function logout() {
    sessionStorage.removeItem('flowbox_token');
    navigate('/login');
  }

  const currentPath = location.pathname;

  return (
    <header className="navbar">
      <div className="nav-left">
        <Link to="/" className="brand-logo">
          <div className="logo-badge">
            <Zap size={20} strokeWidth={2.5} />
          </div>
          <span className="brand-name">Flowbox</span>
          <span className="brand-tag">v2.0</span>
        </Link>

        <nav className="nav-links">
          <Link
            to="/"
            className={`nav-item ${currentPath === '/' ? 'active' : ''}`}
          >
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
          </Link>
          <Link
            to="/automations"
            className={`nav-item ${currentPath === '/automations' ? 'active' : ''}`}
          >
            <Layers size={16} />
            <span>Automations</span>
            {workflowCount > 0 && <span className="nav-badge">{workflowCount}</span>}
          </Link>
          <Link
            to="/templates"
            className={`nav-item ${currentPath === '/templates' ? 'active' : ''}`}
          >
            <Sparkles size={16} />
            <span>Templates</span>
          </Link>
          <Link
            to="/activity"
            className={`nav-item ${currentPath === '/activity' ? 'active' : ''}`}
          >
            <Activity size={16} />
            <span>Activity</span>
          </Link>
          <Link
            to="/credentials"
            className={`nav-item ${currentPath === '/credentials' ? 'active' : ''}`}
          >
            <KeyRound size={16} />
            <span>Connected Apps</span>
          </Link>
        </nav>
      </div>

      <div className="nav-right">
        <button
          className="mode-badge"
          title="Open Advanced Node Workflow Canvas"
          onClick={() => {
            // Find an existing workflow to open or create one in dev mode
            navigate('/workflows/latest');
          }}
        >
          <Terminal size={14} />
          <span>Advanced Canvas</span>
        </button>

        {onOpenWizard && (
          <button className="btn-gradient" style={{ padding: '7px 14px', fontSize: 13 }} onClick={() => onOpenWizard()}>
            <Plus size={15} strokeWidth={2.5} />
            <span>Create</span>
          </button>
        )}

        {AUTH_ENABLED && (
          <button
            className="btn-subtle"
            onClick={logout}
            title="Log out"
            style={{ padding: '8px 10px' }}
          >
            <LogOut size={16} />
          </button>
        )}
      </div>
    </header>
  );
}
