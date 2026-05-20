import React from 'react';
import { Link } from 'react-router-dom';

const panelStyle = {
  border: '1px solid #d9e2ec',
  borderRadius: 16,
  background: '#ffffff',
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.05)',
};

const badgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 12px',
  borderRadius: 999,
  background: '#e8f1fb',
  color: '#0f4c81',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
};

function ReportLandingPage({
  badge,
  title,
  description,
  highlights = [],
  actions = [],
}) {
  return (
    <div className="container-fluid py-4">
      <div
        className="p-4 p-lg-5 mb-4"
        style={{
          ...panelStyle,
          background: 'linear-gradient(135deg, #f8fbff 0%, #eef5fb 100%)',
        }}
      >
        <div style={badgeStyle}>{badge}</div>
        <h2 className="mt-3 mb-2">{title}</h2>
        <p className="text-muted mb-0" style={{ maxWidth: 760 }}>
          {description}
        </p>
      </div>

      <div className="row g-4">
        <div className="col-12 col-xl-7">
          <div className="p-4 h-100" style={panelStyle}>
            <h4 className="mb-3">Included In This Report</h4>
            <div className="row g-3">
              {highlights.map((item) => (
                <div key={item.title} className="col-12 col-md-6">
                  <div
                    className="h-100 p-3"
                    style={{
                      borderRadius: 14,
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <h6 className="mb-2">{item.title}</h6>
                    <p className="mb-0 text-muted">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-5">
          <div className="p-4 h-100" style={panelStyle}>
            <h4 className="mb-3">Quick Actions</h4>
            <div className="d-grid gap-3">
              {actions.map((action) => (
                <Link
                  key={`${action.to}-${action.label}`}
                  to={action.to}
                  className="text-decoration-none"
                >
                  <div
                    className="p-3"
                    style={{
                      borderRadius: 14,
                      background: '#fff8ed',
                      border: '1px solid #f1d3a8',
                      color: '#7a4b11',
                    }}
                  >
                    <div className="fw-semibold">{action.label}</div>
                    <div className="small mt-1">{action.description}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReportLandingPage;
