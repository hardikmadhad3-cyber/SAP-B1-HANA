/**
 * Script to check all tax codes and identify CGST+SGST combinations
 */
const db = require('../services/dbService');

async function checkTaxCodes() {
  try {
    console.log('🔍 Fetching all tax codes from SAP B1...\n');

    // Get all tax codes with their details
    const result = await db.query(`
      SELECT 
        t.TaxCode,
        t.TaxType,
        t.VatPercent AS Rate,
        t.Category,
        t.Effectivefrom,
        t.ValidForAR,
        t.ValidForAP
      FROM TAX1 t
      WHERE t.TaxType = 'Y'
      ORDER BY t.TaxCode
    `);

    const taxCodes = result.recordset || [];

    console.log(`Found ${taxCodes.length} tax codes\n`);
    console.log('=' .repeat(80));

    // Group by tax code name
    const grouped = {};
    taxCodes.forEach(tc => {
      if (!grouped[tc.TaxCode]) {
        grouped[tc.TaxCode] = [];
      }
      grouped[tc.TaxCode].push(tc);
    });

    // Analyze each tax code
    console.log('\n📊 TAX CODE ANALYSIS:\n');

    Object.keys(grouped).sort().forEach(code => {
      const entries = grouped[code];
      const totalRate = entries.reduce((sum, e) => sum + (e.Rate || 0), 0);
      const codeUpper = code.toUpperCase();
      
      let type = 'UNKNOWN';
      if (codeUpper.includes('IGST')) {
        type = 'IGST (Interstate)';
      } else if (codeUpper.includes('CGST') && codeUpper.includes('SGST')) {
        type = 'CGST+SGST (Intrastate)';
      } else if (codeUpper.includes('CGST')) {
        type = 'CGST Only';
      } else if (codeUpper.includes('SGST')) {
        type = 'SGST Only';
      } else if (codeUpper.includes('GST')) {
        type = 'GST';
      }

      console.log(`Code: ${code}`);
      console.log(`  Type: ${type}`);
      console.log(`  Total Rate: ${totalRate}%`);
      console.log(`  Components: ${entries.length}`);
      
      if (entries.length > 1) {
        entries.forEach((e, i) => {
          console.log(`    Component ${i + 1}: ${e.Rate}% (Category: ${e.Category || 'N/A'})`);
        });
      }
      
      console.log('');
    });

    console.log('=' .repeat(80));
    console.log('\n✅ RECOMMENDED TAX CODES:\n');

    // Find CGST+SGST codes
    const cgstSgstCodes = Object.keys(grouped).filter(code => {
      const codeUpper = code.toUpperCase();
      return (codeUpper.includes('CGST') && codeUpper.includes('SGST')) || 
             (codeUpper.includes('CS') && !codeUpper.includes('IGST'));
    });

    // Find IGST codes
    const igstCodes = Object.keys(grouped).filter(code => 
      code.toUpperCase().includes('IGST')
    );

    console.log('For INTRASTATE transactions (same state):');
    if (cgstSgstCodes.length > 0) {
      cgstSgstCodes.forEach(code => {
        const totalRate = grouped[code].reduce((sum, e) => sum + (e.Rate || 0), 0);
        console.log(`  ✓ ${code} (${totalRate}%)`);
      });
    } else {
      console.log('  ⚠️  No CGST+SGST codes found');
    }

    console.log('\nFor INTERSTATE transactions (different state):');
    if (igstCodes.length > 0) {
      igstCodes.forEach(code => {
        const totalRate = grouped[code].reduce((sum, e) => sum + (e.Rate || 0), 0);
        console.log(`  ✓ ${code} (${totalRate}%)`);
      });
    } else {
      console.log('  ⚠️  No IGST codes found');
    }

    console.log('\n' + '='.repeat(80));

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkTaxCodes();
