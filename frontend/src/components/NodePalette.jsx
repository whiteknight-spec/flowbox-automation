import React from 'react';
import { NODE_DEFS, PALETTE_GROUPS } from '../nodeDefs.js';

export default function NodePalette({ onAddNode }) {
  return (
    <div className="palette">
      {PALETTE_GROUPS.map((group) => (
        <div key={group.title} className="palette-group">
          <div className="palette-title">{group.title}</div>
          {group.types.map((type) => (
            <button
              key={type}
              className="palette-item"
              style={{ borderLeft: `4px solid ${NODE_DEFS[type].color}` }}
              onClick={() => onAddNode(type)}
            >
              {NODE_DEFS[type].label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
