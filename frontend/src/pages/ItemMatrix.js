import React from "react";

function ItemMatrix({ form, setForm, items }) {

  const addRow = () => {
    setForm({
      ...form,
      DocumentLines: [
        ...form.DocumentLines,
        {
          ItemCode: "",
          ItemName: "",
          Quantity: 1,
          Price: 0,
          WarehouseCode: "01",
          TaxCode: "GST18"
        }
      ]
    });
  };

  const updateRow = (index, field, value) => {
    const updated = [...form.DocumentLines];
    updated[index][field] = value;

    if (field === "ItemCode") {
      const selected = items.find(i => i.ItemCode === value);
      updated[index].ItemName = selected?.ItemName || "";
    }

    setForm({ ...form, DocumentLines: updated });
  };

  return (
    <div>
      <button onClick={addRow}>+ Add Row</button>

      <table border="1" width="100%">
        <thead>
          <tr>
            <th>Item Code</th>
            <th>Item Name</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Warehouse</th>
            <th>Tax Code</th>
          </tr>
        </thead>

        <tbody>
          {form.DocumentLines.map((row, i) => (
            <tr key={i}>
              <td>
                <select onChange={(e) => updateRow(i, "ItemCode", e.target.value)}>
                  <option>Select</option>
                  {items.map(it => (
                    <option key={it.ItemCode} value={it.ItemCode}>
                      {it.ItemCode}
                    </option>
                  ))}
                </select>
              </td>

              <td>{row.ItemName}</td>

              <td>
                <input
                  type="number"
                  value={row.Quantity}
                  onChange={(e) => updateRow(i, "Quantity", e.target.value)}
                />
              </td>

              <td>
                <input
                  type="number"
                  value={row.Price}
                  onChange={(e) => updateRow(i, "Price", e.target.value)}
                />
              </td>

              <td>
                <input
                  value={row.WarehouseCode}
                  onChange={(e) => updateRow(i, "WarehouseCode", e.target.value)}
                />
              </td>

              <td>
                <input
                  value={row.TaxCode}
                  onChange={(e) => updateRow(i, "TaxCode", e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ItemMatrix;