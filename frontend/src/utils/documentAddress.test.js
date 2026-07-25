import { normalizeBusinessPartnerAddress } from './documentAddress';

describe('normalizeBusinessPartnerAddress', () => {
  test('normalizes SQL Server rows and supplies the selected customer code', () => {
    expect(normalizeBusinessPartnerAddress({
      Address: ' MAIN ',
      AdresType: 'B ',
      Street: 'Market Road',
      GSTRegnNo: '24ABCDE1234F1Z5',
    }, 'C0001')).toMatchObject({
      CardCode: 'C0001',
      Address: 'MAIN',
      AdresType: 'B',
      Street: 'Market Road',
      GSTIN: '24ABCDE1234F1Z5',
    });
  });

  test('normalizes uppercase HANA result keys', () => {
    expect(normalizeBusinessPartnerAddress({
      CARDCODE: 'C0002',
      ADDRESS: 'SHIPPING',
      ADRESTYPE: 'S',
      STREET: 'Second Street',
      STATE: 'GJ',
    })).toMatchObject({
      CardCode: 'C0002',
      Address: 'SHIPPING',
      AdresType: 'S',
      Street: 'Second Street',
      State: 'GJ',
    });
  });
});
