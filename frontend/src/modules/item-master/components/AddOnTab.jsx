import React from "react";

const YARN_COTTON_FIELDS = [
  {
    name: "U_Application",
    label: "Application",
    options: ["WEAVING", "KNITTING", "WARPING", "DYEING"],
  },
  {
    name: "U_Attribute",
    label: "Attribute",
    options: ["LOWER RAI", "COMBED", "CARDED", "COMPACT", "OPEN END"],
  },
  {
    name: "U_Count",
    label: "Count",
    options: ["10", "12", "14", "16", "20", "24", "30", "40", "60"],
  },
  {
    name: "U_CottonType",
    label: "Cotton Type",
    options: ["BLUE P2303", "RAW WHITE", "BLEACHED", "DYED", "MELANGE"],
  },
  {
    name: "U_SpinningProcess",
    label: "Spinning Process",
    options: ["SIRO", "RING", "OPEN END", "VORTEX", "COMPACT"],
  },
  {
    name: "U_YarnPly",
    label: "Yarn Ply",
    options: ["1", "2", "3", "4"],
  },
];

const withCurrentValue = (options, value) => {
  const currentValue = String(value || "").trim();
  if (!currentValue || options.includes(currentValue)) return options;
  return [currentValue, ...options];
};

export default function AddOnTab({ form, onChange }) {
  return (
    <div className="im-addon-tab">
      <div className="im-addon-fields">
        {YARN_COTTON_FIELDS.map((field) => (
          <div className="im-field im-addon-field" key={field.name}>
            <label className="im-field__label">{field.label}</label>
            <select
              className="im-field__select"
              name={field.name}
              value={form[field.name] || ""}
              onChange={onChange}
            >
              <option value=""></option>
              {withCurrentValue(field.options, form[field.name]).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
