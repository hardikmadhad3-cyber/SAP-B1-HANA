const relationshipMapService = require('../services/relationshipMapService');

const getErrorPayload = (error, fallbackMessage) => ({
  detail:
    error.response?.data?.error?.message?.value ||
    error.response?.data?.error?.message ||
    error.response?.data ||
    error.message ||
    fallbackMessage,
});

const getRelationshipMap = async (req, res) => {
  try {
    const relationshipMap = await relationshipMapService.getRelationshipMap({
      objectType: req.params.objectType,
      docEntry: req.params.docEntry,
    });
    res.json({ relationshipMap });
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load relationship map.'));
  }
};

module.exports = {
  getRelationshipMap,
};
