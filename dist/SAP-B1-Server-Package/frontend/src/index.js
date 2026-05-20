import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // Points to your Router
import './index.css';
import 'bootstrap/dist/css/bootstrap.min.css'; // If using Bootstrap

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
