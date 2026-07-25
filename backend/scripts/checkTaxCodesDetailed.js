/**
 * Check Tax Codes in SAP B1 Database
 * This script fetches all tax codes and shows their structure
 */

const db = require('../services/dbService');

async function checkTaxCodes() {
  try {
    console.log('🔍 Fetching Tax Codes from SAP B1...\n');

    // Get tax codes with details
    const result = await db.query(`
      SELECT 
        T0.Code,
        T0.Name,
        T0.Rate AS HeaderRate,
        T1.TaxType,
        T1.Rate AS LineRate,
        T1.Category
      FROM OVTG T0
      INNER JOIN VTG1 T1 ON T0.Code = T1.Code
      ORDER BY T0.Code, T1.TaxType
    `);

    console.log(`Found ${result.recordset.length} tax code entries\n`);
    console.log('═══════════════════════════════════════════════════════════════');

    // Group by tax code
    const grouped = {};
    result.recordset.forEach(row => {
      if (!grouped[row.Code]) {
        // Determine GST Type
        const taxTypes = [];
        result.recordset.filter(r => r.Code === row.Code).forEach(r => {
          if (!taxTypes.includes(r.TaxType)) taxTypes.push(r.TaxType);
        });
        
        let gstType = 'OTHER';
        if (taxTypes.length === 2 && taxTypes.includes('C') && taxTypes.includes('S')) {
          gstType = 'INTRASTATE';
        } else if (taxTypes.includes('I')) {
          gstType = 'INTERSTATE';
        }
        
        grouped[row.Code] = {
          code: row.Code,
          name: row.Name,
          gstType: gstType,
          components: []
        };
      }
      grouped[row.Code].components.push({
        taxType: row.TaxType,
        rate: row.LineRate,
        category: row.Category
      });
    });

    // Display grouped results
    Object.values(grouped).forEach(tax => {
      console.log(`\nCode: ${tax.code}`);
      console.log(`Name: ${tax.name}`);
      console.log(`GST Type: ${tax.gstType}`);
      console.log(`Components:`);
      tax.components.forEach(comp => {
        const typeLabel = comp.taxType === 'I' ? 'IGST' : 
                         comp.taxType === 'C' ? 'CGST' : 
                         comp.taxType === 'S' ? 'SGST' : comp.taxType;
        console.log(`  - ${typeLabel}: ${comp.rate}% (Category: ${comp.category || 'N/A'})`);
      });
      console.log('───────────────────────────────────────────────────────────────');
    });

    // Summary by GST Type
    console.log('\n\n📊 SUMMARY BY GST TYPE:\n');
    
    const intrastate = Object.values(grouped).filter(t => t.gstType === 'INTRASTATE');
    const interstate = Object.values(grouped).filter(t => t.gstType === 'INTERSTATE');
    const other = Object.values(grouped).filter(t => t.gstType === 'OTHER');

    console.log(`INTRASTATE (CGST + SGST): ${intrastate.length} codes`);
    intrastate.forEach(t => {
      const totalRate = t.components.reduce((sum, c) => sum + c.rate, 0);
      console.log(`  ${t.code} - ${t.name} (Total: ${totalRate}%)`);
    });

    console.log(`\nINTERSTATE (IGST): ${interstate.length} codes`);
    interstate.forEach(t => {
      const totalRate = t.components.reduce((sum, c) => sum + c.rate, 0);
      console.log(`  ${t.code} - ${t.name} (Total: ${totalRate}%)`);
    });

    console.log(`\nOTHER: ${other.length} codes`);
    other.forEach(t => {
      const totalRate = t.components.reduce((sum, c) => sum + c.rate, 0);
      console.log(`  ${t.code} - ${t.name} (Total: ${totalRate}%)`);
    });

    console.log('\n✅ Tax code check complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

checkTaxCodes();
