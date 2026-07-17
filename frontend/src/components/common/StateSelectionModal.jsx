import SapLookupModal from './SapLookupModal';

export default function StateSelectionModal({ isOpen, onClose, onSelect, states = [] }) {
  const safeStates = Array.isArray(states) ? states : [];

  const handleSelect = (state) => {
    onSelect(state);
    onClose();
  };

  return (
    <SapLookupModal
      open={isOpen}
      title="List of States"
      columns={[
        { key: 'rowNumber', label: '#', width: 44, render: (_state, index) => index + 1 },
        { key: 'Code', label: 'Code', width: 100 },
        { key: 'Country', label: 'Country/Region', width: 150, render: (state) => state.Country || 'India' },
        { key: 'Name', label: 'Name' },
      ]}
      rows={safeStates}
      searchPlaceholder="Search by code, name, or country..."
      emptyMessage="No states found"
      onClose={onClose}
      onSelect={handleSelect}
      width="min(720px, calc(100vw - 40px))"
    />
  );
}
