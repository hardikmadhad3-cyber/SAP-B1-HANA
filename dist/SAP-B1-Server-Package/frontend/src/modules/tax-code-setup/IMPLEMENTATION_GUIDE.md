# Tax Code Setup - SAP B1 Implementation Guide

## Overview
This module replicates the SAP Business One Tax Code Setup functionality with all business logic, validations, and UI features.

## Features Implemented

### 1. Header Section
- **Code**: Tax code identifier (max 8 characters, required, read-only after creation)
- **Description**: Tax code name (max 100 characters, required)
- **Tax Rate**: Primary tax rate percentage (0-100, decimal allowed)
- **Inactive**: Checkbox to mark tax code as inactive
- **Freight**: Checkbox to indicate if this is a freight tax code
- **Tax Type Combination**: Dropdown with predefined tax types:
  - GST (Goods and Services Tax)
  - CST (Central Sales Tax)
  - CSTCS (CST with Cess)
  - IGST (Integrated GST)
  - ITCS (Input Tax Credit Scheme)
  - Service (Service Tax)
  - VAT (Value Added Tax)
  - CENVAT+VAT (Central VAT + VAT)
  - Define New (Custom tax type)

### 2. Tax Components Grid
A detailed grid for defining tax components with the following columns:

- **#**: Row number (auto-generated)
- **Tax Type**: Dropdown selection from predefined types:
  - sys_SGST (State GST)
  - sys_CGST (Central GST)
  - sys_IGST (Integrated GST)
  - sys_CESS (Cess)
  - sys_VAT (VAT)
  - sys_CST (CST)
  - sys_Service (Service Tax)
  - sys_Excise (Excise Duty)
  - sys_Custom (Custom Duty)

- **Code**: Component code (max 8 characters)
- **Description**: Component description (max 100 characters)
- **Sales Tax Account**: G/L account for sales tax (with lookup)
- **Purchasing Tax Account**: G/L account for purchase tax (with lookup)
- **Non-Deductible**: Percentage of non-deductible tax (0-100)
- **Non-Deductible Account**: G/L account for non-deductible portion (with lookup)
- **Actions**: Delete row button

### 3. Business Logic

#### Validation Rules
1. **Required Fields**:
   - Code (max 8 chars)
   - Description (max 100 chars)

2. **Tax Rate**:
   - Must be numeric
   - Range: 0-100
   - Decimal values allowed

3. **Tax Component Lines**:
   - Tax Type required if any field in line is filled
   - Code max 8 characters
   - Description max 100 characters
   - Non-Deductible must be 0-100
   - Non-Deductible Account required if Non-Deductible % > 0

#### Business Rule Warnings
1. Tax Rate is 0 but components are defined (composite tax)
2. Freight enabled but no freight tax type in components
3. Duplicate tax types in components

### 4. CRUD Operations

#### Create (Add Mode)
- Enter new tax code details
- Fill in tax components
- Click "Add" to save
- Automatically switches to Update mode after successful creation

#### Read (Find Mode)
- Click "Find" button
- Search for existing tax codes
- Select from lookup modal
- Loads data into form in Update mode

#### Update (Update Mode)
- Modify existing tax code
- Code field becomes read-only
- Click "Update" to save changes

#### Cancel
- Resets form to empty state
- Returns to Add mode

### 5. Lookup Functionality

#### Tax Code Lookup
- Search by code or description
- Displays: Code, Description, Rate
- Click row to select

#### G/L Account Lookup
- Available for:
  - Sales Tax Account
  - Purchasing Tax Account
  - Non-Deductible Account
- Search by code or name
- Displays: Code, Name
- Click row to select

### 6. Grid Features
- Minimum 2 rows displayed
- Add new rows dynamically
- Delete individual rows
- Inline editing for all fields
- Lookup buttons for account fields
- Dropdown for Tax Type selection

## Technical Implementation

### Frontend Structure
```
frontend/src/modules/tax-code-setup/
├── TaxCodeSetup.jsx              # Main component
├── components/
│   ├── TaxComponentsGrid.jsx     # Grid component
│   └── LookupModal.jsx           # Reusable lookup modal
├── validation/
│   └── taxCodeValidation.js      # Validation logic
└── styles/
    └── taxCodeSetup.css          # SAP B1 styling
```

### Backend Structure
```
backend/
├── controllers/
│   └── taxCodeController.js      # CRUD operations
├── routes/
│   └── taxCodeRoutes.js          # API routes
└── services/
    └── sapService.js             # SAP B1 Service Layer integration
```

### API Endpoints
- `POST /tax-codes/create` - Create new tax code
- `GET /tax-codes/:code` - Get tax code by code
- `PATCH /tax-codes/:code` - Update tax code
- `GET /tax-codes/search` - Search tax codes
- `GET /tax-codes/lookup/gl-accounts` - Lookup G/L accounts

### Data Model
```javascript
{
  Code: string,              // max 8 chars
  Name: string,              // max 100 chars
  Rate: number,              // 0-100
  Inactive: boolean,
  Freight: boolean,
  TaxTypeCombination: string,
  VatGroups_Lines: [
    {
      TaxType: string,
      Code: string,
      Description: string,
      SalesTaxAccount: string,
      PurchasingTaxAccount: string,
      NonDeductible: number,
      NonDeductibleAccount: string
    }
  ]
}
```

## Usage Examples

### Creating a GST Tax Code
1. Enter Code: "GST18"
2. Enter Description: "GST @ 18%"
3. Enter Tax Rate: 18.00
4. Select Tax Type Combination: "GST"
5. Add components:
   - Line 1: Tax Type = sys_CGST, Code = "CGST9", Description = "CGST @ 9%"
   - Line 2: Tax Type = sys_SGST, Code = "SGST9", Description = "SGST @ 9%"
6. Select appropriate G/L accounts
7. Click "Add"

### Creating a Composite Tax with Non-Deductible
1. Enter Code: "VAT+CESS"
2. Enter Description: "VAT with Cess"
3. Enter Tax Rate: 15.00
4. Add components:
   - Line 1: Tax Type = sys_VAT, Non-Deductible = 0
   - Line 2: Tax Type = sys_CESS, Non-Deductible = 50, Non-Deductible Account = "123456"
5. Click "Add"

## Styling
The UI follows SAP B1 design guidelines:
- Windows-style form layout
- Gray toolbar with blue primary buttons
- Grid with alternating row colors on hover
- Modal dialogs for lookups
- Consistent spacing and typography

## Validation Messages
- Success: Green background with success icon
- Error: Red background with error message
- Warnings: Console warnings for business rules

## Future Enhancements
1. Bulk import/export functionality
2. Tax code templates
3. Audit trail for changes
4. Advanced search filters
5. Tax calculation preview
6. Integration with transaction documents
