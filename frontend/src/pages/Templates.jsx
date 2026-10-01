import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  Mail,
  Video,
  Folder,
  Bell,
  Table,
  Globe,
  CheckCircle2,
} from 'lucide-react';
import Navbar from '../components/Navbar.jsx';
import AutomationWizard from '../components/AutomationWizard.jsx';
import QuoteVideoWizard from '../components/QuoteVideoWizard.jsx';
import { AUTOMATION_TEMPLATES } from '../utils/templateDefinitions.js';
import { api } from '../api.js';

export default function Templates() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardInitialData, setWizardInitialData] = useState(null);
  const [quoteWizardOpen, setQuoteWizardOpen] = useState(false);
  const [quoteWizardInitialData, setQuoteWizardInitialData] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const navigate = useNavigate();

  const categories = ['All', 'Email & Inbox', 'Social & Media', 'Productivity', 'Notifications', 'Data & Sync', 'Reporting'];

  function showToast(msg) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }

  const filteredTemplates = AUTOMATION_TEMPLATES.filter((tpl) => {
    if (selectedCategory === 'All') return true;
    return tpl.category.toLowerCase().includes(selectedCategory.toLowerCase());
  });

  function renderTemplateIcon(iconName) {
    switch (iconName) {
      case 'Mail': return <Mail size={22} color="var(--neon-green)" />;
      case 'Video': return <Video size={22} color="var(--gold-bright)" />;
      case 'Folder': return <Folder size={22} color="#94a3b8" />;
      case 'Bell': return <Bell size={22} color="var(--gold-accent)" />;
      case 'Table': return <Table size={22} color="var(--neon-green)" />;
      default: return <Globe size={22} color="#38bdf8" />;
    }
  }

  function handleUseTemplate(tpl) {
    if (tpl.isQuoteVideo || tpl.id === 'daily-quote-video') {
      setQuoteWizardInitialData({ ...tpl, isExistingWorkflow: false });
      setQuoteWizardOpen(true);
      return;
    }
    setWizardInitialData({
      ...tpl,
      suggestedName: tpl.defaultName,
    });
    setWizardOpen(true);
  }

  return (
    <div className="app-container">
      <Navbar onOpenWizard={() => { setWizardInitialData(null); setWizardOpen(true); }} />

      <main className="main-content">
        <div className="page">
          <div className="section-header">
            <div>
              <h1 className="section-title" style={{ fontSize: 28 }}>
                Automation Templates
              </h1>
              <p className="section-desc">
                Browse ready-to-run automation recipes crafted for everyday productivity.
              </p>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="automations-toolbar" style={{ marginTop: 24, marginBottom: 24 }}>
            <div className="filter-tabs" style={{ flexWrap: 'wrap' }}>
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={`filter-tab ${selectedCategory === cat ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Templates Grid */}
          <div className="templates-grid">
            {filteredTemplates.map((tpl) => (
              <div key={tpl.id} className="template-card" style={{ minHeight: 240 }}>
                <div>
                  <div className="template-card-top">
                    <div
                      className="template-icon-wrap"
                      style={{ background: `${tpl.color}15` }}
                    >
                      {renderTemplateIcon(tpl.icon)}
                    </div>
                    <div className="template-meta">
                      <h3 className="template-title">{tpl.title}</h3>
                      <p className="template-desc">{tpl.description}</p>
                    </div>
                  </div>

                  <div
                    style={{
                      background: '#090c12',
                      borderRadius: 8,
                      padding: '12px 14px',
                      fontSize: 13,
                      margin: '12px 0 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div>
                      <strong style={{ color: 'var(--text-secondary)' }}>When: </strong>
                      <span style={{ color: '#ffffff' }}>{tpl.friendlyWhen}</span>
                    </div>
                    <div>
                      <strong style={{ color: 'var(--text-secondary)' }}>Action: </strong>
                      <span style={{ color: '#ffffff' }}>{tpl.friendlyThen}</span>
                    </div>
                  </div>
                </div>

                <div className="template-card-bottom">
                  <span className="template-category">{tpl.category}</span>
                  <button
                    className="btn-gradient"
                    style={{ padding: '8px 16px', fontSize: 13 }}
                    onClick={() => handleUseTemplate(tpl)}
                  >
                    <span>Use template</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <AutomationWizard
        isOpen={wizardOpen}
        initialData={wizardInitialData}
        onClose={() => setWizardOpen(false)}
        onSaved={(newWf) => {
          showToast(`Successfully created "${newWf.name}"!`);
          navigate('/automations');
        }}
        onOpenAdvanced={(wfDraft) => {
          setWizardOpen(false);
          api
            .createWorkflow({
              name: wfDraft.name,
              definition: wfDraft.definition,
              active: false,
            })
            .then(({ data }) => {
              navigate(`/workflows/${data.id}`);
            });
        }}
      />

      <QuoteVideoWizard
        isOpen={quoteWizardOpen}
        initialData={quoteWizardInitialData}
        onClose={() => setQuoteWizardOpen(false)}
        onSaved={(newWf) => {
          showToast(`Successfully created "${newWf.name}"!`);
          navigate('/automations');
        }}
      />

      {toastMessage && (
        <div className="toast">
          <CheckCircle2 size={18} color="var(--neon-green)" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
