import apiClient from './client';

export const fetchRelationshipMap = ({ objectType, docEntry }) =>
  apiClient.get(`/relationship-map/${encodeURIComponent(objectType)}/${encodeURIComponent(docEntry)}`);
