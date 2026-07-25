const sap = require('../services/sapService');

async function run() {
  await sap.login();

  // Find correct field names for VatGroups, PaymentTermsTypes, ShippingTypes
  const [vat, pt, ship] = await Promise.all([
    sap.request({ method: 'get', url: '/VatGroups?$top=1' }),
    sap.request({ method: 'get', url: '/PaymentTermsTypes?$top=1' }),
    sap.request({ method: 'get', url: '/ShippingTypes?$top=1' }),
  ]);
  console.log('VatGroups fields:', Object.keys(vat.data?.value?.[0] || {}));
  console.log('PaymentTermsTypes fields:', Object.keys(pt.data?.value?.[0] || {}));
  console.log('ShippingTypes fields:', Object.keys(ship.data?.value?.[0] || {}));
  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
