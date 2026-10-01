import { cronToHuman, getNextRunEstimate } from './cronHelper.js';

/**
 * Analyzes a workflow definition and produces a friendly human-readable summary.
 * Keeps normal users from seeing node IDs, raw triggers, or technical concepts.
 */
export function summarizeWorkflow(wf) {
  if (!wf || !wf.definition) {
    return {
      triggerLabel: 'Manual run',
      triggerIcon: 'Play',
      scheduleText: 'Runs on demand',
      nextRunText: 'Runs on demand',
      conditionText: 'None',
      actionLabel: 'Custom action',
      actionIcon: 'Zap',
      appBadge: '⚡ Flowbox',
    };
  }

  const nodes = wf.definition.nodes || [];
  const triggerNode = nodes.find((n) => n.type && n.type.endsWith('Trigger')) || nodes[0];
  const conditionNode = nodes.find((n) => n.type === 'condition');
  const actionNodes = nodes.filter((n) => n.type && !n.type.endsWith('Trigger') && n.type !== 'condition');
  const primaryAction = actionNodes[0];

  // Trigger summary
  let triggerLabel = 'Manual trigger';
  let triggerIcon = 'Play';
  let scheduleText = 'Runs on demand';
  let nextRunText = wf.active ? 'Runs on demand' : 'Paused';

  if (triggerNode) {
    if (triggerNode.type === 'scheduleTrigger') {
      triggerIcon = 'Clock';
      const cron = triggerNode.config?.cron;
      const customSummary = triggerNode.config?.summary;
      const rawSchedule = customSummary || (cron ? cronToHuman(cron) : 'Scheduled');
      // Use clean dot separator "Every day · 7:00 PM"
      scheduleText = rawSchedule.replace(' at ', ' · ');
      triggerLabel = 'Scheduled';
      nextRunText = getNextRunEstimate(cron, wf.active);
    } else if (triggerNode.type === 'webhookTrigger') {
      triggerIcon = 'Zap';
      triggerLabel = 'Instant event';
      scheduleText = 'When event received';
      nextRunText = wf.active ? 'Listening for events' : 'Paused';
    } else {
      triggerIcon = 'Play';
      triggerLabel = 'Manual';
      scheduleText = 'On demand';
      nextRunText = 'Ready to run';
    }
  }

  // Condition summary
  let conditionText = 'Always run';
  if (conditionNode && conditionNode.config) {
    const { left, operator, right } = conditionNode.config;
    if (left || right) {
      conditionText = `If ${left || 'data'} ${operator || 'is'} ${right || 'valid'}`;
    }
  }

  // Action & App Badge
  let actionLabel = 'Process action';
  let actionIcon = 'CheckCircle';
  let appBadge = '⚡ Flowbox';

  if (primaryAction) {
    switch (primaryAction.type) {
      case 'slack':
        actionLabel = 'Send Slack notification';
        actionIcon = 'MessageSquare';
        appBadge = '💬 Slack';
        break;
      case 'email':
        actionLabel = `Send email to ${primaryAction.config?.to || 'recipient'}`;
        actionIcon = 'Mail';
        appBadge = '📧 Email';
        break;
      case 'googleSheets':
        actionLabel = 'Update Google Sheets';
        actionIcon = 'Table';
        appBadge = '📊 Google Sheets';
        break;
      case 'httpRequest':
        actionLabel = `Call web service (${primaryAction.config?.method || 'POST'})`;
        actionIcon = 'Globe';
        appBadge = '🌐 Webhook / API';
        break;
      case 'setData':
        if (primaryAction.config?.templateType === 'dailyQuoteVideo' || wf.name === 'Daily Quote Video') {
          const cfg = primaryAction.config || {};
          const duration = cfg.duration || 15;
          const plats = Array.isArray(cfg.platforms) && cfg.platforms.length > 0
            ? cfg.platforms.map((p) => (p === 'instagram' ? 'Instagram' : 'YouTube Shorts')).join(' & ')
            : 'Instagram & YouTube Shorts';
          actionLabel = `Prepare ${duration}s quote video for ${plats}`;
          actionIcon = 'Video';
          appBadge = '🎬 Daily Quote Video';
        } else {
          actionLabel = 'Format & transform data';
          actionIcon = 'Sliders';
          appBadge = '⚙️ Data Set';
        }
        break;
      case 'code':
        actionLabel = 'Run custom function';
        actionIcon = 'Code';
        appBadge = '💻 Script';
        break;
      default:
        actionLabel = primaryAction.type;
        break;
    }
  }

  return {
    triggerLabel,
    triggerIcon,
    scheduleText,
    nextRunText,
    conditionText,
    actionLabel,
    actionIcon,
    appBadge,
    stepCount: nodes.length,
  };
}
