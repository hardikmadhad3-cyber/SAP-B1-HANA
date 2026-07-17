import { useCallback } from "react";
import { lookupProductionOrders } from "../../../api/issueForProductionApi";
import SapLookupModal from "../../../components/common/SapLookupModal";

const TYPE_LABELS = {
  bopotStandard: "Standard",
  bopotSpecial: "Special",
  bopotDisassemble: "Disassembly",
};

export default function ProductionOrderSearchModal({
  title = "List of Production Orders",
  type = "",
  onSelect,
  onClose,
}) {
  const fetchOrders = useCallback(async (query = "") => {
    const data = await lookupProductionOrders(query, type);
    return Array.isArray(data) ? data : [];
  }, [type]);

  return (
    <SapLookupModal
      open
      title={title}
      columns={[
        { key: "rowNumber", label: "#", width: 44, searchable: false, render: (_order, index) => index + 1 },
        { key: "DocNum", label: "Document", width: 80 },
        { key: "SeriesName", label: "Series Name", width: 120 },
        { key: "Type", label: "Production Order Type", width: 150, render: (order) => TYPE_LABELS[order.Type] || order.Type || "Standard" },
        { key: "DueDate", label: "Due Date", width: 100 },
        { key: "ItemNo", label: "Product No.", width: 120 },
        { key: "ProductDescription", label: "Product Description" },
      ]}
      fetchOptions={fetchOrders}
      searchPlaceholder="Search production orders"
      emptyMessage="No production orders found."
      onClose={onClose}
      onSelect={onSelect}
      getRowKey={(order, index) => `${order.DocEntry || order.DocNum || "po"}-${index}`}
      width="min(980px, calc(100% - 40px))"
    />
  );
}
