import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  Zap,
  Play,
  Mail,
  FileText,
  Filter,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  MessageSquare,
  Table,
  Globe,
  Sliders,
  Check,
  RotateCw,
  ExternalLink,
} from 'lucide-react';
import { humanToCron, cronToHuman } from '../utils/cronHelper.js';
import { api } from '../api.js';

export default function AutomationWizard({
  isOpen,
  onClose,
  initialData = null,
  onSaved,
  onOpenAdvanced,
}) {
  if (!isOpen) return null;

  // Step index: 1: When, 2: Condition, 3: Do/Action, 4: Schedule, 5: Review
  const [step, setStep] = useState(1);

  // Form State
  const [name, setName] = useState('My Automation');
  const [whenTrigger, setWhenTrigger] = useState('schedule'); // schedule | webhook | manual | email | file
  const [conditionType, setConditionType] = useState('always'); // always | contains | equals | greaterThan
  const [conditionField, setConditionField] = useState('subject');
  const [conditionValue, setConditionValue] = useState('promotional');

  // Action State
  const [actionType, setActionType] = useState('slack'); // slack | email | googleSheets | httpRequest
  const [emailTo, setEmailTo] = useState('me@example.com');
  const [emailSubject, setEmailSubject] = useState('Flowbox Alert: Automation Finished');
  const [emailBody, setEmailBody] = useState('Your automated workflow ran successfully.');
  const [slackMessage, setSlackMessage] = useState('⚡ Flowbox automation completed successfully at {{$now}}');
  const [httpUrl, setHttpUrl] = useState('https://httpbin.org/post');
  const [httpMethod, setHttpMethod] = useState('POST');
  const [sheetsId, setSheetsId] = useState('');
  const [sheetsRange, setSheetsRange] = useState('Sheet1!A:C');

  // Schedule State
  const [schedulePreset, setSchedulePreset] = useState('morning'); // morning | daily | hourly | weekdays | every_15_mins | custom
  const [customHour, setCustomHour] = useState('9');
  const [customMinute, setCustomMinute] = useState('00');
  const [customAmPm, setCustomAmPm] = useState('AM');

  // Review & Test State
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);

  // Load initial data if provided (e.g. from template or intent preview)
  useEffect(() => {
    if (initialData) {
      if (initialData.suggestedName) setName(initialData.suggestedName);
      if (initialData.defaultName) setName(initialData.defaultName);
      if (initialData.name) setName(initialData.name);

      if (initialData.triggerType === 'scheduleTrigger' || initialData.friendlyWhen?.includes('morning') || initialData.friendlyWhen?.includes('day')) {
        setWhenTrigger('schedule');
        if (initialData.friendlyWhen?.includes('morning') || initialData.cron === '0 8 * * *') {
          setSchedulePreset('morning');
        } else if (initialData.friendlyWhen?.includes('evening') || initialData.cron === '0 19 * * *') {
          setSchedulePreset('custom');
          setCustomHour('7');
          setCustomAmPm('PM');
        } else if (initialData.friendlyWhen?.includes('weekday')) {
          setSchedulePreset('weekdays');
        } else if (initialData.friendlyWhen?.includes('hour')) {
          setSchedulePreset('hourly');
        }
      } else if (initialData.triggerType === 'webhookTrigger' || initialData.friendlyWhen?.includes('webhook')) {
        setWhenTrigger('webhook');
      }

      if (initialData.actionType) {
        setActionType(initialData.actionType);
      }

      if (initialData.ifText && initialData.ifText !== 'All incoming items' && initialData.ifText !== 'Applies to all matching items') {
        setConditionType('contains');
        setConditionValue(initialData.ifText.replace(/promotional.*/i, 'promo'));
      }

      // If pre-filled from "Looks good ->", jump directly to Review step
      if (initialData.jumpToReview) {
        setStep(5);
      }
    }
  }, [initialData]);

  // Compute Cron
  function getComputedCron() {
    if (schedulePreset === 'morning') return '0 8 * * *';
    if (schedulePreset === 'daily') return '0 9 * * *';
    if (schedulePreset === 'hourly') return '0 * * * *';
    if (schedulePreset === 'weekdays') return '0 9 * * 1-5';
    if (schedulePreset === 'every_15_mins') return '*/15 * * * *';
    return humanToCron('daily', {
      hour: customHour,
      minute: customMinute,
      ampm: customAmPm,
    });
  }

  // Construct Workflow Definition { nodes, edges }
  function buildWorkflowDefinition() {
    const nodes = [];
    const edges = [];

    // Trigger Node
    let triggerNode = {
      id: 'trigger-1',
      position: { x: 80, y: 120 },
    };

    if (whenTrigger === 'schedule') {
      triggerNode.type = 'scheduleTrigger';
      triggerNode.config = { cron: getComputedCron() };
    } else if (whenTrigger === 'manual') {
      triggerNode.type = 'manualTrigger';
      triggerNode.config = {};
    } else {
      triggerNode.type = 'webhookTrigger';
      triggerNode.config = {};
    }
    nodes.push(triggerNode);

    let lastNodeId = 'trigger-1';

    // Condition Node
    if (conditionType !== 'always') {
      const conditionNode = {
        id: 'condition-1',
        type: 'condition',
        config: {
          left: `{{$json.${conditionField}}}`,
          operator: conditionType,
          right: conditionValue,
        },
        position: { x: 300, y: 120 },
      };
      nodes.push(conditionNode);
      edges.push({ id: 'edge-1', source: 'trigger-1', target: 'condition-1' });
      lastNodeId = 'condition-1';
    }

    // Action Node
    let actionConfig = {};
    if (actionType === 'slack') {
      actionConfig = { message: slackMessage };
    } else if (actionType === 'email') {
      actionConfig = { to: emailTo, subject: emailSubject, text: emailBody };
    } else if (actionType === 'googleSheets') {
      actionConfig = {
        operation: 'append',
        spreadsheetId: sheetsId || 'sheet-id',
        range: sheetsRange,
        values: '[["{{$now}}", "{{$json.title || $json.name || \'Automated Entry\'}}", "Completed"]]',
      };
    } else {
      actionConfig = {
        method: httpMethod,
        url: httpUrl,
        body: '{"status":"ok"}',
      };
    }

    const actionNode = {
      id: 'action-1',
      type: actionType,
      config: actionConfig,
      position: { x: lastNodeId === 'condition-1' ? 540 : 320, y: 120 },
    };
    nodes.push(actionNode);

    edges.push({
      id: lastNodeId === 'condition-1' ? 'edge-2' : 'edge-1',
      source: lastNodeId,
      target: 'action-1',
      ...(lastNodeId === 'condition-1' ? { sourceHandle: 'true' } : {}),
    });

    return { nodes, edges };
  }

  // Friendly Summaries for Review
  function getSummaryWhen() {
    if (whenTrigger === 'schedule') {
      return cronToHuman(getComputedCron());
    }
    if (whenTrigger === 'webhook') return 'When an app event or webhook occurs';
    if (whenTrigger === 'email') return 'When a new email is received';
    if (whenTrigger === 'file') return 'When a new file appears';
    return 'Whenever you click Run (On-demand)';
  }

  function getSummaryIf() {
    if (conditionType === 'always') return 'Always run (no condition filter)';
    if (conditionType === 'contains') return `When "${conditionField}" contains "${conditionValue}"`;
    if (conditionType === 'equals') return `When "${conditionField}" equals "${conditionValue}"`;
    return `When "${conditionField}" is greater than "${conditionValue}"`;
  }

  function getSummaryAction() {
    if (actionType === 'slack') return `Send message to Slack: "${slackMessage.slice(0, 45)}…"`;
    if (actionType === 'email') return `Send email to ${emailTo}: "${emailSubject}"`;
    if (actionType === 'googleSheets') return `Append row to Google Sheets (${sheetsRange})`;
    return `Call Web Service (${httpMethod} ${httpUrl})`;
  }

  // Test Run
  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      // Create temporary workflow or execute
      const definition = buildWorkflowDefinition();
      const { data } = await api.createWorkflow({
        name: `[Test] ${name}`,
        definition,
        active: false,
      });

      const runRes = await api.runWorkflow(data.id, {
        score: 75,
        category: 'promo',
        subject: 'Special offer promotional',
        message: 'Test event payload',
      });

      // Cleanup test workflow
      await api.deleteWorkflow(data.id);

      setTestResult({
        success: runRes.data.status !== 'error',
        status: runRes.data.status,
        message: runRes.data.status === 'error'
          ? 'Completed with errors (check credentials or URL)'
          : 'Automation executed successfully!',
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: err.response?.data?.error || err.message || 'Test run failed',
      });
    } finally {
      setTesting(false);
    }
  }

  // Final Save & Turn On
  async function handleTurnOn() {
    setSaving(true);
    try {
      const definition = buildWorkflowDefinition();
      const workflowData = {
        name,
        definition,
        active: true,
      };

      let result;
      if (initialData?.id) {
        result = await api.updateWorkflow(initialData.id, workflowData);
      } else {
        result = await api.createWorkflow(workflowData);
      }

      if (onSaved) onSaved(result.data);
      onClose();
    } catch (err) {
      alert(`Could not save automation: ${err.response?.data?.error || err.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="wizard-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="wizard-header">
          <div className="wizard-title-group">
            <span className="wizard-step-label">Step {step} of 5</span>
            <h2 className="wizard-title">
              {step === 1 && 'What should start this automation?'}
              {step === 2 && 'What should we look for?'}
              {step === 3 && 'What should Flowbox do?'}
              {step === 4 && 'When should it run?'}
              {step === 5 && 'Your automation is ready'}
            </h2>
          </div>
          <button className="btn-subtle" onClick={onClose} style={{ padding: 6 }}>
            <X size={20} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="wizard-progress-bar">
          <div
            className="wizard-progress-fill"
            style={{ width: `${(step / 5) * 100}%` }}
          />
        </div>

        {/* Body content per step */}
        <div className="wizard-body">
          {/* STEP 1: WHEN */}
          {step === 1 && (
            <div>
              <p className="muted" style={{ marginBottom: 12 }}>
                Choose the trigger event that kicks off your automated action.
              </p>
              <div className="options-grid">
                <div
                  className={`option-card ${whenTrigger === 'schedule' ? 'selected' : ''}`}
                  onClick={() => setWhenTrigger('schedule')}
                >
                  <div className="option-icon-box">
                    <Clock size={20} />
                  </div>
                  <div className="option-text">
                    <h4>On a regular schedule</h4>
                    <p>Every morning, daily, hourly, or on specific weekdays.</p>
                  </div>
                </div>

                <div
                  className={`option-card ${whenTrigger === 'email' ? 'selected' : ''}`}
                  onClick={() => setWhenTrigger('email')}
                >
                  <div className="option-icon-box">
                    <Mail size={20} />
                  </div>
                  <div className="option-text">
                    <h4>When I receive an email</h4>
                    <p>Trigger whenever a new email or message arrives.</p>
                  </div>
                </div>

                <div
                  className={`option-card ${whenTrigger === 'file' ? 'selected' : ''}`}
                  onClick={() => setWhenTrigger('file')}
                >
                  <div className="option-icon-box">
                    <FileText size={20} />
                  </div>
                  <div className="option-text">
                    <h4>When a file appears</h4>
                    <p>Trigger when a new download, document, or media file is added.</p>
                  </div>
                </div>

                <div
                  className={`option-card ${whenTrigger === 'webhook' ? 'selected' : ''}`}
                  onClick={() => setWhenTrigger('webhook')}
                >
                  <div className="option-icon-box">
                    <Zap size={20} />
                  </div>
                  <div className="option-text">
                    <h4>When an app sends an event</h4>
                    <p>Instant trigger from Shopify, Stripe, GitHub, or any webhook.</p>
                  </div>
                </div>

                <div
                  className={`option-card ${whenTrigger === 'manual' ? 'selected' : ''}`}
                  onClick={() => setWhenTrigger('manual')}
                >
                  <div className="option-icon-box">
                    <Play size={20} />
                  </div>
                  <div className="option-text">
                    <h4>Whenever I click Run</h4>
                    <p>Manual trigger that only runs when you press the button.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: IF / CONDITION */}
          {step === 2 && (
            <div>
              <p className="muted" style={{ marginBottom: 16 }}>
                Set a condition to filter only the items you care about, or let it run every time.
              </p>

              <div className="options-grid" style={{ marginBottom: 20 }}>
                <div
                  className={`option-card ${conditionType === 'always' ? 'selected' : ''}`}
                  onClick={() => setConditionType('always')}
                >
                  <div className="option-icon-box">
                    <CheckCircle size={20} />
                  </div>
                  <div className="option-text">
                    <h4>Always run</h4>
                    <p>No condition needed. Process every single incoming item.</p>
                  </div>
                </div>

                <div
                  className={`option-card ${conditionType === 'contains' ? 'selected' : ''}`}
                  onClick={() => setConditionType('contains')}
                >
                  <div className="option-icon-box">
                    <Filter size={20} />
                  </div>
                  <div className="option-text">
                    <h4>Contains specific words</h4>
                    <p>E.g. promotional emails, invoices, urgent tickets.</p>
                  </div>
                </div>

                <div
                  className={`option-card ${conditionType === 'equals' ? 'selected' : ''}`}
                  onClick={() => setConditionType('equals')}
                >
                  <div className="option-icon-box">
                    <Sliders size={20} />
                  </div>
                  <div className="option-text">
                    <h4>Field matches exactly</h4>
                    <p>E.g. status equals "approved" or priority equals "high".</p>
                  </div>
                </div>
              </div>

              {conditionType !== 'always' && (
                <div className="card" style={{ background: '#0e131b', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: 20 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Field to check</label>
                  <input
                    value={conditionField}
                    onChange={(e) => setConditionField(e.target.value)}
                    placeholder="e.g. subject, category, or status"
                  />

                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Value or keyword to look for</label>
                  <input
                    value={conditionValue}
                    onChange={(e) => setConditionValue(e.target.value)}
                    placeholder="e.g. promotional, newsletter, or urgent"
                  />
                </div>
              )}
            </div>
          )}

          {/* STEP 3: DO / ACTION */}
          {step === 3 && (
            <div>
              <p className="muted" style={{ marginBottom: 14 }}>
                Choose the action Flowbox should execute automatically.
              </p>

              <div className="options-grid" style={{ marginBottom: 20 }}>
                <div
                  className={`option-card ${actionType === 'slack' ? 'selected' : ''}`}
                  onClick={() => setActionType('slack')}
                >
                  <div className="option-icon-box">
                    <MessageSquare size={20} />
                  </div>
                  <div className="option-text">
                    <h4>Send a Slack message</h4>
                    <p>Post an alert or message to your team Slack channel.</p>
                  </div>
                </div>

                <div
                  className={`option-card ${actionType === 'email' ? 'selected' : ''}`}
                  onClick={() => setActionType('email')}
                >
                  <div className="option-icon-box">
                    <Mail size={20} />
                  </div>
                  <div className="option-text">
                    <h4>Send an email</h4>
                    <p>Send an email notification with custom subject and body.</p>
                  </div>
                </div>

                <div
                  className={`option-card ${actionType === 'googleSheets' ? 'selected' : ''}`}
                  onClick={() => setActionType('googleSheets')}
                >
                  <div className="option-icon-box">
                    <Table size={20} />
                  </div>
                  <div className="option-text">
                    <h4>Add to Google Sheets</h4>
                    <p>Append a new row with timestamp and data to a spreadsheet.</p>
                  </div>
                </div>

                <div
                  className={`option-card ${actionType === 'httpRequest' ? 'selected' : ''}`}
                  onClick={() => setActionType('httpRequest')}
                >
                  <div className="option-icon-box">
                    <Globe size={20} />
                  </div>
                  <div className="option-text">
                    <h4>Call a Web Service</h4>
                    <p>Send a POST or GET request to any external API or webhook.</p>
                  </div>
                </div>
              </div>

              {/* Action configuration details */}
              <div className="card" style={{ background: '#0e131b', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: 20 }}>
                {actionType === 'slack' && (
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Slack Message Text</label>
                    <textarea
                      rows={3}
                      value={slackMessage}
                      onChange={(e) => setSlackMessage(e.target.value)}
                      placeholder="Alert text. Tip: Use {{$now}} for current time"
                    />
                  </div>
                )}

                {actionType === 'email' && (
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600 }}>Recipient Email Address</label>
                    <input
                      type="email"
                      value={emailTo}
                      onChange={(e) => setEmailTo(e.target.value)}
                      placeholder="user@example.com"
                    />
                    <label style={{ fontSize: 13, fontWeight: 600 }}>Subject</label>
                    <input
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="Notification subject"
                    />
                    <label style={{ fontSize: 13, fontWeight: 600 }}>Email Body</label>
                    <textarea
                      rows={3}
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      placeholder="Summary or message text"
                    />
                  </div>
                )}

                {actionType === 'googleSheets' && (
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600 }}>Spreadsheet ID</label>
                    <input
                      value={sheetsId}
                      onChange={(e) => setSheetsId(e.target.value)}
                      placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                    />
                    <label style={{ fontSize: 13, fontWeight: 600 }}>Sheet & Range</label>
                    <input
                      value={sheetsRange}
                      onChange={(e) => setSheetsRange(e.target.value)}
                      placeholder="Sheet1!A:C"
                    />
                  </div>
                )}

                {actionType === 'httpRequest' && (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 13, fontWeight: 600 }}>Method</label>
                        <select value={httpMethod} onChange={(e) => setHttpMethod(e.target.value)}>
                          <option value="POST">POST</option>
                          <option value="GET">GET</option>
                          <option value="PUT">PUT</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 13, fontWeight: 600 }}>URL</label>
                        <input
                          value={httpUrl}
                          onChange={(e) => setHttpUrl(e.target.value)}
                          placeholder="https://api.example.com/endpoint"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: WHEN SHOULD IT RUN? (SCHEDULE) */}
          {step === 4 && (
            <div>
              <p className="muted" style={{ marginBottom: 14 }}>
                Choose the frequency and time for your automation to execute.
              </p>

              <div className="options-grid" style={{ marginBottom: 20 }}>
                <div
                  className={`option-card ${schedulePreset === 'morning' ? 'selected' : ''}`}
                  onClick={() => setSchedulePreset('morning')}
                >
                  <div className="option-icon-box">
                    <Clock size={20} />
                  </div>
                  <div className="option-text">
                    <h4>Every morning</h4>
                    <p>Runs every single day at 8:00 AM.</p>
                  </div>
                </div>

                <div
                  className={`option-card ${schedulePreset === 'daily' ? 'selected' : ''}`}
                  onClick={() => setSchedulePreset('daily')}
                >
                  <div className="option-icon-box">
                    <Clock size={20} />
                  </div>
                  <div className="option-text">
                    <h4>Every day at 9:00 AM</h4>
                    <p>Starts your workday with automatic updates.</p>
                  </div>
                </div>

                <div
                  className={`option-card ${schedulePreset === 'weekdays' ? 'selected' : ''}`}
                  onClick={() => setSchedulePreset('weekdays')}
                >
                  <div className="option-icon-box">
                    <Clock size={20} />
                  </div>
                  <div className="option-text">
                    <h4>Every weekday</h4>
                    <p>Runs Monday through Friday only.</p>
                  </div>
                </div>

                <div
                  className={`option-card ${schedulePreset === 'hourly' ? 'selected' : ''}`}
                  onClick={() => setSchedulePreset('hourly')}
                >
                  <div className="option-icon-box">
                    <Clock size={20} />
                  </div>
                  <div className="option-text">
                    <h4>Every hour</h4>
                    <p>Runs continuously on the hour, 24/7.</p>
                  </div>
                </div>

                <div
                  className={`option-card ${schedulePreset === 'every_15_mins' ? 'selected' : ''}`}
                  onClick={() => setSchedulePreset('every_15_mins')}
                >
                  <div className="option-icon-box">
                    <Clock size={20} />
                  </div>
                  <div className="option-text">
                    <h4>Every 15 minutes</h4>
                    <p>Frequent synchronization for high-velocity tasks.</p>
                  </div>
                </div>

                <div
                  className={`option-card ${schedulePreset === 'custom' ? 'selected' : ''}`}
                  onClick={() => setSchedulePreset('custom')}
                >
                  <div className="option-icon-box">
                    <Sliders size={20} />
                  </div>
                  <div className="option-text">
                    <h4>Custom time</h4>
                    <p>Pick a specific hour and minute.</p>
                  </div>
                </div>
              </div>

              {schedulePreset === 'custom' && (
                <div className="card" style={{ background: '#0e131b', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: 20 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Select Time</label>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <select
                      value={customHour}
                      onChange={(e) => setCustomHour(e.target.value)}
                      style={{ width: 100 }}
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <span style={{ color: 'var(--text-secondary)' }}>:</span>
                    <select
                      value={customMinute}
                      onChange={(e) => setCustomMinute(e.target.value)}
                      style={{ width: 100 }}
                    >
                      {['00', '15', '30', '45'].map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <select
                      value={customAmPm}
                      onChange={(e) => setCustomAmPm(e.target.value)}
                      style={{ width: 100 }}
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 5: REVIEW SCREEN */}
          {step === 5 && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Automation Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ fontSize: 16, fontWeight: 700, marginTop: 4, background: '#0e131b', color: '#ffffff' }}
                />
              </div>

              {/* Review Boxes */}
              <div className="review-box">
                <div className="review-left">
                  <div className="review-icon">
                    <Clock size={20} />
                  </div>
                  <div>
                    <div className="review-label">When</div>
                    <div className="review-val">{getSummaryWhen()}</div>
                  </div>
                </div>
                <button
                  className="review-edit-btn"
                  onClick={() => setStep(whenTrigger === 'schedule' ? 4 : 1)}
                >
                  Edit
                </button>
              </div>

              <div className="review-box">
                <div className="review-left">
                  <div className="review-icon">
                    <Filter size={20} />
                  </div>
                  <div>
                    <div className="review-label">Look for</div>
                    <div className="review-val">{getSummaryIf()}</div>
                  </div>
                </div>
                <button className="review-edit-btn" onClick={() => setStep(2)}>
                  Edit
                </button>
              </div>

              <div className="review-box">
                <div className="review-left">
                  <div className="review-icon">
                    <CheckCircle size={20} />
                  </div>
                  <div>
                    <div className="review-label">Action</div>
                    <div className="review-val">{getSummaryAction()}</div>
                  </div>
                </div>
                <button className="review-edit-btn" onClick={() => setStep(3)}>
                  Edit
                </button>
              </div>

              {/* Test feedback */}
              {testResult && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 8,
                    marginTop: 16,
                    background: testResult.success ? 'rgba(0, 229, 117, 0.08)' : 'rgba(244, 63, 94, 0.1)',
                    border: `1px solid ${testResult.success ? 'var(--neon-green-border)' : 'var(--danger-border)'}`,
                    color: testResult.success ? 'var(--neon-green)' : '#fb7185',
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <CheckCircle size={16} />
                  <span>{testResult.message}</span>
                </div>
              )}

              {/* Optional Advanced Canvas Link */}
              {onOpenAdvanced && (
                <div style={{ textAlign: 'center', marginTop: 24 }}>
                  <button
                    className="btn-subtle"
                    style={{ fontSize: 13, color: 'var(--neon-green)' }}
                    onClick={() => {
                      const def = buildWorkflowDefinition();
                      onOpenAdvanced({ name, definition: def });
                    }}
                  >
                    <ExternalLink size={14} />
                    <span>Prefer node-based canvas? Open in Advanced Editor</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div className="wizard-footer">
          <div>
            {step > 1 && (
              <button
                className="btn-secondary"
                onClick={() => {
                  // If on step 5 and trigger is not schedule, skip step 4
                  if (step === 5 && whenTrigger !== 'schedule') {
                    setStep(3);
                  } else {
                    setStep(step - 1);
                  }
                }}
              >
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {step < 5 && (
              <button
                onClick={() => {
                  // If on step 3 and trigger is not schedule, skip step 4 directly to review
                  if (step === 3 && whenTrigger !== 'schedule') {
                    setStep(5);
                  } else {
                    setStep(step + 1);
                  }
                }}
              >
                <span>Continue</span>
                <ArrowRight size={16} />
              </button>
            )}

            {step === 5 && (
              <>
                <button
                  className="btn-secondary"
                  onClick={handleTest}
                  disabled={testing}
                >
                  {testing ? <RotateCw className="spin" size={16} /> : <Play size={16} />}
                  <span>{testing ? 'Testing…' : 'Test automation'}</span>
                </button>

                <button
                  className="btn-gradient"
                  onClick={handleTurnOn}
                  disabled={saving}
                >
                  <Check size={16} strokeWidth={3} />
                  <span>{saving ? 'Turning on…' : 'Turn on automation'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
