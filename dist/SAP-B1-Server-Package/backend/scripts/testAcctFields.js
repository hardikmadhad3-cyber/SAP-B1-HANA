require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const sapService = require('../services/sapService');

async function run() {
  const d = await sapService.getItem('00008-SM-000-0001');
  const acctFields = [
    'IncomeAccount','ExemptIncomeAccount','ExpanseAccount',
    'ForeignRevenuesAccount','ECRevenuesAccount','ForeignExpensesAccount','ECExpensesAccount',
    'GLMethod','TaxType','ArTaxCode','ApTaxCode','VatLiable','WTLiable','IndirectTax',
    'SalesVATGroup','PurchaseVATGroup',
  ];
  console.log('=== Accounting Fields ===');
  acctFields.forEach(f => console.log(`${f}: ${d[f]}`));

  // Also check what the warehouse collection has for GL accounts
  const wh = d.ItemWarehouseInfoCollection?.[0];
  if (wh) {
    console.log('\n=== Warehouse GL (WH 01) ===');
    const glKeys = Object.keys(wh).filter(k => k.toLowerCase().includes('account') || k.toLowerCase().includes('acct'));
    glKeys.forEach(k => console.log(`  ${k}: ${wh[k]}`));
  }
}
run().catch(e => console.error(e.response?.data?.error?.message?.value || e.message));
