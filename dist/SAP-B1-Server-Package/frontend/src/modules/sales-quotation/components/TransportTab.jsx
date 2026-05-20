import React from 'react';

const TransportTab = ({ headerUdfs, onHeaderUdfChange }) => {
  return (
    <div className="so-tab-content">
      <div className="so-field-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        
        {/* Left Column - Transport Info */}
        <div>
          <div className="so-section-title">Transport Details</div>
          
          <div className="so-field">
            <label className="so-field__label">Transporter</label>
            <input
              type="text"
              name="U_TRNS"
              className="so-field__input"
              value={headerUdfs.U_TRNS || ''}
              onChange={onHeaderUdfChange}
            />
          </div>
          
          <div className="so-field">
            <label className="so-field__label">Vehicle No.</label>
            <input
              type="text"
              name="U_VEHNO"
              className="so-field__input"
              value={headerUdfs.U_VEHNO || ''}
              onChange={onHeaderUdfChange}
            />
          </div>
          
          <div className="so-field">
            <label className="so-field__label">LR No.</label>
            <input
              type="text"
              name="U_LRNO"
              className="so-field__input"
              value={headerUdfs.U_LRNO || ''}
              onChange={onHeaderUdfChange}
            />
          </div>
          
          <div className="so-field">
            <label className="so-field__label">LR Date</label>
            <input
              type="date"
              name="U_LRDT"
              className="so-field__input"
              value={headerUdfs.U_LRDT || ''}
              onChange={onHeaderUdfChange}
            />
          </div>
        </div>

        {/* Right Column - Destination and Pricing */}
        <div>
          <div className="so-section-title">Location & Freight</div>
          
          <div className="so-field">
            <label className="so-field__label">Destination</label>
            <input
              type="text"
              name="U_DSTN"
              className="so-field__input"
              value={headerUdfs.U_DSTN || ''}
              onChange={onHeaderUdfChange}
            />
          </div>
          
          <div className="so-field">
            <label className="so-field__label">Transporter Amount</label>
            <input
              type="number"
              name="U_SAmount"
              className="so-field__input"
              value={headerUdfs.U_SAmount || ''}
              onChange={onHeaderUdfChange}
            />
          </div>
        </div>

      </div>
    </div>
  );
};

export default TransportTab;