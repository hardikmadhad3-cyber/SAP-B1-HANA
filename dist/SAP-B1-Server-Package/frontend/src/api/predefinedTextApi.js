import apiClient from './client';

const fetchPredefinedTexts = (query = '') =>
  apiClient.get('/predefined-texts', {
    params: query ? { query } : {},
  }).then((response) => response.data?.texts || []);

const createPredefinedText = ({ textCode, text }) =>
  apiClient.post('/predefined-texts', { textCode, text })
    .then((response) => response.data);

export {
  createPredefinedText,
  fetchPredefinedTexts,
};
