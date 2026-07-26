import React, { useState } from 'react';
import VisualTypePicker from './VisualTypePicker';
import FieldMappingPanel from './FieldMappingPanel';
import { DEFAULT_WIDGET_SIZE, CANVAS_COLS, CANVAS_ROW_HEIGHT } from './DashboardCanvas';

const FONT_WEIGHTS = ['normal', 'bold'];

const WidgetSettingsPanel = ({ widget, columnMeta, savedMeasures = [], layout, canvasWidth = 1280, onSave, onClose, saving }) => {
  const [activeTab, setActiveTab] = useState('general');
  const [title, setTitle] = useState(widget.title || '');
  const [widgetType, setWidgetType] = useState(widget.widgetType);
  const [fieldMapping, setFieldMapping] = useState(widget.fieldMapping || {});

  const currentLayoutEntry = (layout || []).find((item) => String(item.i) === String(widget.widgetId));
  const [width, setWidth] = useState(currentLayoutEntry?.w ?? DEFAULT_WIDGET_SIZE.w);
  const [height, setHeight] = useState(currentLayoutEntry?.h ?? DEFAULT_WIDGET_SIZE.h);

  const columnPixelWidth = Math.round((canvasWidth / CANVAS_COLS) * width);
  const rowPixelHeight = height * CANVAS_ROW_HEIGHT;

  const style = fieldMapping?.style || {};
  const updateStyle = (patch) => setFieldMapping((prev) => ({ ...prev, style: { ...(prev?.style || {}), ...patch } }));

  return (
    <div className="ads-modal-overlay" role="presentation" onMouseDown={onClose}>
      <div className="ads-modal" onMouseDown={(event) => event.stopPropagation()}>
        <header className="ads-modal__header">
          <span>Widget Settings</span>
          <button type="button" onClick={onClose}>x</button>
        </header>

        <div className="ads-modal__tabs">
          <button
            type="button"
            className={`ads-modal__tab${activeTab === 'general' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            General
          </button>
          <button
            type="button"
            className={`ads-modal__tab${activeTab === 'properties' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('properties')}
          >
            Properties
          </button>
          <button
            type="button"
            className={`ads-modal__tab${activeTab === 'style' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('style')}
          >
            Style
          </button>
        </div>

        <div className="ads-modal__body">
          {activeTab === 'general' && (
            <>
              <label className="ads-field">
                <span>Title</span>
                <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} />
              </label>

              <span className="ads-field-mapping__label">Visual Type</span>
              <VisualTypePicker value={widgetType} onChange={setWidgetType} />

              <FieldMappingPanel
                columnMeta={columnMeta}
                widgetType={widgetType}
                value={fieldMapping}
                onChange={setFieldMapping}
                savedMeasures={savedMeasures}
              />
            </>
          )}

          {activeTab === 'properties' && (
            <>
              <label className="ads-field">
                <span>Width ({width} of {CANVAS_COLS} columns &middot; &asymp; {columnPixelWidth}px)</span>
                <input
                  type="number"
                  min={DEFAULT_WIDGET_SIZE.minW}
                  max={CANVAS_COLS}
                  value={width}
                  onChange={(event) => setWidth(Math.max(DEFAULT_WIDGET_SIZE.minW, Math.min(CANVAS_COLS, Number(event.target.value) || DEFAULT_WIDGET_SIZE.w)))}
                />
              </label>
              <label className="ads-field">
                <span>Height ({height} rows &middot; &asymp; {rowPixelHeight}px)</span>
                <input
                  type="number"
                  min={DEFAULT_WIDGET_SIZE.minH}
                  max={60}
                  value={height}
                  onChange={(event) => setHeight(Math.max(DEFAULT_WIDGET_SIZE.minH, Number(event.target.value) || DEFAULT_WIDGET_SIZE.h))}
                />
              </label>
              <p className="ads-field-mapping__empty">
                Drag a widget's corner handle on the canvas to resize it directly, or set exact values here.
              </p>
            </>
          )}

          {activeTab === 'style' && (
            <>
              <span className="ads-field-mapping__label">Title</span>
              <div className="ads-designer__meta-row">
                <label className="ads-field">
                  <span>Font Size (px)</span>
                  <input
                    type="number"
                    min="8"
                    max="48"
                    value={style.titleFontSize || ''}
                    placeholder="14"
                    onChange={(event) => updateStyle({ titleFontSize: event.target.value })}
                  />
                </label>
                <label className="ads-field">
                  <span>Font Weight</span>
                  <select value={style.titleFontWeight || 'normal'} onChange={(event) => updateStyle({ titleFontWeight: event.target.value })}>
                    {FONT_WEIGHTS.map((weight) => <option key={weight} value={weight}>{weight}</option>)}
                  </select>
                </label>
                <label className="ads-field">
                  <span>Color</span>
                  <input type="color" value={style.titleColor || '#1f2f46'} onChange={(event) => updateStyle({ titleColor: event.target.value })} />
                </label>
              </div>

              <span className="ads-field-mapping__label">Data Labels</span>
              <div className="ads-designer__meta-row">
                <label className="ads-field">
                  <span>Font Size (px)</span>
                  <input
                    type="number"
                    min="8"
                    max="32"
                    value={style.labelFontSize || ''}
                    placeholder="Hidden by default"
                    onChange={(event) => updateStyle({ labelFontSize: event.target.value })}
                  />
                </label>
                <label className="ads-field">
                  <span>Color</span>
                  <input type="color" value={style.labelColor || '#1f2f46'} onChange={(event) => updateStyle({ labelColor: event.target.value })} />
                </label>
              </div>

              <span className="ads-field-mapping__label">Axis Text</span>
              <div className="ads-designer__meta-row">
                <label className="ads-field">
                  <span>Font Size (px)</span>
                  <input
                    type="number"
                    min="8"
                    max="24"
                    value={style.axisFontSize || ''}
                    placeholder="12"
                    onChange={(event) => updateStyle({ axisFontSize: event.target.value })}
                  />
                </label>
                <label className="ads-field">
                  <span>Color</span>
                  <input type="color" value={style.axisColor || '#333333'} onChange={(event) => updateStyle({ axisColor: event.target.value })} />
                </label>
              </div>
              <p className="ads-field-mapping__empty">
                Data label font/color only takes effect once set here - labels are hidden by default. Axis
                text applies to chart types with an x/y axis.
              </p>
            </>
          )}
        </div>
        <footer className="ads-modal__footer">
          <button
            type="button"
            className="aqm-btn aqm-btn--primary"
            disabled={saving}
            onClick={() => onSave({ title, widgetType, fieldMapping, size: { w: width, h: height } })}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button type="button" className="aqm-btn aqm-btn--ghost" onClick={onClose}>Cancel</button>
        </footer>
      </div>
    </div>
  );
};

export default WidgetSettingsPanel;
