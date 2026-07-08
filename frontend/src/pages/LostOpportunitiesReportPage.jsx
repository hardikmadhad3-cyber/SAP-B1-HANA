import React from 'react';
import { fetchLostOpportunitiesReport } from '../api/opportunitiesForecastApi';
import OpportunitiesStatisticsReportPage from './OpportunitiesStatisticsReportPage';

export default function LostOpportunitiesReportPage() {
  return (
    <OpportunitiesStatisticsReportPage
      reportTitle="Lost Opportunities Report"
      criteriaTitle="Lost Opportunities Report - Selection Criteria"
      taskPath="/reports/crm/opportunities/lost"
      taskIdPrefix="lost-opportunities"
      fetchReport={fetchLostOpportunitiesReport}
      hideStatusFilter
      emptyMessage="No lost opportunities found for the selected criteria."
    />
  );
}
