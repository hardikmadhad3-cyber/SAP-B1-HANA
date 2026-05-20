const authDbService = require('../services/authDbService');
const salesAnalysisDbService = require('../services/salesAnalysisDbService');

const getCustomerSalesAnalysisReport = async (req, res, next) => {
  try {
    let databaseName = '';

    if (req.auth?.userId && req.auth?.companyId) {
      const assignedCompany = await authDbService.getAssignedCompanyForUser(
        req.auth.userId,
        req.auth.companyId,
      );
      databaseName = String(assignedCompany?.DbName || '').trim();
    }

    const data = await salesAnalysisDbService.getCustomerSalesAnalysisReport(
      req.body || {},
      { databaseName: databaseName || undefined },
    );

    res.json(data);
  } catch (error) {
    next(error);
  }
};

const getItemSalesAnalysisReport = async (req, res, next) => {
  try {
    let databaseName = '';

    if (req.auth?.userId && req.auth?.companyId) {
      const assignedCompany = await authDbService.getAssignedCompanyForUser(
        req.auth.userId,
        req.auth.companyId,
      );
      databaseName = String(assignedCompany?.DbName || '').trim();
    }

    const data = await salesAnalysisDbService.getItemSalesAnalysisReport(
      req.body || {},
      { databaseName: databaseName || undefined },
    );

    res.json(data);
  } catch (error) {
    next(error);
  }
};

const getSalesEmployeeSalesAnalysisReport = async (req, res, next) => {
  try {
    let databaseName = '';

    if (req.auth?.userId && req.auth?.companyId) {
      const assignedCompany = await authDbService.getAssignedCompanyForUser(
        req.auth.userId,
        req.auth.companyId,
      );
      databaseName = String(assignedCompany?.DbName || '').trim();
    }

    const data = await salesAnalysisDbService.getSalesEmployeeSalesAnalysisReport(
      req.body || {},
      { databaseName: databaseName || undefined },
    );

    res.json(data);
  } catch (error) {
    next(error);
  }
};

const getCustomerSalesAnalysisDetailReport = async (req, res, next) => {
  try {
    let databaseName = '';

    if (req.auth?.userId && req.auth?.companyId) {
      const assignedCompany = await authDbService.getAssignedCompanyForUser(
        req.auth.userId,
        req.auth.companyId,
      );
      databaseName = String(assignedCompany?.DbName || '').trim();
    }

    const data = await salesAnalysisDbService.getCustomerSalesAnalysisDetailReport(
      req.body || {},
      req.params.customerCode,
      { databaseName: databaseName || undefined },
    );

    res.json(data);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCustomerSalesAnalysisReport,
  getCustomerSalesAnalysisDetailReport,
  getItemSalesAnalysisReport,
  getSalesEmployeeSalesAnalysisReport,
};
