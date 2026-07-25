import CopyFromModalBase from '../../../components/document/CopyFromModal';

function CopyFromModal({
  isOpen,
  goodsIssues,
  onSelectDocEntry,
  onClose,
  onCopy,
  loading,
}) {
  const fetchDocuments = async () => goodsIssues || [];
  const fetchDocumentDetails = async (_documentType, docEntry) => docEntry;
  const goodsIssueColumns = [
    {
      key: 'rowNumber',
      label: '#',
      width: 44,
      render: (_document, index) => index + 1,
    },
    {
      key: 'docNum',
      label: 'No.',
      width: 96,
      render: (document) => document.DocNum || document.docNum || document.doc_num || '',
    },
    {
      key: 'docDate',
      label: 'Date',
      width: 130,
      render: (document) => {
        const value = document.DocDate || document.docDate || document.posting_date || '';
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
      },
    },
    {
      key: 'details',
      label: 'Details',
      render: (document) => document.details || document.Comments || document.comments || document.Remarks || document.remarks || '',
    },
  ];

  const handleCopy = async (docEntry) => {
    onSelectDocEntry?.(docEntry);
    await onCopy(docEntry);
  };

  return (
    <CopyFromModalBase
      isOpen={isOpen}
      onClose={onClose}
      onCopy={handleCopy}
      documentType="goodsIssue"
      onFetchDocuments={fetchDocuments}
      onFetchDocumentDetails={fetchDocumentDetails}
      searchPlaceholder="Search by number or details..."
      title={loading ? 'Loading Goods Issue' : 'List of Goods Issue'}
      columns={goodsIssueColumns}
    />
  );
}

export default CopyFromModal;
