import {
  createMenuWindowRouteState,
  supportsMultipleMenuWindows,
} from './menuWindowNavigation';

test('allows A/P Credit Memo to open as multiple menu windows', () => {
  expect(supportsMultipleMenuWindows('/ap-credit-memo')).toBe(true);
  expect(supportsMultipleMenuWindows('/ap-invoice')).toBe(false);
});

test('creates a distinct company-scoped route identity for each new window', () => {
  const company = { companyId: 7, dbName: 'JKL TEST', serverName: 'SAP01' };
  const first = createMenuWindowRouteState({
    path: '/ap-credit-memo',
    title: 'A/P Credit Memo',
    company,
  });
  const second = createMenuWindowRouteState({
    path: '/ap-credit-memo',
    title: 'A/P Credit Memo',
    company,
  });

  expect(first.sapWindow.path).toBe('/ap-credit-memo');
  expect(first.sapWindow.title).toBe('A/P Credit Memo');
  expect(first.sapWindow.id).not.toBe(second.sapWindow.id);
  expect(first.sapCompanyScope).toBe(second.sapCompanyScope);
});

