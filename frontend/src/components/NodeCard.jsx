import React from 'react';
import { NODE_DEFS } from '../nodeDefs.js';

export const NODE_WIDTH = 180;
export const NODE_HEIGHT = 64;

export default function NodeCard({ node, selected, onMouseDownHeader, onSelect, onDelete, onPortMouseDown, onPortMouseUp }) {
  const def = NODE_DEFS[node.type] || { label: node.type, color: '#888' };
  const outputs = def.outputs || [null]; // null = single default output

  return (
    <div
      className={`node-card${selected ? ' selected' : ''}`}
      style={{ left: node.position.x, top: node.position.y, width: NODE_WIDTH, borderTopColor: def.color }}
      onClick={(e) => { e.stopPropagation(); onSelect(node.id); }}
    >
      <div className="node-header" onMouseDown={(e) => onMouseDownHeader(e, node.id)}>
        <span>{def.label}</span>
        <button className="node-delete" onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}>×</button>
      </div>

      {def.category !== 'trigger' && (
        <div
          className="port port-in"
          onMouseUp={(e) => { e.stopPropagation(); onPortMouseUp(node.id); }}
          title="Input"
        />
      )}

      {outputs.map((handle, i) => (
        <div
          key={handle || 'default'}
          className="port port-out"
          style={{ top: outputs.length > 1 ? 20 + i * 20 : NODE_HEIGHT / 2 }}
          onMouseDown={(e) => { e.stopPropagation(); onPortMouseDown(node.id, handle); }}
          title={handle ? `Output: ${handle}` : 'Output'}
        >
          {handle && <span className="port-label">{handle === 'true' ? 'T' : 'F'}</span>}
        </div>
      ))}
    </div>
  );
}
