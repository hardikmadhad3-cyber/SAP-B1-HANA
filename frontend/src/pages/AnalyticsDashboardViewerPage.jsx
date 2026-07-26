import React from 'react';
import { useParams } from 'react-router-dom';
import DashboardViewerGrid from '../modules/analytics-dashboard-viewer/components/DashboardViewerGrid';
import '../modules/analytics-dashboard-viewer/styles/dashboard-viewer.css';

const AnalyticsDashboardViewerPage = () => {
  const { dashboardCode } = useParams();

  return (
    <div className="adv-page">
      <DashboardViewerGrid dashboardCode={dashboardCode} />
    </div>
  );
};

export default AnalyticsDashboardViewerPage;
