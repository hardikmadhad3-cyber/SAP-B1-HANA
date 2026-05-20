import CopyFromModalBase from '../../../components/document/CopyFromModal';
import { fetchOpenPurchaseOrders } from '../../../api/grpoApi';

export default function CopyFromModal({ isOpen, onClose, onCopy, vendorCode }) {
  const fetchDocuments = async () => {
    const res = await fetchOpenPurchaseOrders(vendorCode);
    return res.data?.orders || [];
  };

  const fetchDocumentDetails = async (_documentType, docEntry) => docEntry;

  return (
    <CopyFromModalBase
      isOpen={isOpen}
      onClose={onClose}
      onCopy={onCopy}
      documentType="purchaseOrder"
      onFetchDocuments={fetchDocuments}
      onFetchDocumentDetails={fetchDocumentDetails}
      searchPlaceholder="Search by number, vendor, or remarks..."
    />
  );
}
