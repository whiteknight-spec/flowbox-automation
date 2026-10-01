const httpRequest = require('./httpRequest');
const slack = require('./slack');
const email = require('./email');
const googleSheets = require('./googleSheets');
const condition = require('./condition');
const setData = require('./setData');
const code = require('./code');
const quoteVideo = require('./quoteVideo');

// Triggers don't "run" mid-workflow — they just represent the entry point.
// The executor seeds their output directly from the incoming event.
const passthroughTrigger = { run: async (config, context) => context.currentJson };

module.exports = {
  manualTrigger: passthroughTrigger,
  webhookTrigger: passthroughTrigger,
  scheduleTrigger: passthroughTrigger,
  httpRequest,
  slack,
  email,
  googleSheets,
  condition,
  setData,
  code,
  quoteVideo,
};
