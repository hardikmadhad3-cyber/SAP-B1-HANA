import axios from 'axios';
import { API_BASE_URL } from '../config/appConfig';
import { getActiveToken } from '../auth/storage';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

apiClient.interceptors.request.use((config) => {
  const token = getActiveToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default apiClient;
