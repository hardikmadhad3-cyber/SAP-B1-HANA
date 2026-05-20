import React from "react";

export default function GeneralTab({
  form,
  onChange,
  locations,
  businessPlaces,
}) {
  return (
    <div className="wh-general-layout">
      {/* Left Column */}
      <div className="wh-general-left">
        {/* Inactive Checkbox */}
        <div className="im-checkbox-label">
          <input
            type="checkbox"
            id="Inactive"
            name="Inactive"
            checked={form.Inactive === "tYES"}
            onChange={onChange}
          />
          <label htmlFor="Inactive">Inactive</label>
        </div>

        {/* Location Dropdown */}
        <div className="im-field">
          <label className="im-field__label">Location</label>
          <select
            className="im-field__select"
            name="Location"
            value={form.Location || ""}
            onChange={onChange}
          >
            <option value="">Select...</option>
            {locations.map((loc) => (
              <option key={loc.code} value={loc.code}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>

        {/* Ship-to Name (WH) */}
        <div className="im-field">
          <label className="im-field__label">Ship-to Name (WH)</label>
          <input
            className="im-field__input"
            name="ShipToName"
            value={form.ShipToName || ""}
            onChange={onChange}
          />
        </div>

        {/* Branch */}
        <div className="im-field">
          <label className="im-field__label">Branch</label>
          <select
            className="im-field__select"
            name="BusinessPlaceID"
            value={form.BusinessPlaceID || ""}
            onChange={onChange}
          >
            <option value="">Select...</option>
            {businessPlaces.map((bp) => (
              <option key={bp.code} value={bp.code}>
                {bp.name}
              </option>
            ))}
          </select>
        </div>

        {/* Address Type */}
        <div className="im-field">
          <label className="im-field__label">Address Type</label>
          <input
            className="im-field__input"
            name="AddressType"
            value={form.AddressType || ""}
            onChange={onChange}
            maxLength={50}
          />
        </div>

        {/* Street/PO Box */}
        <div className="im-field">
          <label className="im-field__label">Street/PO Box</label>
          <input
            className="im-field__input"
            name="Street"
            value={form.Street || ""}
            onChange={onChange}
            maxLength={100}
          />
        </div>

        {/* Street No. */}
        <div className="im-field">
          <label className="im-field__label">Street No.</label>
          <input
            className="im-field__input"
            name="StreetNo"
            value={form.StreetNo || ""}
            onChange={onChange}
            maxLength={50}
          />
        </div>

        {/* Block */}
        <div className="im-field">
          <label className="im-field__label">Block</label>
          <input
            className="im-field__input"
            name="Block"
            value={form.Block || ""}
            onChange={onChange}
            maxLength={50}
          />
        </div>

        {/* Building/Floor/Room */}
        <div className="im-field">
          <label className="im-field__label">Building/Floor/Room</label>
          <input
            className="im-field__input"
            name="BuildingFloorRoom"
            value={form.BuildingFloorRoom || ""}
            onChange={onChange}
            maxLength={50}
          />
        </div>

        {/* Zip Code */}
        <div className="im-field">
          <label className="im-field__label">Zip Code</label>
          <input
            className="im-field__input"
            name="ZipCode"
            value={form.ZipCode || ""}
            onChange={onChange}
            maxLength={20}
          />
        </div>

        {/* City */}
        <div className="im-field">
          <label className="im-field__label">City</label>
          <input
            className="im-field__input"
            name="City"
            value={form.City || ""}
            onChange={onChange}
            maxLength={100}
          />
        </div>

        {/* County */}
        <div className="im-field">
          <label className="im-field__label">County</label>
          <input
            className="im-field__input"
            name="County"
            value={form.County || ""}
            onChange={onChange}
            maxLength={100}
          />
        </div>

        {/* Country/Region */}
        <div className="im-field">
          <label className="im-field__label">Country/Region</label>
          <input
            className="im-field__input"
            name="Country"
            value={form.Country || ""}
            onChange={onChange}
            maxLength={3}
          />
        </div>

        {/* State */}
        <div className="im-field">
          <label className="im-field__label">State</label>
          <input
            className="im-field__input"
            name="State"
            value={form.State || ""}
            onChange={onChange}
            maxLength={3}
          />
        </div>

        {/* GLN */}
        <div className="im-field">
          <label className="im-field__label">GLN</label>
          <input
            className="im-field__input"
            name="GlobalLocationNumber"
            value={form.GlobalLocationNumber || ""}
            onChange={onChange}
            maxLength={13}
            placeholder="13-digit GLN"
          />
        </div>

        {/* Tax Office field removed - not a valid SAP Warehouse property */}

        {/* Address Name 2 */}
        <div className="im-field">
          <label className="im-field__label">Address Name 2</label>
          <input
            className="im-field__input"
            name="AddressName2"
            value={form.AddressName2 || ""}
            onChange={onChange}
          />
        </div>

        {/* Address Name 3 */}
        <div className="im-field">
          <label className="im-field__label">Address Name 3</label>
          <input
            className="im-field__input"
            name="AddressName3"
            value={form.AddressName3 || ""}
            onChange={onChange}
          />
        </div>
      </div>

      {/* Right Column */}
      <div className="wh-general-right">
        {/* Drop-Ship Checkbox */}
        <div className="im-checkbox-label">
          <input
            type="checkbox"
            id="DropShip"
            name="DropShip"
            checked={form.DropShip === "tYES"}
            onChange={onChange}
          />
          <label htmlFor="DropShip">Drop-Ship</label>
        </div>

        {/* Nettable Checkbox */}
        <div className="im-checkbox-label">
          <input
            type="checkbox"
            id="Nettable"
            name="Nettable"
            checked={form.Nettable === "tYES"}
            onChange={onChange}
          />
          <label htmlFor="Nettable">Nettable</label>
        </div>

        {/* Excisable Checkbox */}
        <div className="im-checkbox-label">
          <input
            type="checkbox"
            id="Excisable"
            name="Excisable"
            checked={form.Excisable === "tYES"}
            onChange={onChange}
          />
          <label htmlFor="Excisable">Excisable</label>
        </div>

        {/* Enable Bin Locations Checkbox */}
        <div className="im-checkbox-label">
          <input
            type="checkbox"
            id="EnableBinLocations"
            name="EnableBinLocations"
            checked={form.EnableBinLocations === "tYES"}
            onChange={onChange}
          />
          <label htmlFor="EnableBinLocations">Enable Bin Locations</label>
        </div>
      </div>
    </div>
  );
}
