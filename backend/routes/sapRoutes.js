const express = require('express');
const sapService = require('../services/sapService');

const router = express.Router();

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

router.post('/sap-session/login', async (req, res) => {
  try {
    const companyDb = await sapService.resolveCompanyDb({ companyDb: req.body?.companyDb });
    await sapService.ensureSession(companyDb);
    res.json({ message: 'SAP Login Successful', companyDb });
  } catch (err) {
    const detail = getSapErrorDetail(err);
    console.log(err.response?.data || err.code || err.message);
    res.status(500).json({ detail });
  }
});

router.get('/items', async (_req, res) => {
  try {
    const response = await sapService.request({
      method: 'GET',
      url: '/Items?$top=20',
    });
    res.json(response.data.value);
  } catch (err) {
    const detail = getSapErrorDetail(err);
    console.log(err.response?.data || err.code || err.message);
    res.status(500).json({ detail });
  }
});

router.post('/items', async (req, res) => {
  try {
    const response = await sapService.request({
      method: 'POST',
      url: '/Items',
      data: req.body,
    });
    res.json(response.data);
  } catch (err) {
    const detail = getSapErrorDetail(err);
    console.log(err.response?.data || err.code || err.message);
    res.status(500).json({ detail });
  }
});

router.patch('/items/:code', async (req, res) => {
  try {
    const response = await sapService.request({
      method: 'PATCH',
      url: sapService.buildStringKeyPath('Items', req.params.code),
      data: req.body,
    });
    res.json(response.data);
  } catch (err) {
    const detail = getSapErrorDetail(err);
    console.log(err.response?.data || err.code || err.message);
    res.status(500).json({ detail });
  }
});

module.exports = router;
