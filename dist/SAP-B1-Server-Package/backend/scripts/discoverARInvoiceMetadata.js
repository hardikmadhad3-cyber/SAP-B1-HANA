require('dotenv').config({ path: '../.env' });
const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
};

async function discoverMetadata() {
  try {
    await sql.connect(config);
    console.log('Connected to SQL Server\n');

    // Discover OCRD (Customer) columns
    console.log('=== OCRD (Customers) Columns ===');
    const ocrdCols = await sql.query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'OCRD' 
      AND COLUMN_NAME LIKE '%GST%' OR COLUMN_NAME LIKE '%State%' OR COLUMN_NAME = 'CardCode'
      ORDER BY COLUMN_NAME
    `);
    console.log(ocrdCols.recordset);

    // Discover OITM (Items) columns
    console.log('\n=== OITM (Items) Columns ===');
    const oitmCols = await sql.query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'OITM' 
      AND (COLUMN_NAME LIKE '%HSN%' OR COLUMN_NAME LIKE '%UoM%' OR COLUMN_NAME = 'ItemCode')
      ORDER BY COLUMN_NAME
    `);
    console.log(oitmCols.recordset);

    // Discover OSTC (Tax Codes) columns
    console.log('\n=== OSTC (Tax Codes) Columns ===');
    const ostcCols = await sql.query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'OSTC'
      ORDER BY COLUMN_NAME
    `);
    console.log(ostcCols.recordset);

    // Discover OBPL (Branches) columns
    console.log('\n=== OBPL (Branches) Columns ===');
    const obplCols = await sql.query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'OBPL'
      ORDER BY COLUMN_NAME
    `);
    console.log(obplCols.recordset);

    // Discover OADM (Admin/Decimal Settings) columns
    console.log('\n=== OADM (Admin) Columns ===');
    const oadmCols = await sql.query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'OADM'
      AND COLUMN_NAME LIKE '%Qry%'
      ORDER BY COLUMN_NAME
    `);
    console.log(oadmCols.recordset);

    // Discover UGP1 (UoM Group Lines) columns
    console.log('\n=== UGP1 (UoM Lines) Columns ===');
    const ugp1Cols = await sql.query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'UGP1'
      ORDER BY COLUMN_NAME
    `);
    console.log(ugp1Cols.recordset);

    // Discover OCST (States) table
    console.log('\n=== OCST (States) Columns ===');
    const ocstCols = await sql.query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'OCST'
      ORDER BY COLUMN_NAME
    `);
    console.log(ocstCols.recordset);

    // Test actual data
    console.log('\n=== Sample Customer Data ===');
    const sampleCustomer = await sql.query(`SELECT TOP 1 * FROM OCRD WHERE CardType = 'C'`);
    if (sampleCustomer.recordset.length > 0) {
      console.log('Available columns:', Object.keys(sampleCustomer.recordset[0]));
    }

    console.log('\n=== Sample Item Data ===');
    const sampleItem = await sql.query(`SELECT TOP 1 * FROM OITM`);
    if (sampleItem.recordset.length > 0) {
      console.log('Available columns:', Object.keys(sampleItem.recordset[0]));
    }

    await sql.close();
    console.log('\nMetadata discovery complete!');
  } catch (err) {
    console.error('Error:', err);
  }
}

discoverMetadata();
