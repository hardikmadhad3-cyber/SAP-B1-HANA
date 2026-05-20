const express = require('express');
const axios = require('axios');
const https = require('https');
const env = require('../config/env');
const sapService = require('../services/sapService');

const router = express.Router();

const agent = new https.Agent({
  rejectUnauthorized: env.sapRejectUnauthorized
});

let sessionCookie = "";

const getSapErrorDetail = (err) => {
  if (err.response?.data?.error?.message?.value) {
    return err.response.data.error.message.value;
  }

  if (typeof err.response?.data === 'string' && err.response.data) {
    return err.response.data;
  }

  if (err.code && err.message) {
    return `${err.code}: ${err.message}`;
  }

  return err.message || 'Unknown SAP login error';
};

// SAP service layer session bootstrap
router.post('/sap-session/login', async (req, res) => {
  try {
    const companyDb = await sapService.resolveCompanyDb({ companyDb: req.body?.companyDb });
    const response = await axios.post(
      `${env.sapBaseUrl}/Login`,
      {
        UserName: env.sapUsername,
        Password: env.sapPassword,
        CompanyDB: companyDb,
      },
      { httpsAgent: agent }
    );

    sessionCookie = response.headers['set-cookie'];
     res.json({ message: 'SAP Login Successful', companyDb });

  } catch (err) {
    const detail = getSapErrorDetail(err);
    console.log(err.response?.data || err.code || err.message);
    res.status(500).json({ detail, sap_base_url: env.sapBaseUrl });
  }
});


// GET ITEMS
router.get('/items', async (req, res) => {
  try {

    const response = await axios.get(`${env.sapBaseUrl}/Items?$top=20`, {
      headers: { Cookie: sessionCookie },
      httpsAgent: agent
    });

    res.json(response.data.value);

  } catch (err) {
    const detail = getSapErrorDetail(err);
    console.log(err.response?.data || err.code || err.message);
    res.status(500).json({ detail, sap_base_url: env.sapBaseUrl });
  }
});
router.post('/items', async (req, res) => {

  try {

    const response = await axios.post(
      `${env.sapBaseUrl}/Items`,
      req.body,
      {
        headers: { Cookie: sessionCookie },
        httpsAgent: agent
      }
    );
    console.log('Method:', req.method)
    console.log('Item:', req.params.code)
    console.log('Body:', req.body)
    res.json(response.data);

  } catch (err) {
    const detail = getSapErrorDetail(err);
    console.log(err.response?.data || err.code || err.message);
    res.status(500).json({ detail, sap_base_url: env.sapBaseUrl });
  }

});
router.patch('/items/:code', async (req, res) => {

  try {

    const response = await axios.patch(
      `${env.sapBaseUrl}/Items('${req.params.code}')`,
      req.body,
      {
        headers: { Cookie: sessionCookie },
        httpsAgent: agent
      }
    );

    res.json(response.data);

  } catch (err) {
    const detail = getSapErrorDetail(err);
    console.log(err.response?.data || err.code || err.message);
    res.status(500).json({ detail, sap_base_url: env.sapBaseUrl });
  }

});

module.exports = router;
