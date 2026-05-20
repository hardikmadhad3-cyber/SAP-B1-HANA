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
      title={loading ? 'Loading Goods Issues' : undefined}
    />
  );
}

export default CopyFromModal;
