const getErrorPayload = (error, fallbackMessage) => ({
  detail:
    error.response?.data?.error?.message?.value ||
    error.response?.data?.error?.message ||
    error.response?.data ||
    error.message ||
    fallbackMessage,
});

// Placeholder for Blanket Agreements - returns empty list for now
const getOpenBlanketAgreements = async (req, res) => {
  try {
    // TODO: Implement actual blanket agreement fetching from SAP
    // For now, return empty list
    res.json({ documents: [] });
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load open blanket agreements.'));
  }
};

const getBlanketAgreementForCopy = async (req, res) => {
  try {
    // TODO: Implement actual blanket agreement details fetching
    res.status(404).json({ detail: 'Blanket agreement not found or not yet implemented.' });
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load blanket agreement for copy.'));
  }
};

module.exports = {
  getOpenBlanketAgreements,
  getBlanketAgreementForCopy,
};
