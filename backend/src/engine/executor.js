const nodeTypes = require('./nodes');

/** Safe property-path getter: "a.b[0].c" -> obj.a.b[0].c, no eval(). */
function safeGet(obj, path) {
  if (!path) return obj;
  const parts = path
    .replace(/\[(\w+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
  let cur = obj;
  for (const part of parts) {
    if (cur === undefined || cur === null) return undefined;
    cur = cur[part];
  }
  return cur;
}

/**
 * Resolves {{ ... }} templates against the current execution state.
 * Supported expressions (no arbitrary code execution, just path lookups):
 *   {{$json}}              -> whole current input object
 *   {{$json.field.nested}} -> path into current input
 *   {{$node["nodeId"].field}} -> path into a specific earlier node's output
 *   {{$now}}               -> current ISO timestamp
 */
function makeInterpolator(currentJson, nodeResultsById) {
  function resolveExpr(expr) {
    expr = expr.trim();
    if (expr === '$now') return new Date().toISOString();
    if (expr === '$json') return currentJson;
    if (expr.startsWith('$json.')) return safeGet(currentJson, expr.slice('$json.'.length));
    const nodeMatch = expr.match(/^\$node\["([^"]+)"\]\.?(.*)$/);
    if (nodeMatch) {
      const [, nodeId, rest] = nodeMatch;
      return safeGet(nodeResultsById[nodeId], rest);
    }
    return undefined;
  }

  return function interpolate(template) {
    if (typeof template !== 'string') return template;
    // Whole-string exact match returns the raw resolved value (preserves type/objects).
    const exact = template.match(/^\{\{\s*(.+?)\s*\}\}$/);
    if (exact) return resolveExpr(exact[1]);
    // Otherwise, substitute inline occurrences as strings.
    return template.replace(/\{\{\s*(.+?)\s*\}\}/g, (_, expr) => {
      const val = resolveExpr(expr);
      return val === undefined ? '' : typeof val === 'object' ? JSON.stringify(val) : String(val);
    });
  };
}

/**
 * Executes a workflow definition { nodes, edges } starting from the trigger
 * node, given the incoming event payload. Returns a run log and final status.
 */
async function executeWorkflow(definition, initialPayload, { onLog, workflowId, runId } = {}) {
  const { nodes, edges } = definition;
  const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const incomingEdges = (id) => edges.filter((e) => e.target === id);
  const outgoingEdges = (id) => edges.filter((e) => e.source === id);

  const trigger = nodes.find((n) => n.type.endsWith('Trigger'));
  if (!trigger) throw new Error('Workflow has no trigger node');

  const results = {}; // nodeId -> output json
  const log = [];
  const visited = new Set();

  function pushLog(entry) {
    log.push({ ts: new Date().toISOString(), ...entry });
    if (onLog) onLog(entry);
  }

  async function runNode(nodeId, inputJson) {
    if (visited.has(nodeId)) return; // avoid re-running in case of diamond graphs
    visited.add(nodeId);

    const node = nodeById[nodeId];
    const executor = nodeTypes[node.type];
    if (!executor) throw new Error(`Unknown node type: ${node.type}`);

    const interpolate = makeInterpolator(inputJson, results);
    const context = {
      currentJson: inputJson,
      interpolate,
      getAllInputs: () => incomingEdges(nodeId).map((e) => results[e.source]),
      log: (event, data) => pushLog({ nodeId, event, data }),
      workflowId: workflowId || inputJson?.workflowId || null,
      runId: runId || inputJson?.runId || null,
    };

    pushLog({ nodeId, event: 'start', nodeType: node.type });
    try {
      const output = await executor.run(node.config || {}, context);
      results[nodeId] = output;
      pushLog({ nodeId, event: 'success', output });

      const branch = output && typeof output === 'object' ? output.branch : undefined;
      for (const edge of outgoingEdges(nodeId)) {
        if (edge.sourceHandle && branch && edge.sourceHandle !== branch) continue; // condition branching
        await runNode(edge.target, output);
      }
    } catch (err) {
      pushLog({ nodeId, event: 'error', message: err.message });
      throw err;
    }
  }

  try {
    await runNode(trigger.id, initialPayload);
    return { status: 'success', log };
  } catch (err) {
    return { status: 'error', log, error: err.message };
  }
}

module.exports = { executeWorkflow, makeInterpolator };
