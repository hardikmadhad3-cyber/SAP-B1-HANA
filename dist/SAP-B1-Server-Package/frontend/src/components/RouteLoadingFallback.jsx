import React from 'react';

/**
 * RouteLoadingFallback Component
 * Displays a loading indicator while lazy-loaded route components are being fetched
 */
const RouteLoadingFallback = () => (
  <div className="route-loading-container" style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
    padding: '2rem',
  }}>
    <div className="spinner-border text-primary" role="status" style={{
      width: '3rem',
      height: '3rem',
    }}>
      <span className="visually-hidden">Loading...</span>
    </div>
    <p className="loading-text" style={{
      marginTop: '1rem',
      color: '#6c757d',
      fontSize: '1rem',
    }}>
      Loading page...
    </p>
  </div>
);

export default RouteLoadingFallback;
