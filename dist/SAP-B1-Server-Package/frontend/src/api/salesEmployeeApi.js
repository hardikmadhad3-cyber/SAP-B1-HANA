import apiClient from './client';

const saveSalesEmployeesSetup = (employees = []) =>
  apiClient.post('/delivery/sales-employees/setup', { employees });

export {
  saveSalesEmployeesSetup,
};
