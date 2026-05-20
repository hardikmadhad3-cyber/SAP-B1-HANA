import React, { useState } from "react";

const fmt = (v) =>
  v == null || v === ""
    ? "—"
    : Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Warehouse Stock tab — per-warehouse stock + editable GL accounts.
 * props:
 *   stock: ItemWarehouseInfoCollection rows from SAP
 *   onWarehouseChange(index, field, value)
 */
export default function WarehouseStockTab({ stock = [], onWarehouseChange }) {
  const [expandedRow, setExpandedRow] = useState(null);

  const totals = stock.reduce(
    (acc, r) => {
      acc.InStock   += Number(r.InStock   || 0);
      acc.Committed += Number(r.Committed || 0);
      acc.Ordered   += Number(r.Ordered   || 0);
      return acc;
    },
    { InStock: 0, Committed: 0, Ordered: 0 }
  );

  if (stock.length === 0) {
    return (
      <div className="im-tab-placeholder">
        Warehouse stock data will appear here after the item is loaded from SAP.
      </div>
    );
  }

  const GL_FIELDS = [
    { name: "InventoryAccount",                   label: "Inventory Account" },
    { name: "CostAccount",                        label: "Cost Account" },
    { name: "TransferAccount",                    label: "Transfer Account" },
    { name: "RevenuesAccount",                    label: "Revenue Account" },
    { name: "ExpensesAccount",                    label: "Expense Account" },
    { name: "EURevenuesAccount",                  label: "EU Revenue Account" },
    { name: "EUExpensesAccount",                  label: "EU Expense Account" },
    { name: "ForeignRevenueAcc",                  label: "Foreign Revenue Acct" },
    { name: "ForeignExpensAcc",                   label: "Foreign Expense Acct" },
    { name: "ExemptIncomeAcc",                    label: "Exempt Income Acct" },
    { name: "PriceDifferenceAcc",                 label: "Price Difference Acct" },
    { name: "VarienceAccount",                    label: "Variance Account" },
    { name: "DecreasingAccount",                  label: "Decreasing Account" },
    { name: "IncreasingAccount",                  label: "Increasing Account" },
    { name: "ReturningAccount",                   label: "Returning Account" },
    { name: "ExpenseClearingAct",                 label: "Expense Clearing Acct" },
    { name: "PurchaseCreditAcc",                  label: "Purchase Credit Acct" },
    { name: "EUPurchaseCreditAcc",                label: "EU Purchase Credit Acct" },
    { name: "ForeignPurchaseCreditAcc",           label: "Foreign Purch. Credit Acct" },
    { name: "SalesCreditAcc",                     label: "Sales Credit Acct" },
    { name: "SalesCreditEUAcc",                   label: "Sales Credit EU Acct" },
    { name: "ExemptedCredits",                    label: "Exempted Credits" },
    { name: "SalesCreditForeignAcc",              label: "Sales Credit Foreign Acct" },
    { name: "ExpenseOffsettingAccount",           label: "Expense Offsetting Acct" },
    { name: "WipAccount",                         label: "WIP Account" },
    { name: "ExchangeRateDifferencesAcct",        label: "Exchange Rate Diff. Acct" },
    { name: "GoodsClearingAcct",                  label: "Goods Clearing Acct" },
    { name: "NegativeInventoryAdjustmentAccount", label: "Neg. Inv. Adj. Acct" },
    { name: "CostInflationOffsetAccount",         label: "Cost Inflation Offset Acct" },
    { name: "GLDecreaseAcct",                     label: "G/L Decrease Acct" },
    { name: "GLIncreaseAcct",                     label: "G/L Increase Acct" },
    { name: "PAReturnAcct",                       label: "PA Return Acct" },
    { name: "PurchaseAcct",                       label: "Purchase Account" },
    { name: "PurchaseOffsetAcct",                 label: "Purchase Offset Acct" },
    { name: "ShippedGoodsAccount",                label: "Shipped Goods Account" },
    { name: "StockInflationOffsetAccount",        label: "Stock Inflation Offset Acct" },
    { name: "StockInflationAdjustAccount",        label: "Stock Inflation Adj. Acct" },
    { name: "VATInRevenueAccount",                label: "VAT in Revenue Acct" },
    { name: "WipVarianceAccount",                 label: "WIP Variance Account" },
    { name: "CostInflationAccount",               label: "Cost Inflation Account" },
    { name: "StockInTransitAccount",              label: "Stock in Transit Acct" },
    { name: "WipOffsetProfitAndLossAccount",      label: "WIP Offset P&L Acct" },
    { name: "InventoryOffsetProfitAndLossAccount",label: "Inv. Offset P&L Acct" },
    { name: "PurchaseBalanceAccount",             label: "Purchase Balance Acct" },
  ];

  return (
    <div>
      <div className="im-section-title">Inventory — By Warehouse</div>
      <div className="im-grid-wrap">
        <table className="im-grid">
          <thead>
            <tr>
              <th>WH</th>
              <th className="im-grid__cell--num">In Stock</th>
              <th className="im-grid__cell--num">Committed</th>
              <th className="im-grid__cell--num">Ordered</th>
              <th className="im-grid__cell--num">Min</th>
              <th className="im-grid__cell--num">Max</th>
              <th className="im-grid__cell--num">Min Order</th>
              <th className="im-grid__cell--num">Std Avg Price</th>
              <th>Locked</th>
              <th>Default Bin</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {stock.map((row, i) => (
              <React.Fragment key={row.WarehouseCode}>
                <tr>
                  <td><strong>{row.WarehouseCode}</strong></td>
                  <td className="im-grid__cell--num">{fmt(row.InStock)}</td>
                  <td className="im-grid__cell--num im-grid__cell--warn">{fmt(row.Committed)}</td>
                  <td className="im-grid__cell--num im-grid__cell--info">{fmt(row.Ordered)}</td>
                  <td className="im-grid__cell--num im-grid__cell--muted">
                    <input className="im-grid__input" type="number" value={row.MinimalStock ?? ""}
                      onChange={(e) => onWarehouseChange(i, "MinimalStock", e.target.value)} />
                  </td>
                  <td className="im-grid__cell--num im-grid__cell--muted">
                    <input className="im-grid__input" type="number" value={row.MaximalStock ?? ""}
                      onChange={(e) => onWarehouseChange(i, "MaximalStock", e.target.value)} />
                  </td>
                  <td className="im-grid__cell--num im-grid__cell--muted">
                    <input className="im-grid__input" type="number" value={row.MinimalOrder ?? ""}
                      onChange={(e) => onWarehouseChange(i, "MinimalOrder", e.target.value)} />
                  </td>
                  <td className="im-grid__cell--num im-grid__cell--muted">{fmt(row.StandardAveragePrice)}</td>
                  <td>
                    <select style={{ fontSize: 11, height: 20 }} value={row.Locked || "tNO"}
                      onChange={(e) => onWarehouseChange(i, "Locked", e.target.value)}>
                      <option value="tNO">No</option>
                      <option value="tYES">Yes</option>
                    </select>
                  </td>
                  <td className="im-grid__cell--muted">{row.DefaultBin || "—"}</td>
                  <td>
                    <button type="button" className="im-btn" style={{ padding: "1px 8px", fontSize: 11 }}
                      onClick={() => setExpandedRow(expandedRow === i ? null : i)}>
                      {expandedRow === i ? "▲ G/L" : "▼ G/L"}
                    </button>
                  </td>
                </tr>
                {expandedRow === i && (
                  <tr>
                    <td colSpan={11} style={{ background: "#f8fafc", padding: "10px 16px" }}>
                      <div className="im-section-title">G/L Accounts — {row.WarehouseCode}</div>
                      <div className="im-field-grid">
                        {GL_FIELDS.map(({ name, label }) => (
                          <div className="im-field" key={name}>
                            <label className="im-field__label">{label}</label>
                            <input className="im-field__input" value={row[name] || ""}
                              onChange={(e) => onWarehouseChange(i, name, e.target.value)} />
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr className="im-grid__total">
              <td>Total</td>
              <td className="im-grid__cell--num">{fmt(totals.InStock)}</td>
              <td className="im-grid__cell--num">{fmt(totals.Committed)}</td>
              <td className="im-grid__cell--num">{fmt(totals.Ordered)}</td>
              <td colSpan={7} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
