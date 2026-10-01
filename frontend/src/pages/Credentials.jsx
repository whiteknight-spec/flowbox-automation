import React, { useEffect, useState } from 'react';
import {
  KeyRound,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Mail,
  Table,
  Globe,
  X,
  ShieldCheck,
} from 'lucide-react';
import Navbar from '../components/Navbar.jsx';
import { api } from '../api.js';

const TYPE_CONFIG = {
  httpHeader: {
    title: 'API Key / HTTP Header',
    category: 'Web Services',
    icon: Globe,
    color: '#38bdf8',
    description: 'Custom authorization header or API key for third-party REST services.',
    fields: [
      { key: 'headerName', label: 'Header name (e.g. Authorization or X-Api-Key)', placeholder: 'Authorization' },
      { key: 'headerValue', label: 'Secret header value', secret: true, placeholder: 'Bearer secret_token_here' },
    ],
  },
  slack: {
    title: 'Slack Webhook',
    category: 'Communication',
    icon: MessageSquare,
    color: '#00e575',
    description: 'Incoming webhook URL to post automated notifications to Slack channels.',
    fields: [
      { key: 'webhookUrl', label: 'Incoming Webhook URL', secret: true, placeholder: 'https://hooks.slack.com/services/...' },
    ],
  },
  smtp: {
    title: 'Email / SMTP Service',
    category: 'Communication',
    icon: Mail,
    color: '#fbbf24',
    description: 'Connect your Gmail, Outlook, Sendgrid, or custom SMTP server to send emails.',
    fields: [
      { key: 'host', label: 'SMTP host', placeholder: 'smtp.gmail.com' },
      { key: 'port', label: 'Port', number: true, placeholder: '587' },
      { key: 'secure', label: 'Use SSL/TLS (true/false)', bool: true, placeholder: 'false' },
      { key: 'user', label: 'Username / Email', placeholder: 'your-email@gmail.com' },
      { key: 'pass', label: 'Password / App Password', secret: true, placeholder: '••••••••••••••••' },
    ],
  },
  googleServiceAccount: {
    title: 'Google Sheets & Cloud',
    category: 'Data & Storage',
    icon: Table,
    color: '#00e575',
    description: 'Service account JSON credentials to read and append rows to Google Sheets.',
    fields: [
      {
        key: 'serviceAccountJson',
        label: 'Google Service Account JSON',
        textarea: true,
        secret: true,
        placeholder: '{"type": "service_account", "project_id": ...}',
      },
    ],
  },
};

export default function Credentials() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [type, setType] = useState('slack');
  const [name, setName] = useState('');
  const [fields, setFields] = useState({});
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.listCredentials();
      setList(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function showToast(msg) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const data = { ...fields };
      const currentConfig = TYPE_CONFIG[type];
      for (const f of currentConfig.fields) {
        if (f.number) data[f.key] = Number(data[f.key]);
        if (f.bool) data[f.key] = String(data[f.key]).toLowerCase() === 'true';
      }

      await api.createCredential({ name, type, data });
      showToast(`Connected "${name}" successfully!`);
      setName('');
      setFields({});
      setModalOpen(false);
      load();
    } catch (err) {
      showToast(`Failed to save credential: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id, credName) {
    if (!confirm(`Disconnect "${credName}"? Workflows using it will stop working.`)) return;
    try {
      await api.deleteCredential(id);
      setList((prev) => prev.filter((c) => c.id !== id));
      showToast(`Disconnected "${credName}"`);
    } catch (err) {
      showToast(`Failed: ${err.message}`);
    }
  }

  return (
    <div className="app-container">
      <Navbar />

      <main className="main-content">
        <div className="page">
          <div className="section-header">
            <div>
              <h1 className="section-title" style={{ fontSize: 28 }}>
                Connected Apps & Integrations
              </h1>
              <p className="section-desc">
                Securely manage credentials and connections for your automated actions.
              </p>
            </div>
            <button
              className="btn-gradient"
              onClick={() => {
                setName('');
                setFields({});
                setModalOpen(true);
              }}
            >
              <Plus size={16} />
              <span>Connect new app</span>
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'rgba(0, 229, 117, 0.05)',
              border: '1px solid var(--neon-green-border)',
              padding: '12px 18px',
              borderRadius: 8,
              color: 'var(--neon-green)',
              fontSize: 13,
              fontWeight: 500,
              margin: '20px 0 28px',
            }}
          >
            <ShieldCheck size={18} />
            <span>
              All API keys and secrets are encrypted with AES-256-GCM before touching the database.
            </span>
          </div>

          {/* Supported Apps Overview */}
          <div className="apps-grid">
            {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
              const IconComponent = cfg.icon;
              const connectedCount = list.filter((c) => c.type === key).length;

              return (
                <div key={key} className="app-card">
                  <div className="app-card-top">
                    <div
                      className="app-icon-wrap"
                      style={{ background: cfg.color }}
                    >
                      <IconComponent size={22} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700 }}>{cfg.title}</h3>
                      <span style={{ fontSize: 12, color: '#64748b' }}>
                        {connectedCount > 0 ? (
                          <span style={{ color: '#059669', fontWeight: 600 }}>
                            ● {connectedCount} connected
                          </span>
                        ) : (
                          'Not configured'
                        )}
                      </span>
                    </div>
                  </div>

                  <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.45 }}>
                    {cfg.description}
                  </p>

                  <div style={{ paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
                    <button
                      className="btn-secondary"
                      style={{ width: '100%', fontSize: 13 }}
                      onClick={() => {
                        setType(key);
                        setName('');
                        setFields({});
                        setModalOpen(true);
                      }}
                    >
                      <Plus size={14} />
                      <span>Connect {cfg.title.split(' ')[0]}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Connections List */}
          <div className="section-header" style={{ marginTop: 24 }}>
            <div>
              <h2 className="section-title" style={{ fontSize: 20 }}>
                Active Credentials ({list.length})
              </h2>
            </div>
          </div>

          {list.length > 0 ? (
            <div className="automations-list">
              {list.map((c) => {
                const cfg = TYPE_CONFIG[c.type] || {
                  title: c.type,
                  icon: KeyRound,
                  color: '#4f46e5',
                };
                const IconComponent = cfg.icon;

                return (
                  <div key={c.id} className="automation-item-card">
                    <div className="item-left">
                      <div
                        className="status-dot-wrap"
                        style={{ background: `${cfg.color}15`, color: cfg.color }}
                      >
                        <IconComponent size={20} />
                      </div>
                      <div className="item-details">
                        <div className="item-title-row">
                          <h3 className="item-title">{c.name}</h3>
                          <span className="item-app-badge">{cfg.title}</span>
                        </div>
                        <div className="item-meta-row">
                          <span>🟢 Active & Encrypted</span>
                          <span className="meta-split">·</span>
                          <span>Added {c.created_at ? new Date(c.created_at).toLocaleDateString() : 'recently'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="item-right">
                      <button
                        className="btn-secondary"
                        style={{ color: '#dc2626', borderColor: '#fecaca' }}
                        onClick={() => remove(c.id, c.name)}
                      >
                        <Trash2 size={14} />
                        <span>Disconnect</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon-wrap">
                <KeyRound size={24} />
              </div>
              <h3 className="empty-title">No connections added yet</h3>
              <p className="empty-desc">
                Connect your Slack webhook, Email SMTP, or Google Sheets to enable notifications and actions.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Connect Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="wizard-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wizard-header">
              <div>
                <span className="wizard-step-label">Add Integration</span>
                <h3 className="wizard-title" style={{ fontSize: 18 }}>
                  Connect {TYPE_CONFIG[type]?.title}
                </h3>
              </div>
              <button
                className="btn-subtle"
                onClick={() => setModalOpen(false)}
                style={{ padding: 6 }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="wizard-body">
                <label style={{ fontSize: 13, fontWeight: 600 }}>Integration Type</label>
                <select
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value);
                    setFields({});
                  }}
                >
                  <option value="slack">Slack Incoming Webhook</option>
                  <option value="smtp">Email / SMTP Server</option>
                  <option value="googleServiceAccount">Google Sheets Service Account</option>
                  <option value="httpHeader">HTTP API Key / Header</option>
                </select>

                <label style={{ fontSize: 13, fontWeight: 600 }}>Connection Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. My Team Slack, Work Gmail, Production API"
                  required
                />

                {TYPE_CONFIG[type].fields.map((f) => (
                  <div key={f.key} style={{ marginTop: 10 }}>
                    <label style={{ fontSize: 13, fontWeight: 600 }}>{f.label}</label>
                    {f.textarea ? (
                      <textarea
                        rows={5}
                        value={fields[f.key] || ''}
                        onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
                        placeholder={f.placeholder}
                        required
                      />
                    ) : (
                      <input
                        type={f.secret ? 'password' : 'text'}
                        value={fields[f.key] || ''}
                        onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
                        placeholder={f.placeholder}
                        required
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="wizard-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-gradient" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Connection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="toast">
          <CheckCircle2 size={18} color="var(--neon-green)" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
