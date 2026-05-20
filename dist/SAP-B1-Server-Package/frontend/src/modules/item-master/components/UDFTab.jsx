import React from "react";

/**
 * User-Defined Fields tab — all U_* fields from your SAP company database.
 * Renders them as a generic editable grid.
 */

// UDF field definitions from your WMS_DEV_UK company
const UDF_FIELDS = [
  { name: "U_VGROUP",    label: "Vehicle Group" },
  { name: "U_VGNAME",    label: "Vehicle Group Name" },
  { name: "U_TID",       label: "Type ID" },
  { name: "U_MTYPE",     label: "Model Type" },
  { name: "U_MNAME",     label: "Model Name" },
  { name: "U_ENGINENO",  label: "Engine No." },
  { name: "U_CHASSNO",   label: "Chassis No." },
  { name: "U_AXENO",     label: "Axle No." },
  { name: "U_DID",       label: "Driver ID" },
  { name: "U_DNAME",     label: "Driver Name" },
  { name: "U_YRMANU",    label: "Year of Manufacture" },
  { name: "U_MAKE",      label: "Make" },
  { name: "U_TRKSTTS",   label: "Truck Status" },
  { name: "U_ODOMTR",    label: "Odometer" },
  { name: "U_LODOMTR",   label: "Last Odometer" },
  { name: "U_FUELCAP",   label: "Fuel Capacity" },
  { name: "U_FUELCNSM",  label: "Fuel Consumption" },
  { name: "U_TAREWT",    label: "Tare Weight" },
  { name: "U_OWNSHP",    label: "Ownership" },
  { name: "U_TRKCAP",    label: "Truck Capacity" },
  { name: "U_MAXCAP",    label: "Max Capacity" },
  { name: "U_CRGTYP",    label: "Cargo Type" },
  { name: "U_CRGDIM",    label: "Cargo Dimensions" },
  { name: "U_CRGNAM",    label: "Cargo Name" },
  { name: "U_EMPID",     label: "Employee ID" },
  { name: "U_Linq",      label: "Linq" },
  { name: "U_linqt",     label: "Linq Type" },
  { name: "U_ZNAME",     label: "Zone Name" },
  { name: "U_I_UOM",     label: "Item UoM" },
  { name: "U_ItemType",  label: "Item Type (UDF)" },
  { name: "U_VOLFORWEB", label: "Volume for Web" },
  { name: "U_COLFORWEB", label: "Colour for Web" },
  { name: "U_BOY_TB_0",  label: "BOY TB 0" },
  { name: "U_CaseSizePcs",       label: "Case Size (Pcs)" },
  { name: "U_ST_SSCCMNG",        label: "SSCC Management" },
  { name: "U_TUPerP",            label: "TU per Pallet" },
  { name: "U_ExpirationDay",     label: "Expiration Day" },
  { name: "U_ST_TUPP",           label: "ST TU per Pallet" },
  { name: "U_ST_ExpirationDay",  label: "ST Expiration Day" },
  { name: "U_ST_EXCL_ITM",       label: "ST Exclude Item" },
  { name: "U_SHOPIFY_ITEM",      label: "Shopify Item" },
];

const BEAS_FIELDS = [
  { name: "U_beas_kzbuchng",    label: "Booking Flag" },
  { name: "U_beas_kzdruck",     label: "Print Flag" },
  { name: "U_beas_aussch",      label: "Scrap %" },
  { name: "U_beas_din",         label: "DIN" },
  { name: "U_beas_me_lager",    label: "Stock UoM" },
  { name: "U_beas_me_verbr",    label: "Consumption UoM" },
  { name: "U_beas_losgr",       label: "Lot Size" },
  { name: "U_beas_match",       label: "Match" },
  { name: "U_beas_sachb_id",    label: "Clerk ID" },
  { name: "U_beas_wbz",         label: "Replenishment Time" },
  { name: "U_beas_wst_id",      label: "Work Station ID" },
  { name: "U_beas_znr",         label: "Drawing No." },
  { name: "U_beas_kalk_pr",     label: "Calc. Price" },
  { name: "U_beas_dispo",       label: "Disposition" },
  { name: "U_beas_ke",          label: "Cost Element" },
  { name: "U_beas_gruppe",      label: "Group" },
  { name: "U_beas_text_d",      label: "Text (DE)" },
  { name: "U_beas_text_eng",    label: "Text (EN)" },
  { name: "U_beas_sa",          label: "SA" },
  { name: "U_beas_form",        label: "Form" },
  { name: "U_beas_un_nr",       label: "UN No." },
  { name: "U_beas_vg",          label: "VG" },
  { name: "U_beas_nag",         label: "NAG" },
  { name: "U_beas_nag_eng",     label: "NAG (EN)" },
  { name: "U_beas_zollt",       label: "Customs Tariff" },
  { name: "U_beas_spezgew",     label: "Specific Weight" },
  { name: "U_beas_verschn",     label: "Cutting Waste" },
  { name: "U_beas_brgew",       label: "Gross Weight" },
  { name: "U_beas_prccode",     label: "Price Code" },
  { name: "U_beas_losgr_ka",    label: "Lot Size (KA)" },
  { name: "U_beas_ver",         label: "Version" },
  { name: "U_beas_haltbark",    label: "Shelf Life" },
  { name: "U_beas_haltbar2",    label: "Shelf Life 2" },
  { name: "U_beas_mps",         label: "MPS" },
  { name: "U_beas_BinGroup",    label: "Bin Group" },
];

export default function UDFTab({ form, onChange }) {
  return (
    <div>
      <div className="im-section-title">User-Defined Fields</div>
      <div className="im-field-grid">
        {UDF_FIELDS.map(({ name, label }) => (
          <div className="im-field" key={name}>
            <label className="im-field__label" title={name}>{label}</label>
            <input className="im-field__input" name={name}
              value={form[name] ?? ""} onChange={onChange} />
          </div>
        ))}
      </div>

      <div className="im-section-title" style={{ marginTop: 14 }}>BEAS Fields</div>
      <div className="im-field-grid">
        {BEAS_FIELDS.map(({ name, label }) => (
          <div className="im-field" key={name}>
            <label className="im-field__label" title={name}>{label}</label>
            <input className="im-field__input" name={name}
              value={form[name] ?? ""} onChange={onChange} />
          </div>
        ))}
      </div>
    </div>
  );
}
