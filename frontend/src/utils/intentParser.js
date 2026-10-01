/**
 * Natural language intent parser for Flowbox.
 * Extracts intent (App, When, If, Then) from plain English phrases like:
 * "Every morning, clean my promotional emails."
 * "Send me a Slack message when high priority ticket arrives."
 * "Every hour log data to Google Sheets."
 * 
 * Prepares both friendly preview text and a concrete workflow DAG ready for Flowbox's engine.
 */

export function parseAutomationIntent(query) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return null;
  }

  const text = query.trim().toLowerCase();

  // Defaults
  let appName = 'Smart Assistant';
  let appIcon = 'Zap';
  let appBadge = '⚡ Flowbox';
  let whenText = 'When triggered';
  let ifText = 'All incoming items';
  let thenText = 'Process and notify';
  let triggerType = 'manualTrigger';
  let cron = null;
  let actionType = 'slack';
  let suggestedName = query.slice(0, 50).trim();

  // 1. Detect schedule / when
  if (text.includes('every morning') || text.includes('each morning')) {
    whenText = 'Every morning at 8:00 AM';
    triggerType = 'scheduleTrigger';
    cron = '0 8 * * *';
  } else if (text.includes('every day') || text.includes('daily')) {
    if (text.includes('7 pm') || text.includes('evening') || text.includes('19:00')) {
      whenText = 'Every day at 7:00 PM';
      cron = '0 19 * * *';
    } else if (text.includes('9 am') || text.includes('9am')) {
      whenText = 'Every day at 9:00 AM';
      cron = '0 9 * * *';
    } else {
      whenText = 'Every day at 9:00 AM';
      cron = '0 9 * * *';
    }
    triggerType = 'scheduleTrigger';
  } else if (text.includes('every weekday') || text.includes('weekdays')) {
    whenText = 'Every weekday (Mon–Fri) at 9:00 AM';
    triggerType = 'scheduleTrigger';
    cron = '0 9 * * 1-5';
  } else if (text.includes('every hour') || text.includes('hourly')) {
    whenText = 'Every hour on the hour';
    triggerType = 'scheduleTrigger';
    cron = '0 * * * *';
  } else if (text.includes('every 15 min') || text.includes('every 15 minutes')) {
    whenText = 'Every 15 minutes';
    triggerType = 'scheduleTrigger';
    cron = '*/15 * * * *';
  } else if (text.includes('when an email') || text.includes('when i receive an email') || text.includes('new email')) {
    whenText = 'When a new email is received';
    triggerType = 'webhookTrigger';
  } else if (text.includes('when a file') || text.includes('file appears') || text.includes('uploaded')) {
    whenText = 'When a new file appears or is uploaded';
    triggerType = 'webhookTrigger';
  } else if (text.includes('when') || text.includes('webhook') || text.includes('event')) {
    whenText = 'When an incoming event or webhook occurs';
    triggerType = 'webhookTrigger';
  } else {
    whenText = 'Every morning at 8:00 AM';
    triggerType = 'scheduleTrigger';
    cron = '0 8 * * *';
  }

  // 2. Detect Condition (If)
  if (text.includes('promo') || text.includes('promotional') || text.includes('newsletter') || text.includes('spam')) {
    ifText = 'Promotional emails or newsletters';
  } else if (text.includes('urgent') || text.includes('high priority') || text.includes('critical')) {
    ifText = 'Priority is urgent or critical';
  } else if (text.includes('failed') || text.includes('error') || text.includes('failure')) {
    ifText = 'Status indicates an error or failure';
  } else if (text.includes('attachment') || text.includes('pdf') || text.includes('image')) {
    ifText = 'Item contains attachments or media';
  } else if (text.includes('if')) {
    const afterIf = text.split('if ')[1]?.split(' then')[0] || 'Condition matches';
    ifText = afterIf.slice(0, 60);
  } else {
    ifText = 'Applies to all matching items';
  }

  // 3. Detect Action & App
  if (text.includes('email') || text.includes('inbox') || text.includes('gmail')) {
    appName = 'Gmail';
    appIcon = 'Mail';
    appBadge = '📧 Gmail';
    if (text.includes('delete') || text.includes('clean') || text.includes('trash') || text.includes('remove') || text.includes('archive')) {
      thenText = 'Move to Trash / Archive';
      actionType = 'email';
      suggestedName = 'Clean unwanted promotional emails';
    } else {
      thenText = 'Send email notification';
      actionType = 'email';
      suggestedName = 'Automated Email Notification';
    }
  } else if (text.includes('video') || text.includes('instagram') || text.includes('tiktok') || text.includes('post')) {
    appName = 'Instagram / Social';
    appIcon = 'Video';
    appBadge = '🎬 Instagram';
    thenText = 'Publish video and log completion';
    actionType = 'httpRequest';
    suggestedName = 'Post videos to Instagram';
  } else if (text.includes('slack') || text.includes('channel') || text.includes('alert') || text.includes('notify')) {
    appName = 'Slack';
    appIcon = 'MessageSquare';
    appBadge = '💬 Slack';
    thenText = 'Post alert to Slack channel';
    actionType = 'slack';
    suggestedName = 'Send Slack notification alert';
  } else if (text.includes('sheet') || text.includes('excel') || text.includes('spreadsheet') || text.includes('table')) {
    appName = 'Google Sheets';
    appIcon = 'Table';
    appBadge = '📊 Google Sheets';
    thenText = 'Append record to Google Sheet';
    actionType = 'googleSheets';
    suggestedName = 'Sync updates to Google Sheets';
  } else if (text.includes('file') || text.includes('drive') || text.includes('folder') || text.includes('organize')) {
    appName = 'File Organizer';
    appIcon = 'Folder';
    appBadge = '📁 File Manager';
    thenText = 'Organize, rename, and sort file';
    actionType = 'httpRequest';
    suggestedName = 'Organize downloaded files';
  } else {
    appName = 'Flowbox Automation';
    appIcon = 'Zap';
    appBadge = '⚡ Flowbox';
    thenText = 'Execute automated workflow';
    actionType = 'slack';
    suggestedName = query.length > 35 ? `${query.slice(0, 35)}…` : query;
  }

  // Build the corresponding backend workflow definition
  const nodes = [];
  const edges = [];

  // Trigger Node
  const triggerNode = {
    id: 'trigger-1',
    type: triggerType,
    config: cron ? { cron } : {},
    position: { x: 80, y: 120 },
  };
  nodes.push(triggerNode);

  // Condition Node if relevant
  let lastNodeId = 'trigger-1';
  if (ifText !== 'Applies to all matching items' && ifText !== 'All incoming items') {
    const conditionNode = {
      id: 'condition-1',
      type: 'condition',
      config: {
        left: '{{$json.subject || $json.category || $json.status}}',
        operator: 'contains',
        right: ifText.toLowerCase().includes('promo') ? 'promo' : 'urgent',
      },
      position: { x: 320, y: 120 },
    };
    nodes.push(conditionNode);
    edges.push({ id: 'edge-1', source: 'trigger-1', target: 'condition-1' });
    lastNodeId = 'condition-1';
  }

  // Action Node
  let actionConfig = {};
  if (actionType === 'email') {
    actionConfig = {
      to: 'me@example.com',
      subject: `Flowbox: ${suggestedName}`,
      text: `Automation executed successfully for ${suggestedName}.`,
    };
  } else if (actionType === 'slack') {
    actionConfig = {
      message: `⚡ [Flowbox] ${suggestedName}: Event triggered at {{$now}}`,
    };
  } else if (actionType === 'googleSheets') {
    actionConfig = {
      operation: 'append',
      spreadsheetId: 'sheet-id-here',
      range: 'Sheet1!A:C',
      values: '[["{{$now}}", "{{$json.name || $json.title}}", "Processed"]]',
    };
  } else {
    actionConfig = {
      method: 'POST',
      url: 'https://httpbin.org/post',
      body: '{"status":"completed"}',
    };
  }

  const actionNode = {
    id: 'action-1',
    type: actionType,
    config: actionConfig,
    position: { x: lastNodeId === 'condition-1' ? 560 : 340, y: 120 },
  };
  nodes.push(actionNode);

  edges.push({
    id: lastNodeId === 'condition-1' ? 'edge-2' : 'edge-1',
    source: lastNodeId,
    target: 'action-1',
    ...(lastNodeId === 'condition-1' ? { sourceHandle: 'true' } : {}),
  });

  return {
    rawQuery: query,
    appName,
    appIcon,
    appBadge,
    whenText,
    ifText,
    thenText,
    suggestedName,
    triggerType,
    cron,
    actionType,
    definition: { nodes, edges },
  };
}
