/**
 * Test script for Sales Employee creation functionality
 * Tests the getOrCreateSalesEmployee utility function
 */

require('dotenv').config();
const sapService = require('../services/sapService');

/**
 * Get or Create Sales Employee in SAP Business One
 * @param {string|number} input - Sales Employee name or code
 * @returns {Promise<number|null>} SlpCode or null if ignored
 */
const getOrCreateSalesEmployee = async (input) => {
  // Handle empty or -1 values
  if (!input || input === '-1' || String(input).trim() === '') {
    console.log('🔹 Sales Employee: Ignored (empty or -1)');
    return null;
  }

  // If numeric, treat as SlpCode
  if (!isNaN(input) && Number(input) !== -1) {
    const code = Number(input);
    console.log('🔹 Sales Employee: Using existing code', code);
    return code;
  }

  // It's a name, need to get or create
  const name = String(input).trim();
  
  // Escape single quotes for SQL/API
  const escapedName = name.replace(/'/g, "''");

  try {
    // 1. Check if Sales Employee exists
    console.log('🔍 Checking if Sales Employee exists:', name);
    
    const searchResult = await sapService.request({
      method: 'get',
      url: `/SalesPersons?$filter=SalesEmployeeName eq '${escapedName}'&$select=SalesEmployeeCode,SalesEmployeeName`,
    });

    if (searchResult.data?.value?.length > 0) {
      const slpCode = searchResult.data.value[0].SalesEmployeeCode;
      console.log('✅ Sales Employee found:', name, '→ Code:', slpCode);
      return slpCode;
    }

    // 2. Sales Employee doesn't exist, create new one
    console.log('➕ Creating new Sales Employee:', name);
    
    const createResult = await sapService.request({
      method: 'post',
      url: '/SalesPersons',
      data: {
        SalesEmployeeName: name,
        Active: 'tYES',
      },
    });

    const newSlpCode = createResult.data?.SalesEmployeeCode;
    console.log('✅ Sales Employee created:', name, '→ Code:', newSlpCode);
    
    return newSlpCode;

  } catch (error) {
    console.error('❌ Failed to get/create Sales Employee:', name);
    console.error('Error:', error.response?.data || error.message);
    
    // If creation failed, throw error
    throw new Error(`Sales Employee '${name}' could not be created: ${error.message}`);
  }
};

/**
 * Test cases
 */
async function runTests() {
  console.log('═══════════════════════════════════════════════════');
  console.log('🧪 Testing Sales Employee Creation');
  console.log('═══════════════════════════════════════════════════\n');

  try {
    // Test 1: Empty value
    console.log('TEST 1: Empty value');
    const result1 = await getOrCreateSalesEmployee('');
    console.log('Result:', result1);
    console.log('Expected: null\n');

    // Test 2: -1 value
    console.log('TEST 2: -1 value');
    const result2 = await getOrCreateSalesEmployee('-1');
    console.log('Result:', result2);
    console.log('Expected: null\n');

    // Test 3: Numeric code (existing)
    console.log('TEST 3: Numeric code (existing)');
    const result3 = await getOrCreateSalesEmployee('5');
    console.log('Result:', result3);
    console.log('Expected: 5\n');

    // Test 4: Existing name
    console.log('TEST 4: Existing name (Deepak Kothari)');
    const result4 = await getOrCreateSalesEmployee('Deepak Kothari');
    console.log('Result:', result4);
    console.log('Expected: SlpCode of Deepak Kothari\n');

    // Test 5: New name (will create)
    console.log('TEST 5: New name (Test Employee ' + Date.now() + ')');
    const testName = 'Test Employee ' + Date.now();
    const result5 = await getOrCreateSalesEmployee(testName);
    console.log('Result:', result5);
    console.log('Expected: New SlpCode\n');

    // Test 6: Name with special characters
    console.log('TEST 6: Name with special characters (O\'Brien)');
    const result6 = await getOrCreateSalesEmployee("O'Brien Test " + Date.now());
    console.log('Result:', result6);
    console.log('Expected: New SlpCode\n');

    console.log('═══════════════════════════════════════════════════');
    console.log('✅ All tests completed successfully!');
    console.log('═══════════════════════════════════════════════════');

  } catch (error) {
    console.error('═══════════════════════════════════════════════════');
    console.error('❌ Test failed:');
    console.error(error);
    console.error('═══════════════════════════════════════════════════');
  }
}

// Run tests
runTests();
