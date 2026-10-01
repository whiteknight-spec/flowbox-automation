import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Lock, User, ArrowRight, AlertCircle } from 'lucide-react';
import { api } from '../api.js';

export default function Login() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.login(username, password);
      sessionStorage.setItem('flowbox_token', data.token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="center-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div className="login-logo" style={{ margin: '0 auto 16px' }}>
            <Zap size={24} strokeWidth={2.5} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#ffffff', marginBottom: 6 }}>
            Flowbox
          </h1>
          <p style={{ fontSize: 14, color: '#94a3b8' }}>
            Automate the things you do again and again.
          </p>
        </div>

        {error && (
          <div className="error-text">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Username</label>
          <div style={{ position: 'relative' }}>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              required
              autoFocus
            />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Password</label>
          <div style={{ position: 'relative' }}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="btn-gradient"
          style={{ width: '100%', padding: '12px 16px', fontSize: 15 }}
          disabled={loading}
        >
          <span>{loading ? 'Signing in…' : 'Sign in to Flowbox'}</span>
          <ArrowRight size={16} />
        </button>

        <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 18 }}>
          Personal Single-User Workspace
        </p>
      </form>
    </div>
  );
}
