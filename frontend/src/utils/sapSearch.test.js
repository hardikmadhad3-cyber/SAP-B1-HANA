import {
  matchesSapSearchText,
  normalizeSapSearchText,
} from './sapSearch';

test('normalizes quoted and spaced SAP lookup text', () => {
  expect(normalizeSapSearchText('"SACHIN RADHESHAM ZANWAR "')).toBe('sachin radhesham zanwar');
});

test('matches exact names when quotes or trailing spaces differ', () => {
  expect(matchesSapSearchText('"SACHIN RADHESHAM ZANWAR "', '"SACHIN RADHESHAM ZANWAR"')).toBe(true);
});

test('matches similar word searches in any order', () => {
  expect(matchesSapSearchText('MAMTA SACHIN ZANWAR', 'zanwar sachin')).toBe(true);
});
