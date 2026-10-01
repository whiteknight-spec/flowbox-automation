export const NODE_DEFS = {
  manualTrigger: { label: 'Manual Trigger', category: 'trigger', color: '#6366f1', fields: [] },
  webhookTrigger: { label: 'Webhook Trigger', category: 'trigger', color: '#6366f1', fields: [] },
  scheduleTrigger: {
    label: 'Schedule Trigger',
    category: 'trigger',
    color: '#6366f1',
    fields: [{ key: 'cron', label: 'Cron expression', placeholder: '*/15 * * * *' }],
  },
  httpRequest: {
    label: 'HTTP Request',
    color: '#0ea5e9',
    fields: [
      { key: 'method', label: 'Method', type: 'select', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
      { key: 'url', label: 'URL', placeholder: 'https://api.example.com/{{$json.id}}' },
      { key: 'credentialId', label: 'Auth header credential (optional)', type: 'credential' },
      { key: 'body', label: 'Body (JSON, optional)', type: 'json' },
    ],
  },
  slack: {
    label: 'Slack Message',
    color: '#22c55e',
    fields: [
      { key: 'credentialId', label: 'Slack credential', type: 'credential' },
      { key: 'message', label: 'Message', placeholder: 'New event: {{$json.body.title}}' },
    ],
  },
  email: {
    label: 'Send Email',
    color: '#f97316',
    fields: [
      { key: 'credentialId', label: 'SMTP credential', type: 'credential' },
      { key: 'to', label: 'To' },
      { key: 'subject', label: 'Subject' },
      { key: 'text', label: 'Body text' },
    ],
  },
  googleSheets: {
    label: 'Google Sheets',
    color: '#16a34a',
    fields: [
      { key: 'credentialId', label: 'Credential', type: 'credential' },
      { key: 'operation', label: 'Operation', type: 'select', options: ['append', 'read'] },
      { key: 'spreadsheetId', label: 'Spreadsheet ID' },
      { key: 'range', label: 'Range', placeholder: 'Sheet1!A1' },
      { key: 'values', label: 'Values to append (JSON array of arrays)', type: 'json' },
    ],
  },
  condition: {
    label: 'If Condition',
    color: '#eab308',
    outputs: ['true', 'false'],
    fields: [
      { key: 'left', label: 'Left value', placeholder: '{{$json.status}}' },
      {
        key: 'operator',
        label: 'Operator',
        type: 'select',
        options: ['equals', 'notEquals', 'contains', 'greaterThan', 'lessThan', 'isEmpty', 'isNotEmpty'],
      },
      { key: 'right', label: 'Right value' },
    ],
  },
  setData: {
    label: 'Set Data',
    color: '#a855f7',
    fields: [{ key: 'fields', label: 'Fields (one per line: key=value)', type: 'keyvalue' }],
  },
  code: {
    label: 'Code',
    color: '#64748b',
    fields: [{ key: 'code', label: 'JavaScript (return a value)', type: 'code' }],
  },
};

export const PALETTE_GROUPS = [
  { title: 'Triggers', types: ['manualTrigger', 'webhookTrigger', 'scheduleTrigger'] },
  { title: 'Actions', types: ['httpRequest', 'slack', 'email', 'googleSheets'] },
  { title: 'Logic', types: ['condition', 'setData', 'code'] },
];
