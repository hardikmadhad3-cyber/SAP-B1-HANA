import React, { useEffect, useMemo, useState } from 'react';
import '../item-master/styles/itemMaster.css';
import './styles/generalSettings.css';
import { fetchSalesOrderReferenceData, fetchDocumentSeries as fetchSalesSeries } from '../../api/salesOrderApi';
import { fetchDeliveryReferenceData, fetchDocumentSeries as fetchDeliverySeries } from '../../api/deliveryApi';
import { fetchSalesOrderReferenceData as fetchDcSalesReferenceData, fetchDocumentSeries as fetchDcSalesSeries } from '../../api/dcSalesOrderApi';
import { fetchSalesOrderReferenceData as fetchNcSalesReferenceData, fetchDocumentSeries as fetchNcSalesSeries } from '../../api/ncSalesOrderApi';
import { fetchSalesOrderReferenceData as fetchSodaSalesReferenceData, fetchDocumentSeries as fetchSodaSalesSeries } from '../../api/sodaSalesOrderApi';
import { fetchDeliveryReferenceData as fetchDcDeliveryReferenceData, fetchDocumentSeries as fetchDcDeliverySeries } from '../../api/dcDeliveryApi';
import { fetchDeliveryReferenceData as fetchNcDeliveryReferenceData, fetchDocumentSeries as fetchNcDeliverySeries } from '../../api/ncDeliveryApi';
import { fetchDeliveryReferenceData as fetchSodaDeliveryReferenceData, fetchDocumentSeries as fetchSodaDeliverySeries } from '../../api/sodaDeliveryApi';
import { SALES_ORDER_COMPANY_ID } from '../../config/appConfig';
import { readGeneralSettings, saveGeneralSettings } from '../../utils/generalSettingsStorage';

const today = () => new Date().toISOString().split('T')[0];

const DOCUMENT_DEFAULTS = [
  {
    key: 'sales',
    label: 'Sales Order',
    warehouseKey: 'salesWarehouse',
    seriesKey: 'salesSeries',
    fetchReferenceData: fetchSalesOrderReferenceData,
    fetchSeries: fetchSalesSeries,
  },
  {
    key: 'dcSales',
    label: 'DC Sales Order',
    warehouseKey: 'dcSalesWarehouse',
    seriesKey: 'dcSalesSeries',
    fetchReferenceData: fetchDcSalesReferenceData,
    fetchSeries: fetchDcSalesSeries,
  },
  {
    key: 'ncSales',
    label: 'NC Sales Order',
    warehouseKey: 'ncSalesWarehouse',
    seriesKey: 'ncSalesSeries',
    fetchReferenceData: fetchNcSalesReferenceData,
    fetchSeries: fetchNcSalesSeries,
  },
  {
    key: 'sodaSales',
    label: 'SODA Sales Order',
    warehouseKey: 'sodaSalesWarehouse',
    seriesKey: 'sodaSalesSeries',
    fetchReferenceData: fetchSodaSalesReferenceData,
    fetchSeries: fetchSodaSalesSeries,
  },
  {
    key: 'delivery',
    label: 'Delivery',
    warehouseKey: 'deliveryWarehouse',
    seriesKey: 'deliverySeries',
    fetchReferenceData: fetchDeliveryReferenceData,
    fetchSeries: fetchDeliverySeries,
  },
  {
    key: 'dcDelivery',
    label: 'DC Delivery',
    warehouseKey: 'dcDeliveryWarehouse',
    seriesKey: 'dcDeliverySeries',
    fetchReferenceData: fetchDcDeliveryReferenceData,
    fetchSeries: fetchDcDeliverySeries,
  },
  {
    key: 'ncDelivery',
    label: 'NC Delivery',
    warehouseKey: 'ncDeliveryWarehouse',
    seriesKey: 'ncDeliverySeries',
    fetchReferenceData: fetchNcDeliveryReferenceData,
    fetchSeries: fetchNcDeliverySeries,
  },
  {
    key: 'sodaDelivery',
    label: 'SODA Delivery',
    warehouseKey: 'sodaDeliveryWarehouse',
    seriesKey: 'sodaDeliverySeries',
    fetchReferenceData: fetchSodaDeliveryReferenceData,
    fetchSeries: fetchSodaDeliverySeries,
  },
];

const EMPTY_FORM = DOCUMENT_DEFAULTS.reduce((acc, documentType) => ({
  ...acc,
  [documentType.warehouseKey]: '',
  [documentType.seriesKey]: '',
}), {});

const normalizeWarehouseCode = (warehouse = {}) =>
  String(warehouse.WhsCode || warehouse.whsCode || warehouse.WarehouseCode || warehouse.code || '').trim();

const normalizeWarehouseName = (warehouse = {}) =>
  String(warehouse.WhsName || warehouse.whsName || warehouse.WarehouseName || warehouse.name || '').trim();

const mergeWarehouses = (...warehouseLists) => {
  const seen = new Map();
  warehouseLists.flat().forEach((warehouse) => {
    const code = normalizeWarehouseCode(warehouse);
    if (!code || seen.has(code)) return;
    seen.set(code, {
      ...warehouse,
      WhsCode: code,
      WhsName: normalizeWarehouseName(warehouse),
    });
  });
  return [...seen.values()].sort((a, b) => String(a.WhsCode).localeCompare(String(b.WhsCode), undefined, { numeric: true }));
};

const getSeriesLabel = (series = {}) =>
  String(series.SeriesName || series.Name || series.Series || '').trim();

export default function GeneralSettings() {
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, ...readGeneralSettings() }));
  const [warehouses, setWarehouses] = useState([]);
  const [seriesByDocument, setSeriesByDocument] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    let ignore = false;

    const loadOptions = async () => {
      setLoading(true);
      setAlert(null);

      try {
        const optionResults = await Promise.all(
          DOCUMENT_DEFAULTS.map(async (documentType) => {
            const [referenceResponse, seriesResponse] = await Promise.all([
              documentType.fetchReferenceData(SALES_ORDER_COMPANY_ID),
              documentType.fetchSeries(today()),
            ]);

            return {
              key: documentType.key,
              warehouses: referenceResponse.data?.warehouses || [],
              series: seriesResponse.data?.series || [],
            };
          }),
        );

        if (ignore) return;

        setWarehouses(mergeWarehouses(...optionResults.map((result) => result.warehouses)));
        setSeriesByDocument(optionResults.reduce((acc, result) => ({
          ...acc,
          [result.key]: result.series,
        }), {}));
      } catch (error) {
        if (!ignore) {
          setAlert({
            type: 'error',
            msg: error?.response?.data?.message || error?.message || 'Failed to load settings options.',
          });
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    loadOptions();
    return () => { ignore = true; };
  }, []);

  const selectedSummary = useMemo(() => {
    const findWarehouseLabel = (code) => {
      const warehouse = warehouses.find((entry) => entry.WhsCode === code);
      return warehouse ? `${warehouse.WhsCode} - ${warehouse.WhsName}` : code || 'Not set';
    };
    const findSeriesLabel = (seriesList, value) => {
      const series = seriesList.find((entry) => String(entry.Series) === String(value));
      return series ? `${getSeriesLabel(series)} (${series.Series})` : value || 'Not set';
    };

    return DOCUMENT_DEFAULTS.map((documentType) => ({
      ...documentType,
      warehouseLabel: findWarehouseLabel(form[documentType.warehouseKey]),
      seriesLabel: findSeriesLabel(seriesByDocument[documentType.key] || [], form[documentType.seriesKey]),
    }));
  }, [form, seriesByDocument, warehouses]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setAlert(null);
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSave = () => {
    setSaving(true);
    try {
      const saved = saveGeneralSettings(form);
      setForm(saved);
      setAlert({ type: 'success', msg: 'General settings saved successfully.' });
    } catch (error) {
      setAlert({ type: 'error', msg: error?.message || 'Failed to save general settings.' });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    setForm(EMPTY_FORM);
    setAlert(null);
  };

  return (
    <div className="im-page general-settings-page">
      <div className="im-toolbar">
        <span className="im-toolbar__title">General Settings</span>
        <span className="im-mode-badge im-mode-badge--update">Setup Mode</span>
        <button className="im-btn im-btn--primary" type="button" onClick={handleSave} disabled={loading || saving}>
          {saving ? 'Saving...' : 'Update'}
        </button>
        <button className="im-btn" type="button" onClick={handleClear} disabled={saving}>
          Clear
        </button>
      </div>

      {alert && (
        <div className={`im-alert im-alert--${alert.type}`}>{alert.msg}</div>
      )}

      <div className="im-header-card">
        <div className="im-section-title">Sales and Delivery Defaults</div>
        <div className="general-settings-page__table">
          <div className="general-settings-page__table-head">Document</div>
          <div className="general-settings-page__table-head">Warehouse</div>
          <div className="general-settings-page__table-head">Series</div>

          {DOCUMENT_DEFAULTS.map((documentType) => (
            <React.Fragment key={documentType.key}>
              <div className="general-settings-page__document-label">{documentType.label}</div>
              <div className="im-field general-settings-page__field">
                <select
                  className="im-field__input"
                  name={documentType.warehouseKey}
                  value={form[documentType.warehouseKey] || ''}
                  onChange={handleChange}
                  disabled={loading}
                >
                  <option value="">Select Warehouse</option>
                  {warehouses.map((warehouse) => (
                    <option key={`${documentType.key}-${warehouse.WhsCode}`} value={warehouse.WhsCode}>
                      {warehouse.WhsCode} - {warehouse.WhsName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="im-field general-settings-page__field">
                <select
                  className="im-field__input"
                  name={documentType.seriesKey}
                  value={form[documentType.seriesKey] || ''}
                  onChange={handleChange}
                  disabled={loading}
                >
                  <option value="">Select Series</option>
                  {(seriesByDocument[documentType.key] || []).map((series) => (
                    <option key={`${documentType.key}-series-${series.Series}`} value={series.Series}>
                      {getSeriesLabel(series)}
                    </option>
                  ))}
                </select>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="im-tab-panel general-settings-page__summary">
        <div className="im-section-title">Current Defaults</div>
        <div className="general-settings-page__summary-grid">
          {selectedSummary.map((documentType) => (
            <React.Fragment key={documentType.key}>
              <span>{documentType.label}</span>
              <strong>{documentType.warehouseLabel}</strong>
              <strong>{documentType.seriesLabel}</strong>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
