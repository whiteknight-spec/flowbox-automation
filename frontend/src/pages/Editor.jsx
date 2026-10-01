import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  Save,
  CheckCircle2,
  Terminal,
  Copy,
  Check,
  X,
  Layers,
} from 'lucide-react';
import { api, API_BASE } from '../api.js';
import NodePalette from '../components/NodePalette.jsx';
import NodeCard, { NODE_WIDTH, NODE_HEIGHT } from '../components/NodeCard.jsx';
import ConfigPanel from '../components/ConfigPanel.jsx';
import { NODE_DEFS } from '../nodeDefs.js';

let idCounter = 0;
const newId = (prefix) => `${prefix}-${Date.now()}-${idCounter++}`;

export default function Editor() {
  const { id: paramId } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef(null);

  const [currentId, setCurrentId] = useState(paramId);
  const [name, setName] = useState('');
  const [active, setActive] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState('');
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [connecting, setConnecting] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [runResult, setRunResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  function showToast(msg) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }

  useEffect(() => {
    async function init() {
      if (paramId === 'latest') {
        const { data } = await api.listWorkflows();
        if (data.length > 0) {
          navigate(`/workflows/${data[0].id}`, { replace: true });
          return;
        } else {
          const created = await api.createWorkflow({
            name: 'Untitled automation',
            definition: {
              nodes: [{ id: 'trigger-1', type: 'manualTrigger', config: {}, position: { x: 80, y: 80 } }],
              edges: [],
            },
          });
          navigate(`/workflows/${created.data.id}`, { replace: true });
          return;
        }
      }

      setCurrentId(paramId);
      try {
        const { data } = await api.getWorkflow(paramId);
        setName(data.name);
        setActive(data.active);
        setWebhookSecret(data.webhookSecret);
        setNodes(data.definition.nodes || []);
        setEdges(data.definition.edges || []);
      } catch (err) {
        console.error('Failed to load workflow', err);
      }
    }

    init();
  }, [paramId, navigate]);

  const selectedNode = nodes.find((n) => n.id === selectedId);

  function addNode(type) {
    const node = {
      id: newId('node'),
      type,
      config: {},
      position: { x: 120, y: 100 + nodes.length * 40 },
    };
    setNodes((prev) => [...prev, node]);
  }

  function updateNodeConfig(nodeId, config) {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, config } : n)));
  }

  function deleteNode(nodeId) {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));
    if (selectedId === nodeId) setSelectedId(null);
  }

  function deleteEdge(edgeId) {
    setEdges((prev) => prev.filter((e) => e.id !== edgeId));
  }

  // --- Dragging nodes ---
  function onHeaderMouseDown(e, nodeId) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setDragging({
      nodeId,
      offsetX: e.clientX - rect.left - node.position.x,
      offsetY: e.clientY - rect.top - node.position.y,
    });
  }

  const onCanvasMouseMove = useCallback(
    (e) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setMousePos({ x, y });
      if (dragging) {
        setNodes((prev) =>
          prev.map((n) =>
            n.id === dragging.nodeId
              ? { ...n, position: { x: x - dragging.offsetX, y: y - dragging.offsetY } }
              : n
          )
        );
      }
    },
    [dragging]
  );

  function onCanvasMouseUp() {
    setDragging(null);
    setConnecting(null);
  }

  // --- Connecting nodes ---
  function onPortMouseDown(nodeId, handle) {
    setConnecting({ sourceId: nodeId, sourceHandle: handle });
  }

  function onPortMouseUp(targetId) {
    if (!connecting) return;
    if (connecting.sourceId === targetId) {
      setConnecting(null);
      return;
    }
    const edge = {
      id: newId('edge'),
      source: connecting.sourceId,
      target: targetId,
      ...(connecting.sourceHandle ? { sourceHandle: connecting.sourceHandle } : {}),
    };
    setEdges((prev) => [...prev, edge]);
    setConnecting(null);
  }

  function portPos(nodeId, handle, side) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };
    const def = NODE_DEFS[node.type] || {};
    const outputs = def.outputs || [null];
    if (side === 'in') return { x: node.position.x, y: node.position.y + NODE_HEIGHT / 2 };
    const i = outputs.indexOf(handle ?? null) === -1 ? 0 : outputs.indexOf(handle ?? null);
    const y = outputs.length > 1 ? node.position.y + 20 + i * 20 : node.position.y + NODE_HEIGHT / 2;
    return { x: node.position.x + NODE_WIDTH, y };
  }

  async function save() {
    setSaving(true);
    try {
      await api.updateWorkflow(currentId, {
        name,
        active,
        definition: { nodes, edges },
      });
      const { data } = await api.getWorkflow(currentId);
      setWebhookSecret(data.webhookSecret);
      showToast('Workflow saved successfully!');
    } catch (err) {
      showToast(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function runNow() {
    setRunResult({ status: 'running' });
    try {
      const { data } = await api.runWorkflow(currentId, {});
      setRunResult(data);
    } catch (err) {
      setRunResult({ status: 'error', error: err.message });
    }
  }

  const webhookUrl = `${API_BASE}/webhooks/${currentId}`;

  function copyWebhookInfo() {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  }

  return (
    <div className="editor-layout">
      {/* Topbar */}
      <header className="editor-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link
            to="/automations"
            className="btn-subtle"
            style={{ color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <ArrowLeft size={16} />
            <span>Automations</span>
          </Link>

          <span style={{ color: '#475569' }}>/</span>

          <input
            className="workflow-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Workflow Name"
          />

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(0, 229, 117, 0.06)',
              border: '1px solid var(--neon-green-border)',
              padding: '4px 10px',
              borderRadius: 20,
              fontSize: 12,
              color: 'var(--neon-green)',
            }}
          >
            <Terminal size={12} />
            <span>Developer Mode</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#e2e8f0', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              style={{ width: 'auto', margin: 0 }}
            />
            <span>Active</span>
          </label>

          <button
            className="btn-secondary"
            style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#f8fafc', borderColor: 'var(--border-light)' }}
            onClick={save}
            disabled={saving}
          >
            <Save size={14} />
            <span>{saving ? 'Saving…' : 'Save'}</span>
          </button>

          <button className="btn-gradient" onClick={runNow}>
            <Play size={14} />
            <span>Run Canvas</span>
          </button>

          <Link
            to="/"
            className="btn-subtle"
            style={{ color: '#94a3b8', fontSize: 13 }}
            title="Return to Simple User Dashboard"
          >
            Simple View
          </Link>
        </div>
      </header>

      {/* Webhook notification banner if webhook trigger exists */}
      {nodes.some((n) => n.type === 'webhookTrigger') && (
        <div className="webhook-banner">
          <span>Webhook Endpoint:</span>
          <code>{webhookUrl}</code>
          <button
            className="btn-subtle"
            style={{ color: 'var(--neon-green)', padding: '2px 8px', fontSize: 12 }}
            onClick={copyWebhookInfo}
          >
            {copiedWebhook ? <Check size={14} /> : <Copy size={14} />}
            <span>{copiedWebhook ? 'Copied' : 'Copy URL'}</span>
          </button>
          <span style={{ marginLeft: 8, opacity: 0.8 }}>
            (Header: <code>X-Webhook-Secret: {webhookSecret}</code>)
          </span>
        </div>
      )}

      {/* Canvas Workspace */}
      <div className="editor-body">
        <NodePalette onAddNode={addNode} />

        <div
          className="canvas"
          ref={canvasRef}
          onMouseMove={onCanvasMouseMove}
          onMouseUp={onCanvasMouseUp}
          onClick={() => setSelectedId(null)}
        >
          <svg className="edges-svg">
            {edges.map((e) => {
              const from = portPos(e.source, e.sourceHandle, 'out');
              const to = portPos(e.target, null, 'in');
              const mx = (from.x + to.x) / 2;
              return (
                <g key={e.id}>
                  <path
                    d={`M ${from.x} ${from.y} C ${mx} ${from.y}, ${mx} ${to.y}, ${to.x} ${to.y}`}
                    stroke="#64748b"
                    strokeWidth="2.5"
                    fill="none"
                  />
                  <circle
                    cx={mx}
                    cy={(from.y + to.y) / 2}
                    r="8"
                    fill="#ef4444"
                    className="edge-delete"
                    onClick={(evt) => {
                      evt.stopPropagation();
                      deleteEdge(e.id);
                    }}
                  />
                </g>
              );
            })}
            {connecting && (
              <path
                d={`M ${portPos(connecting.sourceId, connecting.sourceHandle, 'out').x} ${
                  portPos(connecting.sourceId, connecting.sourceHandle, 'out').y
                } L ${mousePos.x} ${mousePos.y}`}
                stroke="var(--neon-green)"
                strokeWidth="2.5"
                strokeDasharray="4"
                fill="none"
              />
            )}
          </svg>

          {nodes.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              selected={node.id === selectedId}
              onMouseDownHeader={onHeaderMouseDown}
              onSelect={setSelectedId}
              onDelete={deleteNode}
              onPortMouseDown={onPortMouseDown}
              onPortMouseUp={onPortMouseUp}
            />
          ))}
        </div>

        {selectedNode && (
          <ConfigPanel
            node={selectedNode}
            onChange={updateNodeConfig}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>

      {/* Execution Run Log Bottom Drawer */}
      {runResult && (
        <div className="run-log">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong>Execution Output:</strong>
              <span
                style={{
                  color: runResult.status === 'success' ? 'var(--neon-green)' : '#f43f5e',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  fontSize: 12,
                }}
              >
                {runResult.status}
              </span>
            </div>
            <button
              className="btn-subtle"
              style={{ color: '#94a3b8', padding: 4 }}
              onClick={() => setRunResult(null)}
            >
              <X size={16} />
            </button>
          </div>
          <pre>{JSON.stringify(runResult.log || runResult, null, 2)}</pre>
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
