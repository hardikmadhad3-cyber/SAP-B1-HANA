import React from 'react';
import ReportLandingPage from '../components/reports/ReportLandingPage';

function PurchaseAnalysisReportPage() {
  return (
    <ReportLandingPage
      badge="Reports / Purchasing"
      title="Purchase Analysis"
      description="Analyze vendor-side procurement flow with direct links to the main purchasing documents and follow-up transactions."
      highlights={[
        {
          title: 'Procurement Flow',
          description: 'Move from request to quotation, purchase order, goods receipt, and A/P invoice review with fewer clicks.',
        },
        {
          title: 'Vendor Review',
          description: 'Check document lists to compare supplier activity, open quantities, and posted purchase documents.',
        },
        {
          title: 'Inbound Tracking',
          description: 'Validate which purchase orders were received and which transactions still need invoice follow-up.',
        },
        {
          title: 'Centralized Reporting',
          description: 'Keep purchasing review screens grouped together under a dedicated report branch in the sidebar.',
        },
      ]}
      actions={[
        {
          to: '/purchase-quotation/find',
          label: 'Open Purchase Quotation List',
          description: 'Review quotation activity from suppliers.',
        },
        {
          to: '/purchase-order/find',
          label: 'Open Purchase Order List',
          description: 'Inspect purchase order status and posted documents.',
        },
        {
          to: '/grpo/find',
          label: 'Open GRPO List',
          description: 'Check goods receipt PO transactions received from vendors.',
        },
        {
          to: '/ap-invoice/find',
          label: 'Open A/P Invoice List',
          description: 'Review vendor invoice activity tied to procurement.',
        },
      ]}
    />
  );
}

export default PurchaseAnalysisReportPage;
