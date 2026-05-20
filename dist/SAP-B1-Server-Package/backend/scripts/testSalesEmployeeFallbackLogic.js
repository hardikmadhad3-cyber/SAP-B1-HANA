/**
 * Test script for Sales Employee Fallback Logic
 * Tests the complete flow: salesEmployee → purchaser fallback → ODBC lookup → Service Layer
 */

require('dotenv').config();

// Mock ODBC data (simulating what comes from database)
const mockSalesEmployees = [
  { SlpCode: 1, SlpName: 'ASM' },
  { SlpCode: 2, SlpName: 'Deepak Kothari' },
  { SlpCode: 3, SlpName: 'Dhaval' },
  { SlpCode: 4, SlpName: 'Mala Garma' },
  { SlpCode: 5, SlpName: 'OM' },
  { SlpCode: 6, SlpName: 'Rajkumar Munjal' },
  { SlpCode: 7, SlpName: 'Zach Ibarra' },
];

/**
 * Simulate the fallback logic
 */
function determineSalesEmployeeInput(salesEmployee, purchaser) {
  console.log('\n🔍 STEP 1: Determine Final Input');
  console.log('  Input salesEmployee:', salesEmployee);
  console.log('  Input purchaser:', purchaser);
  
  let finalInput = salesEmployee;
  
  // Apply fallback logic
  if (!finalInput || finalInput === '-1' || finalInput === -1) {
    console.log('  ⚠️  salesEmployee is empty or -1, falling back to purchaser');
    finalInput = purchaser;
  }
  
  console.log('  🎯 Final Input:', finalInput);
  return finalInput;
}

/**
 * Simulate the conversion logic
 */
function convertToSlpCode(input, salesEmployees) {
  console.log('\n🔍 STEP 2: Convert to SlpCode');
  console.log('  Input:', input);
  
  // Handle empty or -1
  if (!input || input === '-1' || input === -1 || String(input).trim() === '') {
    console.log('  🔹 Result: null (empty or -1)');
    return null;
  }
  
  // If numeric, return as-is
  if (!isNaN(input) && Number(input) !== -1) {
    const code = Number(input);
    console.log('  🔹 Result:', code, '(already numeric)');
    return code;
  }
  
  // Search in ODBC data
  const name = String(input).trim();
  console.log('  🔍 Searching in ODBC data for:', name);
  console.log('  📚 Available:', salesEmployees.map(e => e.SlpName).join(', '));
  
  const found = salesEmployees.find(emp => 
    String(emp.SlpName || '').trim().toLowerCase() === name.toLowerCase()
  );
  
  if (found) {
    console.log('  ✅ Found in ODBC:', name, '→ SlpCode:', found.SlpCode);
    return found.SlpCode;
  }
  
  console.log('  ⚠️  Not found in ODBC (would search Service Layer API in real scenario)');
  return null;
}

/**
 * Build SAP payload
 */
function buildSAPPayload(SlpCode) {
  console.log('\n🔍 STEP 3: Build SAP Payload');
  
  const payload = {
    CardCode: 'CUS00175',
    DocDate: '2026-04-04',
  };
  
  // Only add if not null/undefined
  if (SlpCode !== null && SlpCode !== undefined) {
    payload.SalesPersonCode = SlpCode;
    console.log('  ✅ Added SalesPersonCode:', SlpCode);
  } else {
    console.log('  ⚠️  SalesPersonCode not added (null/undefined)');
  }
  
  return payload;
}

/**
 * Run test case
 */
function runTestCase(testName, salesEmployee, purchaser, expectedSlpCode) {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('🧪 TEST CASE:', testName);
  console.log('═══════════════════════════════════════════════════');
  
  // Step 1: Determine input
  const finalInput = determineSalesEmployeeInput(salesEmployee, purchaser);
  
  // Step 2: Convert to SlpCode
  const SlpCode = convertToSlpCode(finalInput, mockSalesEmployees);
  
  // Step 3: Build SAP payload
  const sapPayload = buildSAPPayload(SlpCode);
  
  // Verify result
  console.log('\n📊 RESULT:');
  console.log('  Expected SlpCode:', expectedSlpCode);
  console.log('  Actual SlpCode:', SlpCode);
  console.log('  SAP Payload:', JSON.stringify(sapPayload, null, 2));
  
  const passed = SlpCode === expectedSlpCode;
  console.log(passed ? '  ✅ PASSED' : '  ❌ FAILED');
  
  return passed;
}

/**
 * Run all tests
 */
function runAllTests() {
  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║  Sales Employee Fallback Logic Test Suite        ║');
  console.log('╚═══════════════════════════════════════════════════╝');
  
  const results = [];
  
  // Test 1: salesEmployee = '-1', purchaser = 'ASM'
  results.push(runTestCase(
    'Fallback to purchaser (ASM)',
    '-1',
    'ASM',
    1
  ));
  
  // Test 2: salesEmployee = '-1', purchaser = 'Deepak Kothari'
  results.push(runTestCase(
    'Fallback to purchaser (Deepak Kothari)',
    '-1',
    'Deepak Kothari',
    2
  ));
  
  // Test 3: salesEmployee = 'Dhaval', purchaser = 'ASM'
  results.push(runTestCase(
    'Use salesEmployee (Dhaval)',
    'Dhaval',
    'ASM',
    3
  ));
  
  // Test 4: salesEmployee = '5', purchaser = 'ASM'
  results.push(runTestCase(
    'Numeric salesEmployee (5)',
    '5',
    'ASM',
    5
  ));
  
  // Test 5: salesEmployee = '-1', purchaser = ''
  results.push(runTestCase(
    'Both empty',
    '-1',
    '',
    null
  ));
  
  // Test 6: salesEmployee = '', purchaser = 'OM'
  results.push(runTestCase(
    'Empty salesEmployee, fallback to purchaser (OM)',
    '',
    'OM',
    5
  ));
  
  // Test 7: Case insensitive matching
  results.push(runTestCase(
    'Case insensitive (asm)',
    '-1',
    'asm',
    1
  ));
  
  // Test 8: Not found in ODBC
  results.push(runTestCase(
    'Not found in ODBC (Devraj)',
    '-1',
    'Devraj',
    null
  ));
  
  // Summary
  console.log('\n═══════════════════════════════════════════════════');
  console.log('📊 TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════');
  const passed = results.filter(r => r).length;
  const total = results.length;
  console.log(`  Passed: ${passed}/${total}`);
  console.log(`  Failed: ${total - passed}/${total}`);
  console.log(passed === total ? '  ✅ ALL TESTS PASSED' : '  ❌ SOME TESTS FAILED');
  console.log('═══════════════════════════════════════════════════\n');
}

// Run tests
runAllTests();
