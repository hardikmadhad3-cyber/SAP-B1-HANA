const express = require('express');
const {
  getOpportunitiesForecastReport,
  getOpportunitiesForecastOverTimeReport,
  getInformationSourceDistributionOverTimeReport,
  getOpportunitiesStatisticsReport,
  getOpportunitiesReport,
  getOpportunitiesPipelineReport,
  getOpportunitiesStageAnalysisReport,
  getWonOpportunitiesReport,
  getLostOpportunitiesReport,
  getCrmStages,
  getTerritories,
  getIndustries,
  getInterestLevels,
  getOpportunityForecastLookups,
} = require('../controllers/opportunitiesForecastController');

const router = express.Router();

router.post('/opportunities-forecast/report', getOpportunitiesForecastReport);
router.post('/opportunities-forecast/over-time/report', getOpportunitiesForecastOverTimeReport);
router.post('/information-source-distribution-over-time/report', getInformationSourceDistributionOverTimeReport);
router.post('/opportunities-statistics/report', getOpportunitiesStatisticsReport);
router.post('/opportunities/report', getOpportunitiesReport);
router.post('/opportunities-pipeline/report', getOpportunitiesPipelineReport);
router.post('/opportunities-stage-analysis/report', getOpportunitiesStageAnalysisReport);
router.post('/opportunities-won/report', getWonOpportunitiesReport);
router.post('/opportunities-lost/report', getLostOpportunitiesReport);
router.get('/opportunities-forecast/stages', getCrmStages);
router.get('/opportunities-forecast/territories', getTerritories);
router.get('/opportunities-forecast/industries', getIndustries);
router.get('/opportunities-forecast/interest-levels', getInterestLevels);
router.get('/opportunities-forecast/lookups', getOpportunityForecastLookups);

module.exports = router;
