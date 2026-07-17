import { useCallback } from "react";
import SapLookupModal from "../../../components/common/SapLookupModal";

export default function ItemSearchModal({
  onSelect,
  onClose,
  fetchItems,
  columns,
  title,
  allowNew = false,
  onNew,
  autoSearchOnOpen = true,
  emptyMessage = "No items found.",
}) {
  const defaultColumns = [
    { key: "ItemCode", label: "Item Code" },
    { key: "ItemName", label: "Item Name" },
    { key: "InventoryUOM", label: "UoM" },
  ];
  const displayColumns = Array.isArray(columns) && columns.length ? columns : defaultColumns;
  const fetchRows = useCallback(async (query = "") => {
    const data = await fetchItems(query);
    return Array.isArray(data) ? data : [];
  }, [fetchItems]);

  return (
    <SapLookupModal
      open
      title={title || "List of Items"}
      columns={[
        { key: "rowNumber", label: "#", width: 44, searchable: false, render: (_item, index) => index + 1 },
        ...displayColumns.map((column) => ({
          ...column,
          render: column.render ? (row) => column.render(row[column.key], row) : undefined,
        })),
      ]}
      fetchOptions={fetchRows}
      fetchOnOpen={autoSearchOnOpen}
      searchPlaceholder="Search"
      emptyMessage={emptyMessage}
      onClose={onClose}
      onSelect={onSelect}
      onNew={allowNew && onNew ? onNew : undefined}
      getRowKey={(item, index) => `${item[displayColumns[0]?.key] || "item"}-${index}`}
      width="min(920px, calc(100% - 40px))"
    />
  );
}
