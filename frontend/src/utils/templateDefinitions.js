/**
 * User-intent templates designed for normal users.
 * Each template includes:
 * - Friendly metadata (icon, title, description, category, tags)
 * - User-facing summary ("When", "If", "Then")
 * - Valid backend workflow definition { nodes, edges } ready to run or customize
 */

export const AUTOMATION_TEMPLATES = [
  {
    id: 'daily-quote-video',
    title: 'Daily Quote Video',
    category: 'Social & Media',
    icon: 'Video',
    color: '#00e575',
    description: 'Create a short quote video and prepare it for social media.',
    isQuoteVideo: true,
    friendlyWhen: 'Every day at 7:00 PM',
    friendlyIf: 'Topic: Motivation, Love, Thirukkural, Poetry',
    friendlyThen: 'Prepare 15s quote video for Instagram & YouTube Shorts',
    defaultName: 'Daily Quote Video',
    definition: {
      nodes: [
        {
          id: 'trigger-1',
          type: 'scheduleTrigger',
          config: { cron: '0 19 * * *' },
          position: { x: 80, y: 120 },
        },
        {
          id: 'quote-video-config',
          type: 'setData',
          config: {
            templateType: 'dailyQuoteVideo',
            templateTitle: 'Daily Quote Video',
            language: 'alternate',
            topicMode: 'rotate',
            selectedTopics: ['motivation', 'love', 'humanity', 'thirukkural', 'poetry', 'meaningful'],
            duration: 15,
            visualStyle: 'auto',
            audioPreference: 'approved_library',
            platforms: ['instagram', 'youtube_shorts'],
            schedule: {
              frequency: 'daily',
              hour: '7',
              minute: '00',
              ampm: 'PM',
              cron: '0 19 * * *',
            },
            fields: [
              { key: 'automationType', value: 'dailyQuoteVideo' },
              { key: 'language', value: 'alternate' },
              { key: 'duration', value: '15' },
              { key: 'platforms', value: 'instagram, youtube_shorts' },
            ],
          },
          position: { x: 340, y: 120 },
        },
      ],
      edges: [
        { id: 'edge-1', source: 'trigger-1', target: 'quote-video-config' },
      ],
    },
  },
  {
    id: 'clean-emails',
    title: 'Clean my emails',
    category: 'Email & Inbox',
    icon: 'Mail',
    color: '#3b82f6',
    description: 'Automatically organize or remove unwanted promotional emails every morning.',
    friendlyWhen: 'Every morning at 8:00 AM',
    friendlyIf: 'Email subject or sender contains "promotional" or "newsletter"',
    friendlyThen: 'Archive and move to Trash',
    defaultName: 'Clean unwanted emails',
    definition: {
      nodes: [
        {
          id: 'trigger-1',
          type: 'scheduleTrigger',
          config: { cron: '0 8 * * *' },
          position: { x: 80, y: 120 },
        },
        {
          id: 'condition-1',
          type: 'condition',
          config: {
            left: '{{$json.category}}',
            operator: 'contains',
            right: 'promo',
          },
          position: { x: 300, y: 120 },
        },
        {
          id: 'action-1',
          type: 'email',
          config: {
            to: 'me@example.com',
            subject: 'Daily Inbox Clean Summary',
            text: 'Cleaned up promotional emails for today.',
          },
          position: { x: 540, y: 120 },
        },
      ],
      edges: [
        { id: 'edge-1', source: 'trigger-1', target: 'condition-1' },
        { id: 'edge-2', source: 'condition-1', target: 'action-1', sourceHandle: 'true' },
      ],
    },
  },
  {
    id: 'post-videos',
    title: 'Post my videos',
    category: 'Social & Media',
    icon: 'Video',
    color: '#ec4899',
    description: 'Automatically publish prepared videos and media to your Instagram or social feed.',
    friendlyWhen: 'Daily at 7:00 PM',
    friendlyIf: 'New video asset is queued and approved',
    friendlyThen: 'Publish post via media webhook and notify Slack',
    defaultName: 'Post videos to Instagram',
    definition: {
      nodes: [
        {
          id: 'trigger-1',
          type: 'scheduleTrigger',
          config: { cron: '0 19 * * *' },
          position: { x: 80, y: 120 },
        },
        {
          id: 'action-1',
          type: 'httpRequest',
          config: {
            method: 'POST',
            url: 'https://api.example.com/publish-video',
            body: '{"status":"published"}',
          },
          position: { x: 320, y: 120 },
        },
        {
          id: 'action-2',
          type: 'slack',
          config: {
            message: '🎬 Video successfully published to channels! {{$now}}',
          },
          position: { x: 560, y: 120 },
        },
      ],
      edges: [
        { id: 'edge-1', source: 'trigger-1', target: 'action-1' },
        { id: 'edge-2', source: 'action-1', target: 'action-2' },
      ],
    },
  },
  {
    id: 'organize-files',
    title: 'Organize my files',
    category: 'Productivity',
    icon: 'Folder',
    color: '#8b5cf6',
    description: 'Move, sort, and backup files and attachments automatically as they arrive.',
    friendlyWhen: 'When a new file upload or webhook is received',
    friendlyIf: 'File size or extension matches filter',
    friendlyThen: 'Process file and record entry in Google Sheets',
    defaultName: 'Organize incoming files',
    definition: {
      nodes: [
        {
          id: 'trigger-1',
          type: 'webhookTrigger',
          config: {},
          position: { x: 80, y: 120 },
        },
        {
          id: 'action-1',
          type: 'googleSheets',
          config: {
            operation: 'append',
            spreadsheetId: 'your-spreadsheet-id',
            range: 'Files!A:D',
            values: '[["{{$now}}", "{{$json.filename}}", "{{$json.size}}", "Organized"]]',
          },
          position: { x: 340, y: 120 },
        },
      ],
      edges: [
        { id: 'edge-1', source: 'trigger-1', target: 'action-1' },
      ],
    },
  },
  {
    id: 'send-alerts',
    title: 'Send me alerts',
    category: 'Notifications',
    icon: 'Bell',
    color: '#f59e0b',
    description: 'Get an immediate Slack or Email alert when something critical or urgent happens.',
    friendlyWhen: 'When an alert event or error occurs',
    friendlyIf: 'Status is urgent or score exceeds threshold',
    friendlyThen: 'Send immediate alert message to team Slack',
    defaultName: 'High priority alert to Slack',
    definition: {
      nodes: [
        {
          id: 'trigger-1',
          type: 'webhookTrigger',
          config: {},
          position: { x: 80, y: 120 },
        },
        {
          id: 'condition-1',
          type: 'condition',
          config: {
            left: '{{$json.priority}}',
            operator: 'equals',
            right: 'urgent',
          },
          position: { x: 300, y: 120 },
        },
        {
          id: 'action-1',
          type: 'slack',
          config: {
            message: '🚨 Urgent Alert: {{$json.message || "Action needed immediately!"}}',
          },
          position: { x: 540, y: 120 },
        },
      ],
      edges: [
        { id: 'edge-1', source: 'trigger-1', target: 'condition-1' },
        { id: 'edge-2', source: 'condition-1', target: 'action-1', sourceHandle: 'true' },
      ],
    },
  },
  {
    id: 'sync-sheets',
    title: 'Sync spreadsheet data',
    category: 'Data & Sync',
    icon: 'Table',
    color: '#10b981',
    description: 'Save incoming customer leads, form submissions, or purchases into Google Sheets.',
    friendlyWhen: 'When new data or form submission is received',
    friendlyIf: 'Always record',
    friendlyThen: 'Append row with timestamp and data to Google Sheet',
    defaultName: 'Sync leads to Google Sheets',
    definition: {
      nodes: [
        {
          id: 'trigger-1',
          type: 'webhookTrigger',
          config: {},
          position: { x: 80, y: 120 },
        },
        {
          id: 'action-1',
          type: 'googleSheets',
          config: {
            operation: 'append',
            spreadsheetId: 'sheet-id-here',
            range: 'Submissions!A:C',
            values: '[["{{$now}}", "{{$json.name}}", "{{$json.email}}"]]',
          },
          position: { x: 340, y: 120 },
        },
      ],
      edges: [
        { id: 'edge-1', source: 'trigger-1', target: 'action-1' },
      ],
    },
  },
  {
    id: 'daily-report',
    title: 'Daily morning report',
    category: 'Reporting',
    icon: 'BarChart2',
    color: '#6366f1',
    description: 'Fetch your daily analytics or status and send a clean summary to your team.',
    friendlyWhen: 'Every weekday at 9:00 AM',
    friendlyIf: 'Always run',
    friendlyThen: 'Fetch data via API and post summary to Slack',
    defaultName: 'Daily 9 AM status report',
    definition: {
      nodes: [
        {
          id: 'trigger-1',
          type: 'scheduleTrigger',
          config: { cron: '0 9 * * 1-5' },
          position: { x: 80, y: 120 },
        },
        {
          id: 'action-1',
          type: 'httpRequest',
          config: {
            method: 'GET',
            url: 'https://httpbin.org/json',
          },
          position: { x: 300, y: 120 },
        },
        {
          id: 'action-2',
          type: 'slack',
          config: {
            message: '☀️ Good morning! Daily briefing report generated at {{$now}}',
          },
          position: { x: 540, y: 120 },
        },
      ],
      edges: [
        { id: 'edge-1', source: 'trigger-1', target: 'action-1' },
        { id: 'edge-2', source: 'action-1', target: 'action-2' },
      ],
    },
  },
];
