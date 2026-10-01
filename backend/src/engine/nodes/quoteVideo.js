const { prepareDailyQuoteVideo } = require('../../contentEngine');

async function run(config, context) {
  context.log?.('quote_video_start', { config });
  const result = await prepareDailyQuoteVideo({
    workflowId: context.workflowId,
    config,
    runId: context.runId,
  });
  context.log?.('quote_video_ready', {
    jobId: result.jobId,
    language: result.language,
    topic: result.topic,
    jobStatus: result.jobStatus,
  });
  return result;
}

module.exports = { run };
