import React, { useEffect, useState } from 'react';
import { NODE_DEFS } from '../nodeDefs.js';
import { api } from '../api.js';

// --- helpers to convert between UI-friendly text and stored config shapes ---
function fieldsObjToText(fieldsArr) {
  return (fieldsArr || []).map((f) => `${f.key}=${f.value}`).join('\n');
}
function textToFieldsObj(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf('=');
      return idx === -1 ? { key: line, value: '' } : { key: line.slice(0, idx), value: line.slice(idx + 1) };
    });
}

export default function ConfigPanel({ node, onChange, onClose }) {
  const [credentials, setCredentials] = useState([]);
  const [local, setLocal] = useState(node.config || {});

  useEffect(() => { setLocal(node.config || {}); }, [node.id]);
  useEffect(() => { api.listCredentials().then((r) => setCredentials(r.data)).catch(() => {}); }, []);

  const def = NODE_DEFS[node.type] || { fields: [] };

  function setField(key, value) {
    const next = { ...local, [key]: value };
    setLocal(next);
    onChange(node.id, next);
  }

  if (node.type === 'webhookTrigger') {
    return (
      <div className="config-panel">
        <div className="config-header"><h3>Webhook Trigger</h3><button onClick={onClose}>×</button></div>
        <p className="muted">
          Save and activate this workflow, then use the webhook URL shown on the dashboard
          (with the workflow's secret) to trigger it from any external service.
        </p>
      </div>
    );
  }

  return (
    <div className="config-panel">
      <div className="config-header">
        <h3>{def.label || node.type}</h3>
        <button onClick={onClose}>×</button>
      </div>

      {def.fields.length === 0 && <p className="muted">This node has no configuration.</p>}

      {def.fields.map((f) => {
        if (f.type === 'credential') {
          return (
            <div key={f.key} className="config-field">
              <label>{f.label}</label>
              <select value={local[f.key] || ''} onChange={(e) => setField(f.key, e.target.value)}>
                <option value="">— none —</option>
                {credentials.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                ))}
              </select>
            </div>
          );
        }
        if (f.type === 'select') {
          return (
            <div key={f.key} className="config-field">
              <label>{f.label}</label>
              <select value={local[f.key] || f.options[0]} onChange={(e) => setField(f.key, e.target.value)}>
                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          );
        }
        if (f.type === 'json') {
          return (
            <div key={f.key} className="config-field">
              <label>{f.label}</label>
              <textarea
                rows={4}
                placeholder={f.placeholder || '{}'}
                value={typeof local[f.key] === 'string' ? local[f.key] : JSON.stringify(local[f.key] || '', null, 2)}
                onChange={(e) => {
                  try { setField(f.key, JSON.parse(e.target.value)); }
                  catch { setField(f.key, e.target.value); } // keep raw text until valid JSON
                }}
              />
            </div>
          );
        }
        if (f.type === 'keyvalue') {
          return (
            <div key={f.key} className="config-field">
              <label>{f.label}</label>
              <textarea
                rows={5}
                placeholder={'greeting=Hello {{$json.name}}'}
                defaultValue={fieldsObjToText(local[f.key])}
                onBlur={(e) => setField(f.key, textToFieldsObj(e.target.value))}
              />
            </div>
          );
        }
        if (f.type === 'code') {
          return (
            <div key={f.key} className="config-field">
              <label>{f.label}</label>
              <textarea
                rows={10}
                className="code-editor"
                placeholder={'return { doubled: input[0]?.value * 2 };'}
                value={local[f.key] || ''}
                onChange={(e) => setField(f.key, e.target.value)}
              />
            </div>
          );
        }
        return (
          <div key={f.key} className="config-field">
            <label>{f.label}</label>
            <input
              placeholder={f.placeholder}
              value={local[f.key] || ''}
              onChange={(e) => setField(f.key, e.target.value)}
            />
          </div>
        );
      })}
    </div>
  );
}
