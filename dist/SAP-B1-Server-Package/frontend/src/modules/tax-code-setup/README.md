# Tax Codes - Setup Module

This module implements the SAP Business One Tax Codes Setup page with full Service Layer integration.

## Features

### Header Fields
- **Code** (required, max 8 chars): Unique tax code identifier
- **Description** (required, max 100 chars): Tax code name
- **Tax Rate** (readonly): Auto-calculated from grid rows
- **Inactive** (checkbox): Mark tax code as inactive (tYES/tNO)
- **Freight** (checkbox): Apply to freight charges (tYES/tNO)
- **Tax Type** (dropdown): Tax calculation type
  - Tax Type Combination (ttCombination)
  - Base Amount (ttBase)
  - Percentage (ttPercentage)
  - Flat Tax (ttFlat)

### Tax Components Grid
Line items table with the following columns:
- **#**: Row number (auto-generated)
- **Type ABS ID**: Absolute ID reference (optional)
- **Tax Type**: Per-row tax type (dropdown)
  - Input Tax (IG)
  - Output Tax (OG)
  - Exempt (EX)
  - Non-Taxable (NF)
  - Combination (CM)
- **Code**: VAT Group code with lookup functionality
- **Description**: Auto-filled from selected VAT Group
- **Sales Tax Account**: G/L account for sales tax with lookup
- **Purchase Tax Account**: G/L account for purchase tax with lookup
- **Actions**: Delete row button

### Functionality
- **Add Mode**: Create new tax codes
- **Update Mode**: Modify existing tax codes
- **Find**: Search and load existing tax codes
- **Lookup Modals**: Search for VAT Groups and G/L Accounts
- **Auto-calculation**: Tax rate automatically calculated from grid rows when Tax Type is "Combination"
- **Validation**: 
  - Required fields validation
  - Max length validation
  - At least one grid row required
  - Duplicate code check

## SAP B1 Service Layer Integration

### Endpoints Used
- `POST /VatGroups` - Create tax code
- `GET /VatGroups('{Code}')` - Get tax code with lines
- `PATCH /VatGroups('{Code}')` - Update tax code
- `GET /VatGroups` - Search tax codes
- `GET /ChartOfAccounts` - Lookup G/L accounts

### Payload Structure
```json
{
  "Code": "GST18",
  "Name": "GST 18%",
  "TaxType": "ttCombination",
  "Inactive": "tNO",
  "Freight": "tNO",
  "VatGroups_Lines": [
    {
      "Line": 1,
      "VatGroup": "CGST9",
      "Name": "CGST 9%",
      "Category": "bovcOutputTax",
      "TaxAccount": "24010001",
      "PurchaseTaxAccount": "13010001"
    }
  ]
}
```

## Styling

The module uses SAP B1-inspired styling:
- Yellow input fields (#ffffcc) for editable fields
- Gray backgrounds (#f0f2f5) for page
- Blue primary buttons (#0070c0)
- Grid with hover effects
- Modal dialogs for lookups

## Components

### TaxCodeSetup.jsx
Main component managing form state, validation, and API calls.

### TaxComponentsGrid.jsx
Grid component for managing tax component lines with inline editing and lookup functionality.

### LookupModal.jsx
Reusable modal component for searching and selecting records (VAT Groups, G/L Accounts).

## Usage

```jsx
import TaxCodeSetup from './modules/tax-code-setup/TaxCodeSetup';

function TaxCodePage() {
  return <TaxCodeSetup />;
}
```

## Keyboard Shortcuts
- **Tab**: Navigate between fields
- **Enter**: Submit search in lookup modals
- **Escape**: Close modals

## Error Handling
- Displays user-friendly error messages
- Validates required fields before submission
- Shows SAP Service Layer error messages
- Auto-dismisses alerts after 5 seconds
