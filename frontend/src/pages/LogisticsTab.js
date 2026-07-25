import React from "react";

function LogisticsTab({ form, setForm }) {
  return (
    <div>
      <h3>Logistics</h3>

      <input
        placeholder="Ship To Address"
        onChange={(e) =>
          setForm({
            ...form,
            AddressExtension: {
              ...form.AddressExtension,
              ShipToStreet: e.target.value
            }
          })
        }
      />

      <input
        placeholder="Bill To Address"
        onChange={(e) =>
          setForm({
            ...form,
            AddressExtension: {
              ...form.AddressExtension,
              BillToStreet: e.target.value
            }
          })
        }
      />

      <input
        placeholder="Place of Supply"
        onChange={(e) =>
          setForm({
            ...form,
            AddressExtension: {
              ...form.AddressExtension,
              PlaceOfSupply: e.target.value
            }
          })
        }
      />
    </div>
  );
}

export default LogisticsTab;