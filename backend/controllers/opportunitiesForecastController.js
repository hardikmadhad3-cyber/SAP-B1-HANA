const authDbService = require('../services/authDbService');
const opportunitiesForecastDbService = require('../services/opportunitiesForecastDbService');

const getOpportunitiesForecastReport = async (req, res, next) => {
  try {
    let databaseName = '';

    if (req.auth?.userId && req.auth?.companyId) {
      const assignedCompany = await authDbService.getAssignedCompanyForUser(
        req.auth.userId,
        req.auth.companyId,
      );
      databaseName = String(assignedCompany?.DbName || '').trim();
    }

    const data = await opportunitiesForecastDbService.getOpportunitiesForecastReport(
      req.body || {},
      { databaseName: databaseName || undefined },
    );

    res.json(data);
  } catch (error) {
    next(error);
  }
};

const getCrmStages = async (req, res, next) => {
  try {
    let databaseName = '';

    if (req.auth?.userId && req.auth?.companyId) {
      const assignedCompany = await authDbService.getAssignedCompanyForUser(
        req.auth.userId,
        req.auth.companyId,
      );
      databaseName = String(assignedCompany?.DbName || '').trim();
    }

    const stages = await opportunitiesForecastDbService.getCrmStages({
      databaseName: databaseName || undefined,
    });

    res.json({ success: true, data: stages });
  } catch (error) {
    next(error);
  }
};

const getTerritories = async (req, res, next) => {
  try {
    let databaseName = '';

    if (req.auth?.userId && req.auth?.companyId) {
      const assignedCompany = await authDbService.getAssignedCompanyForUser(
        req.auth.userId,
        req.auth.companyId,
      );
      databaseName = String(assignedCompany?.DbName || '').trim();
    }

    const territories = await opportunitiesForecastDbService.getTerritories({
      databaseName: databaseName || undefined,
    });

    res.json({ success: true, data: territories });
  } catch (error) {
    next(error);
  }
};

const getIndustries = async (req, res, next) => {
  try {
    let databaseName = '';

    if (req.auth?.userId && req.auth?.companyId) {
      const assignedCompany = await authDbService.getAssignedCompanyForUser(
        req.auth.userId,
        req.auth.companyId,
      );
      databaseName = String(assignedCompany?.DbName || '').trim();
    }

    const industries = await opportunitiesForecastDbService.getIndustries({
      databaseName: databaseName || undefined,
    });

    res.json({ success: true, data: industries });
  } catch (error) {
    next(error);
  }
};

const getInterestLevels = async (req, res, next) => {
  try {
    let databaseName = '';

    if (req.auth?.userId && req.auth?.companyId) {
      const assignedCompany = await authDbService.getAssignedCompanyForUser(
        req.auth.userId,
        req.auth.companyId,
      );
      databaseName = String(assignedCompany?.DbName || '').trim();
    }

    const levels = await opportunitiesForecastDbService.getInterestLevels({
      databaseName: databaseName || undefined,
    });

    res.json({ success: true, data: levels });
  } catch (error) {
    next(error);
  }
};

const getOpportunitiesForecastOverTimeReport = async (req, res, next) => {
  try {
    let databaseName = '';

    if (req.auth?.userId && req.auth?.companyId) {
      const assignedCompany = await authDbService.getAssignedCompanyForUser(
        req.auth.userId,
        req.auth.companyId,
      );
      databaseName = String(assignedCompany?.DbName || '').trim();
    }

    const data = await opportunitiesForecastDbService.getOpportunitiesForecastOverTimeReport(
      req.body || {},
      { databaseName: databaseName || undefined },
    );

    res.json(data);
  } catch (error) {
    next(error);
  }
};

const getInformationSourceDistributionOverTimeReport = async (req, res, next) => {
  try {
    let databaseName = '';

    if (req.auth?.userId && req.auth?.companyId) {
      const assignedCompany = await authDbService.getAssignedCompanyForUser(
        req.auth.userId,
        req.auth.companyId,
      );
      databaseName = String(assignedCompany?.DbName || '').trim();
    }

    const data = await opportunitiesForecastDbService.getInformationSourceDistributionOverTimeReport(
      req.body || {},
      { databaseName: databaseName || undefined },
    );

    res.json(data);
  } catch (error) {
    next(error);
  }
};

const getOpportunitiesStatisticsReport = async (req, res, next) => {
  try {
    let databaseName = '';

    if (req.auth?.userId && req.auth?.companyId) {
      const assignedCompany = await authDbService.getAssignedCompanyForUser(
        req.auth.userId,
        req.auth.companyId,
      );
      databaseName = String(assignedCompany?.DbName || '').trim();
    }

    const data = await opportunitiesForecastDbService.getOpportunitiesStatisticsReport(
      req.body || {},
      { databaseName: databaseName || undefined },
    );

    res.json(data);
  } catch (error) {
    next(error);
  }
};

const getOpportunitiesReport = async (req, res, next) => {
  try {
    let databaseName = '';

    if (req.auth?.userId && req.auth?.companyId) {
      const assignedCompany = await authDbService.getAssignedCompanyForUser(
        req.auth.userId,
        req.auth.companyId,
      );
      databaseName = String(assignedCompany?.DbName || '').trim();
    }

    const data = await opportunitiesForecastDbService.getOpportunitiesReport(
      req.body || {},
      { databaseName: databaseName || undefined },
    );

    res.json(data);
  } catch (error) {
    next(error);
  }
};

const getOpportunitiesStageAnalysisReport = async (req, res, next) => {
  try {
    let databaseName = '';

    if (req.auth?.userId && req.auth?.companyId) {
      const assignedCompany = await authDbService.getAssignedCompanyForUser(
        req.auth.userId,
        req.auth.companyId,
      );
      databaseName = String(assignedCompany?.DbName || '').trim();
    }

    const data = await opportunitiesForecastDbService.getOpportunitiesStageAnalysisReport(
      req.body || {},
      { databaseName: databaseName || undefined },
    );

    res.json(data);
  } catch (error) {
    next(error);
  }
};

const getOpportunitiesPipelineReport = async (req, res, next) => {
  try {
    let databaseName = '';

    if (req.auth?.userId && req.auth?.companyId) {
      const assignedCompany = await authDbService.getAssignedCompanyForUser(
        req.auth.userId,
        req.auth.companyId,
      );
      databaseName = String(assignedCompany?.DbName || '').trim();
    }

    const data = await opportunitiesForecastDbService.getOpportunitiesPipelineReport(
      req.body || {},
      { databaseName: databaseName || undefined },
    );

    res.json(data);
  } catch (error) {
    next(error);
  }
};

const getWonOpportunitiesReport = async (req, res, next) => {
  try {
    let databaseName = '';

    if (req.auth?.userId && req.auth?.companyId) {
      const assignedCompany = await authDbService.getAssignedCompanyForUser(
        req.auth.userId,
        req.auth.companyId,
      );
      databaseName = String(assignedCompany?.DbName || '').trim();
    }

    const data = await opportunitiesForecastDbService.getWonOpportunitiesReport(
      req.body || {},
      { databaseName: databaseName || undefined },
    );

    res.json(data);
  } catch (error) {
    next(error);
  }
};

const getLostOpportunitiesReport = async (req, res, next) => {
  try {
    let databaseName = '';

    if (req.auth?.userId && req.auth?.companyId) {
      const assignedCompany = await authDbService.getAssignedCompanyForUser(
        req.auth.userId,
        req.auth.companyId,
      );
      databaseName = String(assignedCompany?.DbName || '').trim();
    }

    const data = await opportunitiesForecastDbService.getLostOpportunitiesReport(
      req.body || {},
      { databaseName: databaseName || undefined },
    );

    res.json(data);
  } catch (error) {
    next(error);
  }
};

const getOpportunityForecastLookups = async (req, res, next) => {
  try {
    let databaseName = '';

    if (req.auth?.userId && req.auth?.companyId) {
      const assignedCompany = await authDbService.getAssignedCompanyForUser(
        req.auth.userId,
        req.auth.companyId,
      );
      databaseName = String(assignedCompany?.DbName || '').trim();
    }

    const lookups = await opportunitiesForecastDbService.getOpportunityForecastLookups({
      databaseName: databaseName || undefined,
    });

    res.json({ success: true, data: lookups });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
};
