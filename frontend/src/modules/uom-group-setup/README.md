# UoM Groups Setup Module

Complete implementation of SAP Business One's Unit of Measurement Groups setup page with two-page structure.

## Features

### Page 1: UoM Groups List
- Grid-based interface for managing multiple UoM groups
- Columns: #, Code (max 8 chars), Name (max 50 chars), Base UoM (dropdown), ... (definition button)
- Minimum 5 rows displayed
- Add new rows dynamically
- OK/Cancel buttons for batch save

### Page 2: Group Definition Modal
- Opens when clicking "..." button on a saved group
- Comprehensive grid for defining alternate UoMs with:
  - UoM Code (dropdown from UnitsOfMeasurement)
  - EWB Unit (GST/eCommerce unit codes)
  - Dimensions: Length, Width, Height
  - Volume (auto-calculated from L×W×H)
  - Volume Unit (dropdown)
  - Weight & Weight Unit
  - Base Quantity & Alternate Quantity
- Horizontal scrolling for wide grid
- Auto-calculation of volume when dimensions change

## SAP B1 Service Layer Integration

### Endpoints
- `POST /UnitOfMeasurementGroups` - Create group
- `GET /UnitOfMeasurementGroups(AbsEntry)` - Get group with definition
- `PATCH /UnitOfMeasurementGroups(AbsEntry)` - Update group
- `GET /UnitOfMeasurementGroups` - List all groups
- `GET /UnitsOfMeasurements` - Lookup individual UoMs

### Payload Structure
```json
{
  "Code": "BOX-GRP",
  "Name": "Box Group",
  "BaseUoM": 5,
  "UoMGroupDefinitionCollection": [
    {
      "AlternateUoM": 6,
      "BaseQuantity": 1,
      "AlternateQuantity": 12,
      "Weight1": 500,
      "WeightUnit": "wsGram",
      "Length1": 30,
      "Width1": 20,
      "Height1": 15,
      "Volume": 9000,
      "VolumeUnit": "vsCubicCentimeter",
      "EWBUnit": "BOX"
    }
  ]
}
```

## Enum Values

### Volume Units
- vsMilliliter, vsCubicCentimeter, vsLiter, vsCubicMeter, vsCubicInch, vsCubicFoot

### Weight Units
- wsGram, wsKilogram, wsTon, wsOunce, wsPound

### EWB Units (GST India)
- BAG, BOX, KGS, LTR, MTR, NOS, PCS, UNT, etc.

## Validations

- Code: Required, max 8 chars, alphanumeric, unique
- Name: Required, max 50 chars
- BaseUoM: Required
- AlternateUoM: Cannot be same as BaseUoM
- No duplicate AlternateUoM in definition rows
- Volume auto-calculated: Length × Width × Height

## Components

### UoMGroupSetup.jsx
Main component managing groups list and modal state.

### UoMGroupsGrid.jsx
Grid component for Page 1 - list of UoM groups.

### GroupDefinitionModal.jsx
Modal component for Page 2 - group definition with alternate UoMs.

## Usage

```jsx
import UoMGroupSetup from './modules/uom-group-setup/UoMGroupSetup';

function UoMGroupPage() {
  return <UoMGroupSetup />;
}
```

## Styling

Uses project's existing theme with:
- Blue toolbar (#e8edf2)
- White grid backgrounds
- Yellow input focus (#ffffcc)
- Blue primary buttons (#0070c0)
- Responsive grid with horizontal scrolling
