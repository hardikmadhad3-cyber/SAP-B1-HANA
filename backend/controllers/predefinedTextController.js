const predefinedTextDbService = require('../services/predefinedTextDbService');

const getErrorPayload = (error, fallbackMessage) => ({
  detail: error?.message || fallbackMessage,
  ...(error?.response?.data ? { sap: error.response.data } : {}),
});

const getPredefinedTexts = async (req, res) => {
  try {
    const texts = await predefinedTextDbService.getPredefinedTexts(req.query.query || '');
    res.json({ texts });
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load predefined texts.'));
  }
};

const createPredefinedText = async (req, res) => {
  try {
    const option = await predefinedTextDbService.createPredefinedText(req.body || {});
    const texts = await predefinedTextDbService.getPredefinedTexts();
    res.json({ option, texts });
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to create predefined text.'));
  }
};

module.exports = {
  createPredefinedText,
  getPredefinedTexts,
};
