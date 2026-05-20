import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/appConfig";

/* ================= COMMON ================= */
const Input = (props) => (
  <input {...props} className="form-control form-control-sm" />
);

const Select = (props) => (
  <select {...props} className="form-control form-control-sm" />
);

/* ================= MAIN ================= */
const getTodayDate = () => new Date().toISOString().split("T")[0];

const createLine = () => ({
  itemNo: "",
  itemDescription: "",
  quantity: "",
  unitPrice: "",
  stdDiscount: "",
  taxCode: "",
  total: "",
  whse: "",
  udf: {}
});

const tabNames = [
  "Contents",
  "Logistics",
  "Accounting",
  "Tax",
  "Electronic Documents",
  "Attachments"
];

export default function PurchaseOrderPage() {

  const [header, setHeader] = useState({
    vendor: "",
    name: "",
    postingDate: getTodayDate(),
    deliveryDate: "",
    documentDate: getTodayDate(),
    discount: "",
    freight: ""
  });

  const [lines, setLines] = useState([createLine()]);
  const [activeTab, setActiveTab] = useState("Contents");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [formSettingsOpen, setFormSettingsOpen] = useState(false);

  const [items, setItems] = useState([]);

  const tableRef = useRef([]);

  /* ================= LOAD ================= */
  useEffect(() => {
    const load = async () => {
      await axios.post(`${API_BASE_URL}/login`);
      const res = await axios.get(`${API_BASE_URL}/items`);
      setItems(res.data);
    };
    load();
  }, []);

  /* ================= HEADER ================= */
  const handleHeaderChange = (e) => {
    const { name, value } = e.target;
    setHeader({ ...header, [name]: value });
  };

  /* ================= LINE ================= */
  const handleLineChange = (i, e) => {
    const { name, value } = e.target;
    let updated = [...lines];

    updated[i][name] = value;

    if (name === "itemNo") {
      const item = items.find(x => x.ItemCode === value);
      updated[i].itemDescription = item?.ItemName || "";
    }

    // total calc
    let qty = Number(updated[i].quantity || 0);
    let price = Number(updated[i].unitPrice || 0);
    let dis = Number(updated[i].stdDiscount || 0);

    let total = qty * price;
    total = total - (total * dis / 100);

    updated[i].total = total.toFixed(2);

    // AUTO ADD ROW
    if (i === lines.length - 1 && updated[i].itemNo) {
      updated.push(createLine());
    }

    setLines(updated);
  };

  /* ================= KEYBOARD NAV ================= */
  const handleKeyDown = (e, rowIndex, colIndex) => {
    if (e.key === "Enter") {
      e.preventDefault();

      let next = tableRef.current[rowIndex]?.[colIndex + 1];

      if (!next) {
        next = tableRef.current[rowIndex + 1]?.[0];
      }

      if (next) next.focus();
    }
  };

  /* ================= TOTAL ================= */
  const subtotal = lines.reduce((sum, l) => sum + Number(l.total || 0), 0);
  const tax = subtotal * 0.18;
  const grand = subtotal + tax;

  /* ================= SUBMIT ================= */
  const handleSubmit = async () => {
    const payload = {
      CardCode: header.vendor,
      DocDate: header.postingDate,
      DocDueDate: header.deliveryDate,
      DocumentLines: lines
        .filter(l => l.itemNo)
        .map(l => ({
          ItemCode: l.itemNo,
          Quantity: Number(l.quantity),
          UnitPrice: Number(l.unitPrice),
          WarehouseCode: l.whse || "01"
        }))
    };

    await axios.post(`${API_BASE_URL}/purchase-order`, payload);

    alert("PO Created");
  };

  /* ================= UI ================= */
  return (
    <div className="container-fluid mt-2">

      {/* HEADER */}
      <div className="card p-2 mb-2">
        <div className="row">

          <div className="col-md-3">
            <label>Vendor</label>
            <Input name="vendor" value={header.vendor} onChange={handleHeaderChange} />

            <label>Name</label>
            <Input name="name" value={header.name} onChange={handleHeaderChange} />
          </div>

          <div className="col-md-3">
            <label>Posting Date</label>
            <Input type="date" name="postingDate" value={header.postingDate} onChange={handleHeaderChange} />

            <label>Delivery Date</label>
            <Input type="date" name="deliveryDate" value={header.deliveryDate} onChange={handleHeaderChange} />
          </div>

        </div>
      </div>

      {/* TOOLBAR */}
      <div className="mb-2">
        <button className="btn btn-sm btn-secondary me-2" onClick={()=>setSidebarOpen(!sidebarOpen)}>
          Toggle UDF
        </button>
        <button className="btn btn-sm btn-secondary" onClick={()=>setFormSettingsOpen(!formSettingsOpen)}>
          Form Settings
        </button>
      </div>

      {/* TABS */}
      <ul className="nav nav-tabs mb-2">
        {tabNames.map(tab => (
          <li className="nav-item" key={tab}>
            <button className={`nav-link ${activeTab===tab?'active':''}`} onClick={()=>setActiveTab(tab)}>
              {tab}
            </button>
          </li>
        ))}
      </ul>

      {/* CONTENTS */}
      {activeTab === "Contents" && (
        <div className="card p-2">

          <table className="table table-bordered table-sm">
            <thead className="table-dark">
              <tr>
                <th>#</th>
                <th>Item</th>
                <th>Description</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Discount</th>
                <th>Whse</th>
                <th>Total</th>
              </tr>
            </thead>

            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td>{i+1}</td>

                  {["itemNo","itemDescription","quantity","unitPrice","stdDiscount","whse"].map((field, j) => (
                    <td key={field}>
                      <input
                        ref={el=>{
                          if(!tableRef.current[i]) tableRef.current[i]=[];
                          tableRef.current[i][j]=el;
                        }}
                        className="form-control form-control-sm"
                        name={field}
                        value={l[field]}
                        onChange={(e)=>handleLineChange(i,e)}
                        onKeyDown={(e)=>handleKeyDown(e,i,j)}
                      />
                    </td>
                  ))}

                  <td>{l.total}</td>
                </tr>
              ))}
            </tbody>
          </table>

        </div>
      )}

      {/* OTHER TABS */}
      {activeTab !== "Contents" && (
        <div className="card p-3">
          <h6>{activeTab}</h6>
        </div>
      )}

      {/* FOOTER */}
      <div className="card p-2 mt-2">
        <div className="row">

          <div className="col-md-3">
            <label>Total</label>
            <Input value={subtotal.toFixed(2)} readOnly />
          </div>

          <div className="col-md-3">
            <label>Tax</label>
            <Input value={tax.toFixed(2)} readOnly />
          </div>

          <div className="col-md-3">
            <label>Grand Total</label>
            <Input value={grand.toFixed(2)} readOnly />
          </div>

        </div>

        <button className="btn btn-success mt-2" onClick={handleSubmit}>
          Add & View
        </button>
      </div>

    </div>
  );
}
