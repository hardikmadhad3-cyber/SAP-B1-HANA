import SapLookupModal from '../common/SapLookupModal';

const getDistributionMethodLabel = (value) => ({
  N: 'None',
  E: 'Equally',
  Q: 'Quantity',
  V: 'Volume',
  W: 'Weight',
}[value] || value || '');

export default function FreightSelectionModal({ isOpen, onClose, onSelect, freightCharges = [], loading }) {
  const chooseCharge = (charge) => {
    onSelect(charge);
    onClose();
  };

  return (
    <SapLookupModal
      open={isOpen}
      title="Freight Charges"
      columns={[
        { key: 'rowNumber', label: '#', width: 44, searchable: false, render: (_charge, index) => index + 1 },
        { key: 'ExpnsCode', label: 'Code', width: 100 },
        { key: 'ExpnsName', label: 'Name' },
        { key: 'DistrbMthd', label: 'Distrib. Method', width: 130, render: (charge) => getDistributionMethodLabel(charge.DistrbMthd) },
        { key: 'LineTotal', label: 'Amount', width: 100, align: 'right', render: (charge) => charge.LineTotal ? Number(charge.LineTotal).toFixed(2) : '' },
        { key: 'TaxCode', label: 'Tax Code', width: 90 },
        { key: 'Comments', label: 'Remarks' },
      ]}
      rows={Array.isArray(freightCharges) ? freightCharges : []}
      loading={loading}
      searchPlaceholder="Search by name, code, or remarks"
      emptyMessage="No freight charges found"
      onClose={onClose}
      onSelect={chooseCharge}
      width="min(820px, calc(100% - 40px))"
    />
  );
}
