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

// WebAuthn
export const webauthnRegisterOptions = () => api.post('/api/webauthn/register/options');
export const webauthnRegisterVerify = (response) => api.post('/api/webauthn/register/verify', response);
export const webauthnLoginOptions = (username) => api.post('/api/webauthn/login/options', { username });
export const webauthnLoginVerify = (username, response) => api.post('/api/webauthn/login/verify', { username, response });

// Burn Addresses
export const createBurnAddress = () => api.post('/api/burn-addresses/create');
export const getBurnAddresses = () => api.get('/api/burn-addresses');

// Private Drive
export const uploadDrive = (formData) => api.post('/api/drive/upload', formData);
export const getDriveFiles = () => api.get('/api/drive/files');
export const downloadDrive = (fileUuid) => api.get(`/api/drive/download/${fileUuid}`, { responseType: 'blob' });

// Steganography
export const stegoHide = (formData) => api.post('/api/steganography/hide', formData);
export const stegoExtract = (formData) => api.post('/api/steganography/extract', formData);

// Upgrade
export const upgradeTier = (tier) => api.post('/api/confirm-upgrade', { tier });

export default api;