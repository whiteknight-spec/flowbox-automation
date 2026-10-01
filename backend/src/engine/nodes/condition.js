// Compares two interpolated values using a fixed set of safe operators.
// No eval() involved — operator is looked up from an allow-list.
const OPS = {
  equals: (a, b) => a === b,
  notEquals: (a, b) => a !== b,
  contains: (a, b) => String(a).includes(String(b)),
  greaterThan: (a, b) => parseFloat(a) > parseFloat(b),
  lessThan: (a, b) => parseFloat(a) < parseFloat(b),
  isEmpty: (a) => a === undefined || a === null || a === '',
  isNotEmpty: (a) => !(a === undefined || a === null || a === ''),
};

async function run(config, context) {
  const left = context.interpolate(config.left ?? '');
  const right = config.right !== undefined ? context.interpolate(config.right) : undefined;
  const op = OPS[config.operator];
  if (!op) throw new Error(`Unknown condition operator: ${config.operator}`);

  const result = op(left, right);
  // The executor reads `branch` to decide which outgoing edge (true/false) to follow.
  return { branch: result ? 'true' : 'false', left, right, result };
}

module.exports = { run };
