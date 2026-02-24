import axios from 'axios';

const api = axios.create({
  baseURL: '/',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Email API functions
export const email = async (id) => {
  const response = await api.get(`/api/email/${id}`);
  return response.data;
};

export const emails = async () => {
  const response = await api.get('/api/emails');
  return response.data;
};

export const send = async (to, subject, body) => {
  const response = await api.post('/api/send', { to, subject, body });
  return response.data;
};

export const markRead = async (id) => {
  const response = await api.post(`/api/mark_read/${id}`);
  return response.data;
};

export const rootCert = async () => {
  const response = await api.get('/api/root_cert');
  return response.data;
};

export const requireLogin = async () => {
  try {
    await api.get('/api/me');
  } catch (error) {
    if (error.response?.status === 401) {
      window.location.href = '/login';
    }
    throw error;
  }
};

export default api;