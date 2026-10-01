import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Plus,
  Play,
  ArrowRight,
  Edit3,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  Search,
  Sliders,
  Terminal,
  Trash2,
  RotateCw,
  Mail,
  Video,
  Folder,
  Bell,
  Table,
  Globe,
} from 'lucide-react';
import Navbar from '../components/Navbar.jsx';
import AutomationWizard from '../components/AutomationWizard.jsx';
import QuoteVideoWizard from '../components/QuoteVideoWizard.jsx';
import { api } from '../api.js';
import { parseAutomationIntent } from '../utils/intentParser.js';
import { AUTOMATION_TEMPLATES } from '../utils/templateDefinitions.js';
import { summarizeWorkflow } from '../utils/workflowSummarizer.js';

export default function Dashboard() {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [promptText, setPromptText] = useState('');
  const [parsedIntent, setParsedIntent] = useState(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardInitialData, setWizardInitialData] = useState(null);
  const [quoteWizardOpen, setQuoteWizardOpen] = useState(false);
  const [quoteWizardInitialData, setQuoteWizardInitialData] = useState(null);
  const [filter, setFilter] = useState('all'); // all | active | paused
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [runningWorkflowId, setRunningWorkflowId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [quoteJobs, setQuoteJobs] = useState({});
  const [preparingQuoteId, setPreparingQuoteId] = useState(null);

  const navigate = useNavigate();

  // Load workflows
  async function loadWorkflows() {
    try {
      const { data } = await api.listWorkflows();
      setWorkflows(data);

      // Fetch latest quote preparation job for quote video workflows
      for (const wf of data) {
        const isQuote =
          wf.name === 'Daily Quote Video' ||
          wf.definition?.nodes?.some(
            (n) => n.config?.templateType === 'dailyQuoteVideo' || n.type === 'quoteVideo'
          );
        if (isQuote) {
          api
            .getLatestQuoteJob(wf.id)
            .then((res) => {
              if (res.data?.job) {
                setQuoteJobs((prev) => ({ ...prev, [wf.id]: res.data.job }));
              }
            })
            .catch(() => {});
        }
      }
    } catch (err) {
      console.error('Failed to load workflows', err);
    } finally {
      setLoading(false);
    }
  }

  // Manual Test Action: "Prepare next quote"
  async function handlePrepareNextQuote(wf) {
    setPreparingQuoteId(wf.id);
    try {
      const res = await api.prepareQuote(wf.id);
      setQuoteJobs((prev) => ({ ...prev, [wf.id]: res.data }));
      const langName = res.data.language === 'ta' ? 'Tamil' : 'English';
      showToast(`Prepared quote: ${res.data.topic} (${langName})`);
    } catch (err) {
      showToast('Failed to prepare quote: ' + (err.response?.data?.details || err.message));
    } finally {
      setPreparingQuoteId(null);
    }
  }

  useEffect(() => {
    loadWorkflows();
  }, []);

  function showToast(msg) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }

  // Handle Natural Language Prompt
  function handlePromptSubmit(e) {
    if (e) e.preventDefault();
    if (!promptText.trim()) return;
    const parsed = parseAutomationIntent(promptText);
    setParsedIntent(parsed);
  }

  // Set prompt from suggested chips
  function handleChipClick(chipText) {
    setPromptText(chipText);
    const parsed = parseAutomationIntent(chipText);
    setParsedIntent(parsed);
  }

  // Open Wizard with Template
  function handleSelectTemplate(tpl) {
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

  // Toggle Active/Paused state
  async function handleToggleActive(wf) {
    const updatedActive = !wf.active;
    // Optimistic update
    setWorkflows((prev) =>
      prev.map((item) => (item.id === wf.id ? { ...item, active: updatedActive } : item))
    );
    try {
      await api.updateWorkflow(wf.id, {
        name: wf.name,
        definition: wf.definition,
        active: updatedActive,
      });
      showToast(`${wf.name} is now ${updatedActive ? 'active' : 'paused'}`);
    } catch (err) {
      loadWorkflows();
      showToast('Failed to update automation status');
    }
  }

  // Run Now
  async function handleRunNow(wf) {
    setRunningWorkflowId(wf.id);
    try {
      const res = await api.runWorkflow(wf.id, {});
      const status = res.data.status;
      if (status === 'error') {
        showToast(`Run completed with warnings`);
      } else {
        showToast(`⚡ ${wf.name} ran successfully!`);
        // Refresh quote job if quote video workflow
        if (
          wf.name === 'Daily Quote Video' ||
          wf.definition?.nodes?.some(
            (n) => n.config?.templateType === 'dailyQuoteVideo' || n.type === 'quoteVideo'
          )
        ) {
          api
            .getLatestQuoteJob(wf.id)
            .then((r) => {
              if (r.data?.job) {
                setQuoteJobs((prev) => ({ ...prev, [wf.id]: r.data.job }));
              }
            })
            .catch(() => {});
        }
      }
    } catch (err) {
      showToast(`Error running ${wf.name}: ${err.message}`);
    } finally {
      setRunningWorkflowId(null);
    }
  }

  // Delete Automation
  async function handleDelete(id, name) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await api.deleteWorkflow(id);
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
      showToast(`Deleted ${name}`);
    } catch (err) {
      showToast('Failed to delete workflow');
    }
  }

  // Filter and Search Workflows
  const filteredWorkflows = useMemo(() => {
    return workflows.filter((wf) => {
      const matchesFilter =
        filter === 'all'
          ? true
          : filter === 'active'
          ? wf.active
          : !wf.active;

      const matchesSearch =
        !searchQuery ||
        wf.name.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesFilter && matchesSearch;
    });
  }, [workflows, filter, searchQuery]);

  // Template icon helper
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

  return (
    <div className="app-container" onClick={() => setActiveMenuId(null)}>
      <Navbar
        workflowCount={workflows.length}
        onOpenWizard={() => {
          setWizardInitialData(null);
          setWizardOpen(true);
        }}
      />

      <main className="main-content">
        <div className="page">
          {/* 1. HERO SECTION */}
          <section className="hero-section">
            <div className="hero-glow" />
            {/* Subtle organic flowing energy lines backdrop */}
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: '100%',
                maxWidth: 900,
                height: 280,
                pointerEvents: 'none',
                opacity: 0.18,
                zIndex: 0,
              }}
              viewBox="0 0 900 280"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M-50 140 C 200 40, 350 220, 600 90 C 750 10, 850 180, 950 130"
                stroke="url(#neon-gradient-1)"
                strokeWidth="1.5"
                strokeDasharray="4 8"
              />
              <path
                d="M-20 180 C 240 90, 420 260, 680 120 C 800 50, 880 200, 980 160"
                stroke="url(#gold-gradient-1)"
                strokeWidth="1.2"
              />
              <defs>
                <linearGradient id="neon-gradient-1" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#00e575" stopOpacity="0" />
                  <stop offset="50%" stopColor="#00e575" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#00e575" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="gold-gradient-1" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0" />
                  <stop offset="60%" stopColor="#fbbf24" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#00e575" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
            <div className="hero-content">
              <h1 className="hero-title">
                Automate the things you do again and again.
              </h1>
              <p className="hero-subtitle">
                No coding required. Tell us what you want to happen, or start with
                a ready-made automation.
              </p>

              <div className="hero-actions">
                <button
                  className="btn-gradient"
                  style={{ padding: '10px 22px', fontSize: 14 }}
                  onClick={() => {
                    setWizardInitialData(null);
                    setWizardOpen(true);
                  }}
                >
                  <Plus size={17} strokeWidth={2.5} />
                  <span>Create automation</span>
                </button>
                <button
                  className="btn-secondary"
                  style={{ padding: '10px 18px', fontSize: 14 }}
                  onClick={() => {
                    const el = document.getElementById('popular-templates');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  <span>Browse ready-made templates</span>
                </button>
              </div>

              {/* AI Natural Language Input */}
              <div className="ai-prompt-wrapper">
                <form onSubmit={handlePromptSubmit} className="ai-input-row">
                  <div className="ai-sparkle-icon">
                    <Sparkles size={20} />
                  </div>
                  <input
                    className="ai-input"
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    placeholder="Tell Flowbox what you want to automate..."
                  />
                  <button type="submit" className="ai-submit-btn">
                    <span>Create</span>
                    <ArrowRight size={16} />
                  </button>
                </form>

                {/* Prompt Suggestions */}
                <div className="ai-chips-row">
                  <span className="ai-chips-label">Try asking:</span>
                  <button
                    type="button"
                    className="ai-chip"
                    onClick={() => handleChipClick('Every morning, clean my promotional emails.')}
                  >
                    📧 Clean promotional emails every morning
                  </button>
                  <button
                    type="button"
                    className="ai-chip"
                    onClick={() => handleChipClick('Every day at 7 PM post my videos to social channels.')}
                  >
                    🎬 Post videos daily at 7 PM
                  </button>
                  <button
                    type="button"
                    className="ai-chip"
                    onClick={() => handleChipClick('Send me a Slack alert when urgent webhook arrives.')}
                  >
                    🔔 Slack alert on urgent events
                  </button>
                </div>

                {/* Natural Language Preview Card */}
                {parsedIntent && (
                  <div className="ai-preview-card">
                    <div className="ai-preview-header">
                      <div className="ai-understood-badge">
                        <CheckCircle2 size={16} color="var(--neon-green)" />
                        <span>I understood this as:</span>
                      </div>
                      <span className="ai-app-tag">{parsedIntent.appBadge}</span>
                    </div>

                    <div className="ai-preview-grid">
                      <div className="ai-preview-col">
                        <span className="ai-col-label">When</span>
                        <span className="ai-col-value">{parsedIntent.whenText}</span>
                      </div>
                      <div className="ai-preview-col">
                        <span className="ai-col-label">If</span>
                        <span className="ai-col-value">{parsedIntent.ifText}</span>
                      </div>
                      <div className="ai-preview-col">
                        <span className="ai-col-label">Then</span>
                        <span className="ai-col-value">{parsedIntent.thenText}</span>
                      </div>
                    </div>

                    <div className="ai-preview-actions">
                      <button
                        className="btn-secondary"
                        onClick={() => {
                          setWizardInitialData({
                            ...parsedIntent,
                            jumpToReview: false,
                          });
                          setWizardOpen(true);
                        }}
                      >
                        <Edit3 size={15} />
                        <span>Edit</span>
                      </button>
                      <button
                        className="btn-gradient"
                        onClick={() => {
                          setWizardInitialData({
                            ...parsedIntent,
                            jumpToReview: true,
                          });
                          setWizardOpen(true);
                        }}
                      >
                        <span>Looks good</span>
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 2. POPULAR AUTOMATIONS SECTION */}
          <section id="popular-templates" style={{ marginBottom: 48 }}>
            <div className="section-header">
              <div>
                <h2 className="section-title">Popular Automations</h2>
                <p className="section-desc">
                  Start instantly with pre-configured automations tailored for normal workflows.
                </p>
              </div>
            </div>

            <div className="templates-grid">
              {AUTOMATION_TEMPLATES.map((tpl) => (
                <div key={tpl.id} className="template-card">
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
                  </div>

                  <div className="template-card-bottom">
                    <span className="template-category">{tpl.category}</span>
                    <button
                      className="btn-secondary"
                      style={{ padding: '6px 14px', fontSize: 13 }}
                      onClick={() => handleSelectTemplate(tpl)}
                    >
                      <span>Set up</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 3. MY AUTOMATIONS SECTION */}
          <section>
            <div className="section-header">
              <div>
                <h2 className="section-title">My Automations</h2>
                <p className="section-desc">
                  Manage your active and paused automated tasks.
                </p>
              </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="automations-toolbar">
              <div className="filter-tabs">
                <button
                  className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
                  onClick={() => setFilter('all')}
                >
                  All ({workflows.length})
                </button>
                <button
                  className={`filter-tab ${filter === 'active' ? 'active' : ''}`}
                  onClick={() => setFilter('active')}
                >
                  Active ({workflows.filter((w) => w.active).length})
                </button>
                <button
                  className={`filter-tab ${filter === 'paused' ? 'active' : ''}`}
                  onClick={() => setFilter('paused')}
                >
                  Paused ({workflows.filter((w) => !w.active).length})
                </button>
              </div>

              <div className="search-input-wrap">
                <Search size={15} className="search-icon" />
                <input
                  className="search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search automations…"
                />
              </div>
            </div>

            {/* Automations List */}
            {filteredWorkflows.length > 0 ? (
              <div className="automations-list">
                {filteredWorkflows.map((wf) => {
                  const summary = summarizeWorkflow(wf);
                  const isRunning = runningWorkflowId === wf.id;
                  const isQuote =
                    wf.name === 'Daily Quote Video' ||
                    wf.definition?.nodes?.some(
                      (n) => n.config?.templateType === 'dailyQuoteVideo' || n.type === 'quoteVideo'
                    );
                  const prepJob = quoteJobs[wf.id];

                  return (
                    <div
                      key={wf.id}
                      className="automation-item-card"
                      style={{ flexDirection: 'column', alignItems: 'stretch' }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 20,
                          width: '100%',
                        }}
                      >
                        <div className="item-left">
                          <div className="status-dot-wrap">
                            <Zap size={20} />
                            <span
                              className={`status-badge-dot ${wf.active ? 'active' : 'inactive'}`}
                              title={wf.active ? 'Active' : 'Paused'}
                            />
                          </div>

                          <div className="item-details">
                            <div className="item-title-row">
                              <h3 className="item-title">{wf.name}</h3>
                              <span className="item-app-badge">{summary.appBadge}</span>
                            </div>

                            <div className="item-meta-row">
                              <span>
                                {wf.active ? '🟢 Active' : '⏸ Paused'}
                              </span>
                              <span className="meta-split">·</span>
                              <span>{summary.scheduleText}</span>
                              <span className="meta-split">·</span>
                              <span>Next: {summary.nextRunText}</span>
                            </div>
                          </div>
                        </div>

                        <div className="item-right">
                          {/* Run Now Button */}
                          <button
                            className="btn-secondary"
                            style={{ padding: '7px 12px', fontSize: 13 }}
                            disabled={isRunning}
                            onClick={() => handleRunNow(wf)}
                            title="Trigger a test run right now"
                          >
                            {isRunning ? (
                              <RotateCw className="spin" size={14} />
                            ) : (
                              <Play size={14} />
                            )}
                            <span>{isRunning ? 'Running…' : 'Run'}</span>
                          </button>

                          {/* Enable/Disable Toggle */}
                          <label className="switch" title={wf.active ? 'Pause automation' : 'Activate automation'}>
                            <input
                              type="checkbox"
                              checked={!!wf.active}
                              onChange={() => handleToggleActive(wf)}
                            />
                            <span className="slider" />
                          </label>

                          {/* Edit Button */}
                          <button
                            className="btn-secondary"
                            style={{ padding: '7px 12px', fontSize: 13 }}
                            onClick={() => {
                              if (isQuote) {
                                setQuoteWizardInitialData({
                                  ...wf,
                                  isExistingWorkflow: true,
                                  jumpToReview: true,
                                });
                                setQuoteWizardOpen(true);
                              } else {
                                setWizardInitialData({
                                  id: wf.id,
                                  name: wf.name,
                                  definition: wf.definition,
                                  active: wf.active,
                                  jumpToReview: true,
                                });
                                setWizardOpen(true);
                              }
                            }}
                          >
                            <Edit3 size={14} />
                            <span>Edit</span>
                          </button>

                          {/* Three Dots Menu */}
                          <div className="menu-wrap" onClick={(e) => e.stopPropagation()}>
                            <button
                              className="btn-subtle"
                              style={{ padding: '7px' }}
                              onClick={() =>
                                setActiveMenuId(activeMenuId === wf.id ? null : wf.id)
                              }
                            >
                              <MoreVertical size={16} />
                            </button>

                            {activeMenuId === wf.id && (
                              <div className="menu-dropdown">
                                <button
                                  className="menu-item"
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    navigate(`/workflows/${wf.id}`);
                                  }}
                                >
                                  <Terminal size={14} />
                                  <span>Open in Advanced Canvas</span>
                                </button>
                                <button
                                  className="menu-item danger"
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    handleDelete(wf.id, wf.name);
                                  }}
                                >
                                  <Trash2 size={14} />
                                  <span>Delete automation</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* DAILY QUOTE VIDEO: Today's Preparation View */}
                      {isQuote && (
                        prepJob ? (
                          <div className="quote-prep-panel">
                            <div className="quote-prep-header">
                              <div className="quote-prep-title-group">
                                <span className="quote-prep-badge">🎬 Today’s preparation</span>
                                <span className="quote-prep-tag">
                                  {prepJob.language === 'ta' ? '🇮🇳 Tamil' : '🇬🇧 English'}
                                </span>
                                <span className="quote-prep-tag">
                                  {prepJob.spec?.topic?.emoji || '🔥'} {prepJob.spec?.topic?.label || prepJob.topic}
                                </span>
                              </div>
                              <button
                                className="btn-secondary"
                                style={{ padding: '4px 10px', fontSize: 12 }}
                                disabled={preparingQuoteId === wf.id}
                                onClick={() => handlePrepareNextQuote(wf)}
                                title="Advance rotation and prepare next quote"
                              >
                                <RotateCw className={preparingQuoteId === wf.id ? 'spin' : ''} size={12} />
                                <span>{preparingQuoteId === wf.id ? 'Preparing…' : 'Prepare next quote'}</span>
                              </button>
                            </div>

                            <div className="quote-prep-body">
                              <p className="quote-prep-text">“{prepJob.quote}”</p>
                              {prepJob.explanation && (
                                <p className="quote-prep-explanation">{prepJob.explanation}</p>
                              )}
                            </div>

                            <div className="quote-prep-meta-row">
                              <span className="quote-prep-chip">⏱️ {prepJob.duration || 15} seconds</span>
                              <span className="quote-prep-chip">📐 1080 × 1920 (9:16)</span>
                              <span className="quote-prep-chip">📱 Instagram + YouTube Shorts</span>
                              <span className="quote-prep-chip">
                                🎨 Visual: {prepJob.visualStrategy?.style || prepJob.spec?.visual?.style || 'Adaptive'}
                              </span>
                              <span className="quote-prep-chip">
                                🎵 Audio: {prepJob.audioStrategy?.preference === 'none' ? 'Silent' : 'Approved Ambient'}
                              </span>
                              {prepJob.renderStatus === 'rendered' ? (
                                <span className="quote-prep-chip success">🎬 Video: Rendered (MP4)</span>
                              ) : prepJob.renderStatus === 'rendering' ? (
                                <span className="quote-prep-chip info">⏳ Video: Rendering…</span>
                              ) : prepJob.renderStatus === 'requires_review' ? (
                                <span className="quote-prep-chip warning">⚠️ Needs Review</span>
                              ) : prepJob.renderStatus === 'render_failed' ? (
                                <span className="quote-prep-chip danger">❌ Video: Render Failed</span>
                              ) : (
                                <span className="quote-prep-chip warning">🎬 Video: Not rendered yet</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="quote-prep-empty">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Sparkles size={14} color="var(--neon-green)" />
                              <span style={{ fontSize: 13, color: '#94a3b8' }}>
                                Content preparation engine ready. Click to prepare the first quote job on-demand.
                              </span>
                            </div>
                            <button
                              className="btn-secondary"
                              style={{ padding: '5px 12px', fontSize: 12 }}
                              disabled={preparingQuoteId === wf.id}
                              onClick={() => handlePrepareNextQuote(wf)}
                            >
                              <Sparkles size={12} />
                              <span>{preparingQuoteId === wf.id ? 'Preparing…' : 'Prepare next quote'}</span>
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon-wrap">
                  <Sparkles size={24} />
                </div>
                <h3 className="empty-title">No automations found</h3>
                <p className="empty-desc">
                  {searchQuery
                    ? 'No automations match your search filter.'
                    : 'Start by creating your first automated flow or choose from popular templates above.'}
                </p>
                <button
                  className="btn-gradient"
                  onClick={() => {
                    setWizardInitialData(null);
                    setWizardOpen(true);
                  }}
                >
                  <Plus size={16} />
                  <span>Create automation</span>
                </button>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Guided Automation Wizard */}
      <AutomationWizard
        isOpen={wizardOpen}
        initialData={wizardInitialData}
        onClose={() => setWizardOpen(false)}
        onSaved={(newWf) => {
          loadWorkflows();
          showToast(`Saved "${newWf.name}"!`);
        }}
        onOpenAdvanced={(wfDraft) => {
          setWizardOpen(false);
          // If already saved or create new and navigate
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

      {/* Daily Quote Video Configuration Wizard */}
      <QuoteVideoWizard
        isOpen={quoteWizardOpen}
        initialData={quoteWizardInitialData}
        onClose={() => setQuoteWizardOpen(false)}
        onSaved={(newWf) => {
          loadWorkflows();
          showToast(`Saved "${newWf.name}"!`);
        }}
      />

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="toast">
          <CheckCircle2 size={18} color="var(--neon-green)" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
