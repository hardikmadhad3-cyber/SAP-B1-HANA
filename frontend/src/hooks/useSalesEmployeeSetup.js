import { useCallback, useMemo, useState } from 'react';
import { saveSalesEmployeesSetup } from '../api/salesEmployeeApi';

const sanitizeCommissionInput = (value, decimals = 2) => {
  const cleaned = String(value ?? '')
    .replace(/[^\d.-]/g, '')
    .replace(/(?!^)-/g, '')
    .replace(/^(-?)\./, '$10.')
    .replace(/(\..*)\./g, '$1');

  if (!cleaned) return '';
  if (!cleaned.includes('.')) return cleaned;

  const [whole, fraction] = cleaned.split('.');
  return `${whole}.${(fraction || '').slice(0, Math.max(decimals, 0))}`;
};

export default function useSalesEmployeeSetup({
  employees = [],
  onEmployeesChange,
  onError,
  onSuccess,
  discountDecimals = 2,
  getErrMsg,
}) {
  const [salesEmployeeSetup, setSalesEmployeeSetup] = useState({ open: false, rows: [], saving: false });

  const effectiveSalesEmployees = useMemo(
    () => (employees.length ? employees : [{ SlpCode: -1, SlpName: 'No Sales Employee / Buyer', Active: 'Y' }]),
    [employees]
  );

  const resolveSalesEmployeeByName = useCallback(
    (name) => effectiveSalesEmployees.find(
      (employee) => String(employee.SlpName || '') === String(name || '')
    ),
    [effectiveSalesEmployees]
  );

  const buildRows = useCallback(() => {
    const rows = effectiveSalesEmployees.map((employee) => {
      const row = {
        SlpCode: employee.SlpCode,
        SlpName: employee.SlpName || '',
        Commission: employee.Commission != null ? String(employee.Commission) : '',
        Memo: employee.Memo || '',
        Active: String(employee.Active || 'Y').toUpperCase() !== 'N',
        Employee: false,
      };

      return {
        ...row,
        __original: {
          SlpName: row.SlpName,
          Commission: row.Commission,
          Memo: row.Memo,
          Active: row.Active,
        },
      };
    });

    return [
      ...rows,
      { SlpCode: '', SlpName: '', Commission: '', Memo: '', Active: true, Employee: false },
    ];
  }, [effectiveSalesEmployees]);

  const openSalesEmployeeSetup = useCallback(() => {
    setSalesEmployeeSetup({ open: true, rows: buildRows(), saving: false });
  }, [buildRows]);

  const closeSalesEmployeeSetup = useCallback(() => {
    setSalesEmployeeSetup((prev) => ({ ...prev, open: false, saving: false }));
  }, []);

  const updateSalesEmployeeSetupRow = useCallback((index, field, value) => {
    setSalesEmployeeSetup((prev) => {
      const normalizedValue =
        field === 'Commission' ? sanitizeCommissionInput(value, discountDecimals) : value;

      const rows = prev.rows.map((row, rowIndex) => (
        rowIndex === index ? { ...row, [field]: normalizedValue } : row
      ));
      const lastRow = rows[rows.length - 1];
      if (lastRow && String(lastRow.SlpName || '').trim()) {
        rows.push({ SlpCode: '', SlpName: '', Commission: '', Memo: '', Active: true, Employee: false });
      }
      return { ...prev, rows };
    });
  }, [discountDecimals]);

  const saveSetup = useCallback(async () => {
    const hasChanged = (row) => {
      const original = row.__original;
      if (!original) return true;

      return (
        String(row.SlpName || '').trim() !== String(original.SlpName || '').trim() ||
        String(row.Commission || '').trim() !== String(original.Commission || '').trim() ||
        String(row.Memo || '').trim() !== String(original.Memo || '').trim() ||
        Boolean(row.Active) !== Boolean(original.Active)
      );
    };

    const rowsToSave = salesEmployeeSetup.rows
      .map((row) => ({
        SlpCode: row.SlpCode,
        SlpName: String(row.SlpName || '').trim(),
        Commission: String(row.Commission || '').trim(),
        Memo: row.Memo || '',
        Active: row.Active,
        Employee: row.Employee,
        Changed: hasChanged(row),
      }))
      .filter((row) => row.SlpName && String(row.SlpCode) !== '-1' && row.Changed);

    setSalesEmployeeSetup((prev) => ({ ...prev, saving: true }));
    onError?.('');
    onSuccess?.('');

    try {
      const response = await saveSalesEmployeesSetup(rowsToSave);
      onEmployeesChange?.(response.data?.sales_employees || []);
      setSalesEmployeeSetup({ open: false, rows: [], saving: false });
      onSuccess?.(response.data?.message || 'Sales employees setup saved.');
    } catch (error) {
      setSalesEmployeeSetup((prev) => ({ ...prev, saving: false }));
      const message = getErrMsg ? getErrMsg(error, 'Failed to save sales employees setup.') : 'Failed to save sales employees setup.';
      onError?.(message);
    }
  }, [getErrMsg, onEmployeesChange, onError, onSuccess, salesEmployeeSetup.rows]);

  return {
    effectiveSalesEmployees,
    salesEmployeeSetup,
    openSalesEmployeeSetup,
    closeSalesEmployeeSetup,
    updateSalesEmployeeSetupRow,
    saveSalesEmployeeSetup: saveSetup,
    resolveSalesEmployeeByName,
  };
}
