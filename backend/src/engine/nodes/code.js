const vm = require('vm');

/**
 * SECURITY NOTE:
 * This node runs arbitrary JavaScript. Node's built-in `vm` module is a
 * *soft* sandbox (isolated global scope + timeout), not a hard security
 * boundary — a determined attacker with code-execution capability could
 * still find escapes. This is acceptable ONLY because this app is a
 * single-user personal tool: you are the only person who can write
 * workflows, and this node runs YOUR OWN code, not code from strangers or
 * webhook payloads. Do not expose workflow editing to other users while
 * this node type is enabled, and do not paste untrusted code into it.
 */
async function run(config, context) {
  const sandbox = {
    input: context.getAllInputs(),
    json: context.currentJson,
    result: undefined,
    console: { log: (...args) => context.log('code:log', args) },
  };
  vm.createContext(sandbox);

  const wrapped = `
    (function() {
      "use strict";
      ${config.code}
    })()
  `;

  try {
    const script = new vm.Script(wrapped, { timeout: 5000 });
    const value = script.runInContext(sandbox, { timeout: 5000 });
    return value !== undefined ? value : sandbox.result;
  } catch (err) {
    throw new Error(`Code node error: ${err.message}`);
  }
}

module.exports = { run };
