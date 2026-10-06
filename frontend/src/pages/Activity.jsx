import React, { useEffect, useState } from 'react';
import {
  Activity as ActivityIcon,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCw,
  Terminal,
  Zap,
  Play,
  X,
} from 'lucide-react';
import Navbar from '../components/Navbar.jsx';
import { api } from '../api.js';

export default function Activity() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [filter, setFilter] = useState('all'); // all | success | error

  async function loadActivity() {
    setLoading(true);
    try {
      const res = await api.listWorkflows();
      const raw = res?.data;
      const workflows = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.workflows)
        ? raw.workflows
        : Array.isArray(raw?.data)
        ? raw.data
        : [];
      const allRuns = [];

      // Fetch runs for each workflow
      await Promise.all(
        workflows.map(async (wf) => {
          try {
            const { data: runList } = await api.listRuns(wf.id);
            runList.forEach((r) => {
              allRuns.push({
                ...r,
                workflowId: wf.id,
                workflowName: wf.name,
              });
            });
          } catch (e) {
            // Ignore error for single workflow run query
          }
        })
      );

      // Sort by started_at descending
      allRuns.sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
      setRuns(allRuns);
    } catch (err) {
      console.error('Failed to load activity', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActivity();
  }, []);

  async function openRunDetails(run) {
    try {
      const { data } = await api.getRun(run.workflowId, run.id);
      setSelectedRun({ ...run, ...data });
    } catch (err) {
      setSelectedRun(run);
    }
  }

  const filteredRuns = runs.filter((r) => {
    if (filter === 'all') return true;
    if (filter === 'success') return r.status === 'success';
    if (filter === 'error') return r.status === 'error';
    return true;
  });

  function formatDuration(start, finish) {
    if (!finish) return 'Running…';
    const ms = new Date(finish) - new Date(start);
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  return (
    <div className="app-container">
      <Navbar />

      <main className="main-content">
        <div className="page">
          <div className="section-header">
            <div>
              <h1 className="section-title" style={{ fontSize: 28 }}>
                Execution Activity
              </h1>
              <p className="section-desc">
                Live audit trail of all automated runs, triggers, and execution statuses.
              </p>
            </div>
            <button className="btn-secondary" onClick={loadActivity}>
              <RotateCw size={14} className={loading ? 'spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="automations-toolbar" style={{ marginTop: 24 }}>
            <div className="filter-tabs">
              <button
                className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All Runs ({runs.length})
              </button>
              <button
                className={`filter-tab ${filter === 'success' ? 'active' : ''}`}
                onClick={() => setFilter('success')}
              >
                Successful ({runs.filter((r) => r.status === 'success').length})
              </button>
              <button
                className={`filter-tab ${filter === 'error' ? 'active' : ''}`}
                onClick={() => setFilter('error')}
              >
                Failed ({runs.filter((r) => r.status === 'error').length})
              </button>
            </div>
          </div>

          {/* Activity Table */}
          {filteredRuns.length > 0 ? (
            <div className="activity-table-wrap">
              <table className="activity-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Automation Name</th>
                    <th>Trigger</th>
                    <th>Started</th>
                    <th>Duration</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRuns.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <span
                          className={`status-pill ${
                            r.status === 'success'
                              ? 'success'
                              : r.status === 'error'
                              ? 'error'
                              : 'running'
                          }`}
                        >
                          {r.status === 'success' && <CheckCircle2 size={13} />}
                          {r.status === 'error' && <AlertCircle size={13} />}
                          {r.status === 'running' && <RotateCw size={13} className="spin" />}
                          <span style={{ textTransform: 'capitalize' }}>{r.status}</span>
                        </span>
                      </td>
                      <td>
                        <strong>{r.workflowName}</strong>
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            fontSize: 13,
                            color: '#475569',
                          }}
                        >
                          {r.trigger_type === 'schedule' && <Clock size={14} />}
                          {r.trigger_type === 'webhook' && <Zap size={14} />}
                          {r.trigger_type === 'manual' && <Play size={14} />}
                          <span style={{ textTransform: 'capitalize' }}>
                            {r.trigger_type}
                          </span>
                        </span>
                      </td>
                      <td style={{ color: '#64748b', fontSize: 13 }}>
                        {new Date(r.started_at).toLocaleString()}
                      </td>
                      <td style={{ color: '#64748b', fontSize: 13 }}>
                        {formatDuration(r.started_at, r.finished_at)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn-secondary"
                          style={{ padding: '5px 12px', fontSize: 12 }}
                          onClick={() => openRunDetails(r)}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon-wrap">
                <ActivityIcon size={24} />
              </div>
              <h3 className="empty-title">No activity logged yet</h3>
              <p className="empty-desc">
                When your automations run on schedule or are triggered manually,
                their execution logs will appear here.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Run Detail Modal */}
      {selectedRun && (
        <div className="modal-overlay" onClick={() => setSelectedRun(null)}>
          <div
            className="wizard-modal"
            style={{ maxWidth: 640 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="wizard-header">
              <div>
                <span className="wizard-step-label">Run Log Details</span>
                <h3 className="wizard-title" style={{ fontSize: 18 }}>
                  {selectedRun.workflowName}
                </h3>
              </div>
              <button
                className="btn-subtle"
                onClick={() => setSelectedRun(null)}
                style={{ padding: 6 }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="wizard-body">
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 12,
                  marginBottom: 20,
                  background: '#0d1119',
                  border: '1px solid var(--border-subtle)',
                  padding: 14,
                  borderRadius: 8,
                }}
              >
                <div>
                  <span className="ai-col-label">Status</span>
                  <div style={{ fontWeight: 600, marginTop: 4, color: selectedRun.status === 'success' ? 'var(--neon-green)' : '#fb7185' }}>
                    {selectedRun.status === 'success' ? '🟢 Success' : '🔴 Error'}
                  </div>
                </div>
                <div>
                  <span className="ai-col-label">Trigger</span>
                  <div style={{ fontWeight: 600, marginTop: 4, textTransform: 'capitalize', color: '#ffffff' }}>
                    {selectedRun.trigger_type}
                  </div>
                </div>
                <div>
                  <span className="ai-col-label">Duration</span>
                  <div style={{ fontWeight: 600, marginTop: 4, color: '#ffffff' }}>
                    {formatDuration(selectedRun.started_at, selectedRun.finished_at)}
                  </div>
                </div>
              </div>

              {/* Execution Steps */}
              <h4 style={{ fontSize: 14, marginBottom: 12, color: 'var(--text-main)' }}>
                Execution Steps
              </h4>

              {Array.isArray(selectedRun.log) && selectedRun.log.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {selectedRun.log.map((step, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '10px 14px',
                        background: '#0d1119',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 8,
                        fontSize: 13,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CheckCircle2 size={16} color="var(--neon-green)" />
                        <div>
                          <strong style={{ color: '#ffffff' }}>{step.nodeType || step.nodeId}</strong>
                          <span style={{ color: '#64748b', marginLeft: 8 }}>
                            ({step.event})
                          </span>
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>
                        {step.ts ? new Date(step.ts).toLocaleTimeString() : ''}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted" style={{ marginBottom: 16 }}>
                  No step details recorded for this run.
                </p>
              )}

              {/* Toggle Developer Raw JSON */}
              <div style={{ marginTop: 16 }}>
                <button
                  className="btn-subtle"
                  style={{ fontSize: 13, padding: '4px 8px' }}
                  onClick={() => setShowRawJson(!showRawJson)}
                >
                  <Terminal size={14} />
                  <span>{showRawJson ? 'Hide raw trace' : 'View raw debug JSON'}</span>
                </button>

                {showRawJson && (
                  <pre
                    style={{
                      background: '#0f172a',
                      color: '#38bdf8',
                      padding: 14,
                      borderRadius: 8,
                      fontSize: 12,
                      marginTop: 8,
                      overflowX: 'auto',
                      maxHeight: 220,
                    }}
                  >
                    {JSON.stringify(selectedRun.log || selectedRun, null, 2)}
                  </pre>
                )}
              </div>
            </div>

            <div className="wizard-footer" style={{ justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setSelectedRun(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
