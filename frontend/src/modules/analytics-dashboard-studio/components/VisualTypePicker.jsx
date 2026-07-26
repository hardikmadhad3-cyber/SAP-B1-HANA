import React from 'react';

const VISUAL_TYPES = [
  { type: 'kpi', label: 'KPI Card', group: 'Basic' },
  { type: 'card-trend', label: 'Card with Trend', group: 'Basic' },
  { type: 'table', label: 'Table', group: 'Basic' },
  { type: 'matrix', label: 'Matrix', group: 'Basic' },
  { type: 'gauge', label: 'Gauge', group: 'Basic' },
  { type: 'bullet', label: 'Bullet Chart', group: 'Basic' },

  { type: 'bar', label: 'Clustered Column Chart', group: 'Column' },
  { type: 'column-stacked', label: 'Stacked Column Chart', group: 'Column' },

  { type: 'bar-horizontal', label: 'Clustered Bar Chart', group: 'Bar' },
  { type: 'bar-horizontal-stacked', label: 'Stacked Bar Chart', group: 'Bar' },

  { type: 'line', label: 'Line Chart', group: 'Line & Area' },
  { type: 'area', label: 'Area Chart', group: 'Line & Area' },
  { type: 'area-stacked', label: 'Stacked Area Chart', group: 'Line & Area' },

  { type: 'pie', label: 'Pie Chart', group: 'Pie' },
  { type: 'donut', label: 'Donut Chart', group: 'Pie' },

  { type: 'combo', label: 'Combo (Line + Column)', group: 'Other' },
  { type: 'scatter', label: 'Scatter Chart', group: 'Other' },
  { type: 'funnel', label: 'Funnel Chart', group: 'Other' },
  { type: 'treemap', label: 'Treemap', group: 'Other' },
  { type: 'radar', label: 'Radar Chart', group: 'Other' },
  { type: 'waterfall', label: 'Waterfall Chart', group: 'Other' },
  { type: 'heatmap', label: 'Heatmap', group: 'Other' },
];

const GROUP_ORDER = ['Basic', 'Column', 'Bar', 'Line & Area', 'Pie', 'Other'];

const VisualTypePicker = ({ value, onChange }) => (
  <div className="ads-visual-picker">
    {GROUP_ORDER.map((group) => (
      <div className="ads-visual-picker__group" key={group}>
        <span className="ads-visual-picker__group-label">{group}</span>
        <div className="ads-visual-picker__group-items">
          {VISUAL_TYPES.filter((visual) => visual.group === group).map((visual) => (
            <button
              key={visual.type}
              type="button"
              className={`ads-visual-picker__item ${value === visual.type ? 'is-selected' : ''}`}
              onClick={() => onChange(visual.type)}
            >
              {visual.label}
            </button>
          ))}
        </div>
      </div>
    ))}
  </div>
);

export default VisualTypePicker;
