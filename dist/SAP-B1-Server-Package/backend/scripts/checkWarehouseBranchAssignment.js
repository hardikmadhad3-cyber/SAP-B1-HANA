/**
 * Check Warehouse-Branch Assignments in SAP B1
 */

const db = require('../services/dbService');

async function checkWarehouseBranchAssignment() {
  try {
    console.log('🔍 Checking Warehouse-Branch Assignments...\n');

    // Get all warehouses with their branch assignments
    const result = await db.query(`
      SELECT 
        T0.WhsCode,
        T0.WhsName,
        T0.BPLid AS BranchID,
        T1.BPLName AS BranchName,
        T0.Inactive,
        T0.Street,
        T0.City,
        T0.State
      FROM OWHS T0
      LEFT JOIN OBPL T1 ON T0.BPLid = T1.BPLId
      ORDER BY T0.BPLid, T0.WhsCode
    `);

    console.log(`Found ${result.recordset.length} warehouses\n`);
    console.log('═══════════════════════════════════════════════════════════════');

    // Group by branch
    const byBranch = {};
    result.recordset.forEach(row => {
      const branchId = row.BranchID || 'Unassigned';
      if (!byBranch[branchId]) {
        byBranch[branchId] = {
          branchId: row.BranchID,
          branchName: row.BranchName || 'Unassigned',
          warehouses: []
        };
      }
      byBranch[branchId].warehouses.push({
        code: row.WhsCode,
        name: row.WhsName,
        inactive: row.Inactive,
        city: row.City,
        state: row.State
      });
    });

    // Display by branch
    Object.values(byBranch).forEach(branch => {
      console.log(`\n📍 Branch: ${branch.branchName} (ID: ${branch.branchId})`);
      console.log(`   Warehouses: ${branch.warehouses.length}`);
      console.log('   ───────────────────────────────────────────────────────────');
      
      branch.warehouses.forEach(wh => {
        const status = wh.inactive === 'Y' ? '❌ INACTIVE' : '✅ Active';
        console.log(`   ${wh.code.padEnd(15)} - ${wh.name.padEnd(30)} ${status}`);
        if (wh.city || wh.state) {
          console.log(`   ${' '.repeat(15)}   📍 ${wh.city || ''}, ${wh.state || ''}`);
        }
      });
    });

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('\n💡 SOLUTION:');
    console.log('   To fix the error, either:');
    console.log('   1. Assign warehouse "BS FG" to Branch 1 in SAP B1');
    console.log('   2. Select a different warehouse that is assigned to Branch 1');
    console.log('   3. Change the branch to match the warehouse assignment');
    console.log('\n✅ Check complete!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

checkWarehouseBranchAssignment();
