import { useCallback } from "react";
import { lookupProductionOrdersForReceipt } from "../../../api/receiptFromProductionApi";
import SapLookupModal from "../../../components/common/SapLookupModal";

const STATUS_LABEL = {
  boposReleased: "Released",
  boposPlanned: "Planned",
};

const TYPE_LABEL = {
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
    const data = await lookupProductionOrdersForReceipt(query, type);
    return Array.isArray(data) ? data : [];
  }, [type]);

  return (
    <SapLookupModal
      open
      title={title}
      columns={[
        { key: "DocNum", label: "Doc No.", width: 90 },
        { key: "ItemNo", label: "Item Code", width: 120 },
        { key: "ProductDescription", label: "Description" },
        { key: "Type", label: "Type", width: 110, render: (order) => TYPE_LABEL[order.Type] || order.Type || "Standard" },
        { key: "ProductionOrderStatus", label: "Status", width: 100, render: (order) => STATUS_LABEL[order.ProductionOrderStatus] || order.ProductionOrderStatus },
        { key: "PlannedQuantity", label: "Planned Qty", width: 110, align: "right", render: (order) => Number(order.PlannedQuantity || 0).toFixed(2) },
        { key: "CompletedQuantity", label: "Completed Qty", width: 120, align: "right", render: (order) => Number(order.CompletedQuantity || 0).toFixed(2) },
        {
          key: "Remaining",
          label: "Remaining",
          width: 110,
          align: "right",
          render: (order) => Math.max(0, Number(order.PlannedQuantity || 0) - Number(order.CompletedQuantity || 0)).toFixed(2),
        },
        { key: "DueDate", label: "Due Date", width: 100, render: (order) => order.DueDate ? String(order.DueDate).split("T")[0] : "" },
        { key: "Warehouse", label: "Warehouse", width: 110 },
      ]}
      fetchOptions={fetchOrders}
      searchPlaceholder="Search by Doc No., Item Code or Description"
      emptyMessage="No open production orders found."
      onClose={onClose}
      onSelect={onSelect}
      getRowKey={(order, index) => `${order.DocEntry || order.DocNum || "po"}-${index}`}
      width="min(1180px, calc(100% - 40px))"
    />
  );
}
