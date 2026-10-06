import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layers,
  Plus,
  Play,
  Edit3,
  MoreVertical,
  Search,
  Zap,
  Terminal,
  Trash2,
  RotateCw,
  CheckCircle2,
  Film,
  Sparkles,
  X,
} from 'lucide-react';
import Navbar from '../components/Navbar.jsx';
import AutomationWizard from '../components/AutomationWizard.jsx';
import QuoteVideoWizard from '../components/QuoteVideoWizard.jsx';
import QuoteVideoReviewModal from '../components/QuoteVideoReviewModal.jsx';
import { api } from '../api.js';
import { summarizeWorkflow } from '../utils/workflowSummarizer.js';

export default function Automations() {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardInitialData, setWizardInitialData] = useState(null);
  const [quoteWizardOpen, setQuoteWizardOpen] = useState(false);
  const [quoteWizardInitialData, setQuoteWizardInitialData] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [runningWorkflowId, setRunningWorkflowId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [quoteJobs, setQuoteJobs] = useState({});
  const [preparingQuoteId, setPreparingQuoteId] = useState(null);
  const [renderingJobId, setRenderingJobId] = useState(null);
  const [previewVideoJob, setPreviewVideoJob] = useState(null);

  const navigate = useNavigate();

  async function loadWorkflows() {
    try {
      const res = await api.listWorkflows();
      const raw = res?.data;
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.workflows)
        ? raw.workflows
        : Array.isArray(raw?.data)
        ? raw.data
        : [];
      setWorkflows(list);

      for (const wf of list) {
        try {
          let def = wf.definition;
          if (typeof def === 'string') {
            try { def = JSON.parse(def); } catch (_) {}
          }
          const isQuote =
            wf.name === 'Daily Quote Video' ||
            def?.nodes?.some(
              (n) => n.config?.templateType === 'dailyQuoteVideo' || n.type === 'quoteVideo'
            );
          if (isQuote) {
            api
              .getLatestQuoteJob(wf.id)
              .then((jobRes) => {
                if (jobRes?.data?.job) {
                  setQuoteJobs((prev) => ({ ...prev, [wf.id]: jobRes.data.job }));
                }
              })
              .catch(() => {});
          }
        } catch (_) {}
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

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

  async function handleRenderVideo(wf, job, force = false) {
    if (!job || !wf) return;
    setRenderingJobId(job.id);
    showToast('Rendering 1080×1920 MP4 video…');
    try {
      const res = await api.renderQuoteJob(wf.id, job.id, { force });
      const updatedJob = { ...job, ...res.data };
      setQuoteJobs((prev) => ({ ...prev, [wf.id]: updatedJob }));
      showToast('🎬 Video rendered successfully! (1080×1920 MP4)');
    } catch (err) {
      const errMsg = err.response?.data?.details || err.message;
      showToast('Render failed: ' + errMsg);
      // Refresh latest job to sync status
      api.getLatestQuoteJob(wf.id).then((r) => {
        if (r.data?.job) setQuoteJobs((prev) => ({ ...prev, [wf.id]: r.data.job }));
      }).catch(() => {});
    } finally {
      setRenderingJobId(null);
    }
  }

  useEffect(() => {
    loadWorkflows();
  }, []);

  function showToast(msg) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }

  async function handleToggleActive(wf) {
    const updatedActive = !wf.active;
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
      showToast('Failed to update status');
    }
  }

  async function handleRunNow(wf) {
    setRunningWorkflowId(wf.id);
    try {
      await api.runWorkflow(wf.id, {});
      showToast(`⚡ ${wf.name} ran successfully!`);
      if (
        wf.name === 'Daily Quote Video' ||
        wf.definition?.nodes?.some(
          (n) => n.config?.templateType === 'dailyQuoteVideo' || n.type === 'quoteVideo'
        )
      ) {
        api.getLatestQuoteJob(wf.id).then((r) => {
          if (r.data?.job) {
            setQuoteJobs((prev) => ({ ...prev, [wf.id]: r.data.job }));
          }
        }).catch(() => {});
      }
    } catch (err) {
      showToast(`Error: ${err.message}`);
    } finally {
      setRunningWorkflowId(null);
    }
  }

  async function handleDelete(id, name) {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await api.deleteWorkflow(id);
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
      showToast(`Deleted ${name}`);
    } catch (err) {
      showToast('Failed to delete workflow');
    }
  }

  const filtered = useMemo(() => {
    return (workflows || []).filter((wf) => {
      const matchesFilter =
        filter === 'all'
          ? true
          : filter === 'active'
          ? Boolean(wf.active)
          : !wf.active;

      const matchesSearch =
        !searchQuery ||
        (wf.name || '').toLowerCase().includes(searchQuery.toLowerCase());

      return matchesFilter && matchesSearch;
    });
  }, [workflows, filter, searchQuery]);

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
          <div className="section-header">
            <div>
              <h1 className="section-title" style={{ fontSize: 28 }}>
                All Automations
              </h1>
              <p className="section-desc">
                Review, trigger, pause, or configure all your personal automated workflows.
              </p>
            </div>
            <button
              className="btn-gradient"
              onClick={() => {
                setWizardInitialData(null);
                setWizardOpen(true);
              }}
            >
              <Plus size={16} />
              <span>New automation</span>
            </button>
          </div>

          <div className="automations-toolbar" style={{ marginTop: 24 }}>
            <div className="filter-tabs">
              <button
                className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All ({(workflows || []).length})
              </button>
              <button
                className={`filter-tab ${filter === 'active' ? 'active' : ''}`}
                onClick={() => setFilter('active')}
              >
                Active ({(workflows || []).filter((w) => Boolean(w.active)).length})
              </button>
              <button
                className={`filter-tab ${filter === 'paused' ? 'active' : ''}`}
                onClick={() => setFilter('paused')}
              >
                Paused ({(workflows || []).filter((w) => !w.active).length})
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

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              <RotateCw className="spin" size={24} style={{ margin: '0 auto 12px', display: 'block' }} />
              <p style={{ margin: 0, fontSize: 14 }}>Loading automations…</p>
            </div>
          ) : filtered.length > 0 ? (
            <div className="automations-list">
              {filtered.map((wf) => {
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
                            <span>{wf.active ? '🟢 Active' : '⏸ Paused'}</span>
                            <span className="meta-split">·</span>
                            <span>{summary.scheduleText}</span>
                            <span className="meta-split">·</span>
                            <span>Next: {summary.nextRunText}</span>
                          </div>
                        </div>
                      </div>

                      <div className="item-right">
                        <button
                          className="btn-secondary"
                          style={{ padding: '7px 12px', fontSize: 13 }}
                          disabled={isRunning}
                          onClick={() => handleRunNow(wf)}
                        >
                          {isRunning ? (
                            <RotateCw className="spin" size={14} />
                          ) : (
                            <Play size={14} />
                          )}
                          <span>{isRunning ? 'Running…' : 'Run'}</span>
                        </button>

                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={!!wf.active}
                            onChange={() => handleToggleActive(wf)}
                          />
                          <span className="slider" />
                        </label>

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
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {prepJob.reviewStatus === 'approved' || prepJob.review_status === 'approved' ? (
                                <button
                                  className="btn-gradient"
                                  style={{ padding: '5px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                                  onClick={() => setPreviewVideoJob(prepJob)}
                                  title="Preview approved video"
                                >
                                  <Film size={13} />
                                  <span>Preview</span>
                                </button>
                              ) : prepJob.renderStatus === 'rendered' ? (
                                <>
                                  <button
                                    className="btn-gradient"
                                    style={{ padding: '5px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                                    onClick={() => setPreviewVideoJob(prepJob)}
                                    title="Preview rendered 1080×1920 MP4 video"
                                  >
                                    <Film size={13} />
                                    <span>Preview</span>
                                  </button>
                                  <button
                                    className="btn-secondary"
                                    style={{ padding: '4px 10px', fontSize: 12 }}
                                    disabled={renderingJobId === prepJob.id}
                                    onClick={() => handleRenderVideo(wf, prepJob, true)}
                                    title="Re-render video"
                                  >
                                    <RotateCw className={renderingJobId === prepJob.id ? 'spin' : ''} size={12} />
                                    <span>{renderingJobId === prepJob.id ? 'Rendering…' : 'Re-render'}</span>
                                  </button>
                                </>
                              ) : prepJob.renderStatus === 'rendering' || renderingJobId === prepJob.id ? (
                                <button
                                  className="btn-secondary"
                                  style={{ padding: '5px 12px', fontSize: 12, opacity: 0.8 }}
                                  disabled
                                >
                                  <RotateCw className="spin" size={12} />
                                  <span>Rendering…</span>
                                </button>
                              ) : prepJob.renderStatus === 'render_failed' ? (
                                <button
                                  className="btn-secondary"
                                  style={{ padding: '5px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, color: '#f87171' }}
                                  onClick={() => handleRenderVideo(wf, prepJob, true)}
                                  title="Retry video rendering"
                                >
                                  <RotateCw size={12} />
                                  <span>Retry Render</span>
                                </button>
                              ) : prepJob.renderStatus === 'requires_review' ? (
                                <button
                                  className="btn-secondary"
                                  style={{ padding: '5px 12px', fontSize: 12, color: 'var(--gold-bright)' }}
                                  disabled
                                  title={prepJob.errorMessage || 'Tamil content requires human linguistic review'}
                                >
                                  <span>⚠️ Review Required</span>
                                </button>
                              ) : (
                                <button
                                  className="btn-gradient"
                                  style={{ padding: '5px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                                  disabled={renderingJobId === prepJob.id}
                                  onClick={() => handleRenderVideo(wf, prepJob)}
                                  title="Render video MP4"
                                >
                                  <Film size={13} />
                                  <span>Render Video</span>
                                </button>
                              )}

                              <button
                                className="btn-secondary"
                                style={{ padding: '4px 10px', fontSize: 12 }}
                                disabled={preparingQuoteId === wf.id}
                                onClick={() => handlePrepareNextQuote(wf)}
                                title="Advance rotation and prepare next quote"
                              >
                                <RotateCw className={preparingQuoteId === wf.id ? 'spin' : ''} size={12} />
                                <span>{preparingQuoteId === wf.id ? 'Preparing…' : 'Prepare next'}</span>
                              </button>
                            </div>
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
                              🎨 Visual: {prepJob.visualStrategy?.visualTitle || prepJob.visualStrategy?.style || prepJob.spec?.visual?.style || 'Adaptive'}
                            </span>
                            <span className="quote-prep-chip">
                              🎵 Audio: {prepJob.audioStrategy?.preference === 'none' ? 'Silent' : 'Approved Ambient'}
                            </span>
                            {prepJob.publishStatus === 'published' || prepJob.publish_status === 'published' ? (
                              <span
                                className="quote-prep-chip success"
                                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                                onClick={() => setPreviewVideoJob(prepJob)}
                                title="Click to view published details"
                              >
                                <CheckCircle2 size={12} color="var(--neon-green)" /> Video: Published
                              </span>
                            ) : prepJob.reviewStatus === 'approved' || prepJob.review_status === 'approved' ? (
                              <span
                                className="quote-prep-chip success"
                                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                                onClick={() => setPreviewVideoJob(prepJob)}
                                title="Click to open video preview & publish"
                              >
                                <CheckCircle2 size={12} color="var(--neon-green)" /> Video: Approved
                              </span>
                            ) : prepJob.renderStatus === 'rendered' ? (
                              <span
                                className="quote-prep-chip success"
                                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                                onClick={() => setPreviewVideoJob(prepJob)}
                                title="Click to preview video"
                              >
                                <Film size={11} /> Video: Ready for review
                              </span>
                            ) : prepJob.renderStatus === 'rendering' || renderingJobId === prepJob.id ? (
                              <span className="quote-prep-chip info">⏳ Video: Rendering…</span>
                            ) : prepJob.renderStatus === 'requires_review' ? (
                              <span className="quote-prep-chip warning" title={prepJob.errorMessage}>
                                ⚠️ Tamil Review Required
                              </span>
                            ) : prepJob.renderStatus === 'render_failed' ? (
                              <span className="quote-prep-chip danger" title={prepJob.errorMessage || 'Render failed'}>
                                ❌ Video: Render failed
                              </span>
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
                <Layers size={24} />
              </div>
              <h3 className="empty-title">No automations found</h3>
              <p className="empty-desc">
                {searchQuery
                  ? 'No automations match your search filter.'
                  : 'You have not created any automations yet.'}
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
        </div>
      </main>

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
          loadWorkflows();
          showToast(`Saved "${newWf.name}"!`);
        }}
      />

      {/* Consumer-Friendly Quote Video Review & Preview Modal */}
      {previewVideoJob && (
        <QuoteVideoReviewModal
          job={previewVideoJob}
          onClose={() => {
            setPreviewVideoJob(null);
            loadWorkflows();
          }}
          onJobUpdated={(updatedJob) => {
            setPreviewVideoJob(updatedJob);
            const targetWfId = updatedJob.workflow_id || updatedJob.workflowId;
            if (targetWfId) {
              setQuoteJobs((prev) => ({ ...prev, [targetWfId]: updatedJob }));
            } else {
              setQuoteJobs((prev) => {
                const next = { ...prev };
                for (const [wId, j] of Object.entries(prev)) {
                  if (j?.id === updatedJob.id || j?.id === updatedJob.parentJobId) {
                    next[wId] = updatedJob;
                  }
                }
                return next;
              });
            }
            loadWorkflows();
          }}
        />
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
