import { useEffect, useMemo, useState } from 'react';
import SapLookupModal from '../../../components/common/SapLookupModal';

const PAGE_SIZE = 200;

const formatCurrency = (value) =>
  Number(value ?? 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const getBalanceValue = (bp) =>
  bp?.CurrentAccountBalance ??
  bp?.currentAccountBalance ??
  bp?.Balance ??
  bp?.balance ??
  0;

const getBillToStreet = (bp) =>
  bp?.BillToStreet ??
  bp?.BillToBuildingFloorRoom ??
  bp?.BillToBlock ??
  bp?.Address ??
  bp?.Street ??
  '';

const getBpTypeLabel = (type) =>
  type === 'C' ? 'Customer' : type === 'S' ? 'Supplier' : type === 'L' ? 'Lead' : type || 'Customer';

export default function BusinessPartnerModal({
  isOpen,
  onClose,
  onSelect,
  onCreateNew,
  businessPartners = [],
  title = 'List of Business Partners',
  variant = 'default',
  initialQuery = '',
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const isSellerVariant = variant === 'seller';

  useEffect(() => {
    if (!isOpen) return;
    const pendingQuery = initialQuery || window.__sapB1PendingLookupQuery || '';
    window.__sapB1PendingLookupQuery = '';
    setSearchTerm(pendingQuery);
    setPage(0);
  }, [isOpen, initialQuery]);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setPage(0);
    }
  }, [isOpen]);

  const filteredPartners = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return businessPartners;

    return businessPartners.filter((bp) =>
      String(bp.CardCode || '').toLowerCase().includes(term) ||
      String(bp.CardName || '').toLowerCase().includes(term) ||
      String(bp.CardType || '').toLowerCase().includes(term)
    );
  }, [businessPartners, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredPartners.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageStart = safePage * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, filteredPartners.length);
  const visiblePartners = filteredPartners.slice(pageStart, pageEnd);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const handleSelect = (bp) => {
    Promise.resolve(onSelect(bp)).finally(() => window.SapB1TabNavigation?.completeLookup?.());
    onClose();
  };

  const columns = isSellerVariant
    ? [
      { key: 'CardCode', label: 'BP Code', width: 130 },
      { key: 'CardName', label: 'BP Name', width: 240 },
      { key: 'BillToStreet', label: 'Bill-to Street', width: 220, render: getBillToStreet },
    ]
    : [
      { key: 'rowNumber', label: '#', width: 44, searchable: false, render: (_bp, index) => pageStart + index + 1 },
      { key: 'CardName', label: 'BP name' },
      { key: 'CardCode', label: 'BP Code', width: 130 },
      { key: 'Balance', label: 'Account Balance', width: 140, align: 'right', render: (bp) => formatCurrency(getBalanceValue(bp)) },
      { key: 'CardType', label: 'BP Type', width: 110, render: (bp) => getBpTypeLabel(bp.CardType) },
    ];

  const footerControls = (
    <>
      <button type="button" className="sap-lookup-modal__btn" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={safePage === 0}>
        {'<'}
      </button>
      <span>{safePage + 1} / {totalPages}</span>
      <button type="button" className="sap-lookup-modal__btn" onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))} disabled={safePage >= totalPages - 1}>
        {'>'}
      </button>
    </>
  );

  return (
    <SapLookupModal
      open={isOpen}
      title={title}
      columns={columns}
      rows={visiblePartners}
      initialQuery={searchTerm}
      searchPlaceholder={isSellerVariant ? '' : 'Search by code, name, or type...'}
      emptyMessage="No business partners found"
      footerNote={`Showing ${filteredPartners.length === 0 ? 0 : pageStart + 1}-${pageEnd} of ${filteredPartners.length} business partners`}
      footerControls={footerControls}
      onQueryChange={(query) => {
        setSearchTerm(query);
        setPage(0);
      }}
      onClose={onClose}
      onSelect={handleSelect}
      onNew={onCreateNew}
      getRowKey={(bp, index) => `${bp.CardCode || 'bp'}-${pageStart + index}`}
      width={isSellerVariant ? 'min(620px, calc(100% - 40px))' : 'min(1180px, calc(100% - 40px))'}
    />
  );
}
