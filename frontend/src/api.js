import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
export const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED === 'true';

const client = axios.create({ baseURL: API_BASE });

client.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('flowbox_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (!AUTH_ENABLED) {
    // Development mode bypass token for local dev user
    config.headers.Authorization = 'Bearer dev-local-user';
  }
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    // Only redirect to login if authentication is enabled
    if (err.response?.status === 401 && AUTH_ENABLED) {
      sessionStorage.removeItem('flowbox_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const api = {
  login: (username, password) => client.post('/auth/login', { username, password }),
  listWorkflows: () => client.get('/api/workflows'),
  getWorkflow: (id) => client.get(`/api/workflows/${id}`),
  createWorkflow: (data) => client.post('/api/workflows', data),
  updateWorkflow: (id, data) => client.put(`/api/workflows/${id}`, data),
  deleteWorkflow: (id) => client.delete(`/api/workflows/${id}`),
  runWorkflow: (id, payload) => client.post(`/api/workflows/${id}/run`, { payload }),
  listRuns: (id) => client.get(`/api/workflows/${id}/runs`),
  getRun: (id, runId) => client.get(`/api/workflows/${id}/runs/${runId}`),
  prepareQuote: (id, options = {}) => client.post(`/api/workflows/${id}/prepare-quote`, options),
  getLatestQuoteJob: (id) => client.get(`/api/workflows/${id}/quote-jobs/latest`),
  renderQuoteJob: (workflowId, jobId, options = {}) =>
    client.post(`/api/workflows/${workflowId}/quote-jobs/${jobId}/render`, options),
  getVideoUrl: (jobId) => {
    const token = sessionStorage.getItem('flowbox_token') || (!AUTH_ENABLED ? 'dev-local-user' : '');
    return `${API_BASE}/api/quote-video-jobs/${jobId}/video${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },
  listCredentials: () => client.get('/api/credentials'),
  createCredential: (data) => client.post('/api/credentials', data),
  deleteCredential: (id) => client.delete(`/api/credentials/${id}`),
};

export { API_BASE };
