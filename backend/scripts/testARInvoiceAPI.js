const axios = require('axios');

async function testAPI() {
  try {
    console.log('Testing A/R Invoice API...\n');
    
    const response = await axios.get('http://localhost:5001/api/ar-invoice/reference-data');
    
    console.log('✅ API Response Status:', response.status);
    console.log('✅ Data received:', {
      customers: response.data.customers?.length || 0,
      items: response.data.items?.length || 0,
      warehouses: response.data.warehouses?.length || 0,
      taxCodes: response.data.tax_codes?.length || 0,
      series: response.data.series?.length || 0,
    });
    
    if (response.data.warnings && response.data.warnings.length > 0) {
      console.log('\n⚠️  Warnings:', response.data.warnings);
    }
    
    console.log('\n✅ API is working!');
  } catch (error) {
    console.error('❌ API Error:', error.response?.status, error.response?.statusText);
    console.error('❌ Error details:', error.response?.data || error.message);
  }
}

testAPI();
