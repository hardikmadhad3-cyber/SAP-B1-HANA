import { useCallback } from "react";
import SapLookupModal from "../../../components/common/SapLookupModal";

export default function CustomerSearchModal({ onSelect, onClose, fetchCustomers }) {
  const fetchRows = useCallback(async (query = "") => {
    const data = await fetchCustomers(query);
    return Array.isArray(data) ? data : [];
  }, [fetchCustomers]);

  return (
    <SapLookupModal
      open
      title="Customer Search"
      columns={[
        { key: "CardCode", label: "Customer Code", width: 150 },
        { key: "CardName", label: "Customer Name" },
      ]}
      fetchOptions={fetchRows}
      searchPlaceholder="Search by code or name"
      emptyMessage="No customers found."
      onClose={onClose}
      onSelect={onSelect}
      getRowKey={(customer, index) => `${customer.CardCode || "customer"}-${index}`}
      width="min(720px, calc(100% - 40px))"
    />
  );
}
