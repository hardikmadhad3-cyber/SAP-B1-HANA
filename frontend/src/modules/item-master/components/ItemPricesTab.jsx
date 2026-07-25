import React from "react";

/**
 * ItemPrices tab — editable grid matching SAP B1 ItemPrices collection.
 * props:
 *   prices: [{ PriceList, Price, Currency, AdditionalPrice1, AdditionalCurrency1,
 *              AdditionalPrice2, AdditionalCurrency2, BasePriceList, Factor,
 *              PriceListName }]
 *   onPriceChange(index, field, value)
 */
export default function ItemPricesTab({ prices = [], onPriceChange }) {
  if (prices.length === 0) {
    return (
      <div className="im-tab-placeholder">
        Price list data will appear here after the item is loaded.
      </div>
    );
  }

  return (
    <div>
      <div className="im-section-title">Item Prices</div>
      <div className="im-grid-wrap">
        <table className="im-grid">
          <thead>
            <tr>
              <th>#</th>
              <th>Price List</th>
              <th className="im-grid__cell--num">Price</th>
              <th>Currency</th>
              <th className="im-grid__cell--num">Add. Price 1</th>
              <th>Add. Curr. 1</th>
              <th className="im-grid__cell--num">Add. Price 2</th>
              <th>Add. Curr. 2</th>
              <th>Base List</th>
              <th className="im-grid__cell--num">Factor</th>
            </tr>
          </thead>
          <tbody>
            {prices.map((row, i) => (
              <tr key={row.PriceList ?? i}>
                <td className="im-grid__cell--muted">{row.PriceList}</td>
                <td>{row.PriceListName || `List ${row.PriceList}`}</td>
                <td>
                  <input className="im-grid__input" type="number" value={row.Price ?? ""}
                    onChange={(e) => onPriceChange(i, "Price", e.target.value)} />
                </td>
                <td>
                  <input className="im-grid__input im-grid__input--sm" value={row.Currency ?? ""}
                    onChange={(e) => onPriceChange(i, "Currency", e.target.value)} />
                </td>
                <td>
                  <input className="im-grid__input" type="number" value={row.AdditionalPrice1 ?? ""}
                    onChange={(e) => onPriceChange(i, "AdditionalPrice1", e.target.value)} />
                </td>
                <td>
                  <input className="im-grid__input im-grid__input--sm" value={row.AdditionalCurrency1 ?? ""}
                    onChange={(e) => onPriceChange(i, "AdditionalCurrency1", e.target.value)} />
                </td>
                <td>
                  <input className="im-grid__input" type="number" value={row.AdditionalPrice2 ?? ""}
                    onChange={(e) => onPriceChange(i, "AdditionalPrice2", e.target.value)} />
                </td>
                <td>
                  <input className="im-grid__input im-grid__input--sm" value={row.AdditionalCurrency2 ?? ""}
                    onChange={(e) => onPriceChange(i, "AdditionalCurrency2", e.target.value)} />
                </td>
                <td className="im-grid__cell--muted">{row.BasePriceList ?? "—"}</td>
                <td>
                  <input className="im-grid__input im-grid__input--sm" type="number" value={row.Factor ?? ""}
                    onChange={(e) => onPriceChange(i, "Factor", e.target.value)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
