const db = require('../services/dbService');

async function run() {
  // Check OVTG and OBPL columns + data
  const [ovtgCols, obplCols, ovtgData, obplData, ougpData, ugp1Data, ouomData] = await Promise.all([
    db.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='OVTG'"),
    db.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='OBPL'"),
    db.query("SELECT TOP 3 * FROM OVTG"),
    db.query("SELECT TOP 3 * FROM OBPL"),
    db.query("SELECT TOP 3 * FROM OUGP"),
    db.query("SELECT TOP 3 * FROM UGP1"),
    db.query("SELECT TOP 3 * FROM OUOM"),
  ]);
  console.log('OVTG columns:', ovtgCols.recordset.map(r => r.COLUMN_NAME));
  console.log('OBPL columns:', obplCols.recordset.map(r => r.COLUMN_NAME));
  console.log('OVTG data:', JSON.stringify(ovtgData.recordset[0]));
  console.log('OBPL data:', JSON.stringify(obplData.recordset[0]));
  console.log('OUGP data:', JSON.stringify(ougpData.recordset[0]));
  console.log('UGP1 data:', JSON.stringify(ugp1Data.recordset[0]));
  console.log('OUOM data:', JSON.stringify(ouomData.recordset[0]));
  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
