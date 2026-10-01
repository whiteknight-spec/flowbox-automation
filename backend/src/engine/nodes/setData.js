const { prepareDailyQuoteVideo } = require('../../contentEngine');

async function run(config, context) {
  const output = {};
  for (const field of config.fields || []) {
    output[field.key] = context.interpolate(field.value);
  }

  // If this setData node represents a Daily Quote Video automation configuration,
  // execute the internal content preparation engine.
  if (config.templateType === 'dailyQuoteVideo') {
    try {
      context.log?.('content_preparation_start', { templateType: 'dailyQuoteVideo' });
      const jobResult = await prepareDailyQuoteVideo({
        workflowId: context.workflowId,
        config,
        runId: context.runId,
      });
      output.quoteVideoJob = jobResult;
      context.log?.('content_preparation_success', {
        jobId: jobResult.jobId,
        language: jobResult.language,
        topic: jobResult.topic,
        jobStatus: jobResult.jobStatus,
      });
    } catch (err) {
      console.error('[setData] Quote video preparation failed:', err);
      context.log?.('content_preparation_error', { message: err.message });
      output.quoteVideoError = err.message;
    }
  }

  return output;
}

module.exports = { run };
