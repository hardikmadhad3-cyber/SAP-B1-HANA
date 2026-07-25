# Branches - Setup

## Overview
The Branches Setup page replicates SAP Business One's branch/business places configuration screen. It provides a grid-based interface for managing company branches with full address, tax, and default settings.

## Important: SAP B1 Naming Convention
- **UI Name**: "Branches"
- **Database Table**: OBPL
- **Service Layer Entity**: `BusinessPlaces` (MUST use this for API calls)

## Features

### Grid-Based Interface
- **Multi-row editing**: Add, edit multiple branches at once
- **Inline editing**: Direct cell editing with SAP B1-style yellow input fields
- **Batch operations**: Save all changes in one operation
- **Auto-numbering**: BPLID is automatically assigned by SAP B1

### Field Structure

| Field | SAP Field Name | Type | Description | Required |
|-------|----------------|------|-------------|----------|
| Code | BPLID | Integer | Auto-assigned by SAP B1 | Auto |
| Branch Name | BPLName | String | Branch name | Yes |
| Branch Name (Foreign) | BPLNameForeign | String | Foreign language name | No |
| GST/VAT No. | VATRegNum | String | VAT/GST registration number | No |
| Rep Name | RepName | String | Representative name | No |
| Industry | Industry | String | Industry type | No |
| Main Branch | MainBPL | Enum | Is this the main branch? (tYES/tNO) | No |
| Disabled | Disabled | Enum | Is branch disabled? (tYES/tNO) | No |

### Operations

#### Add New Branch
1. Click "Add Row" button
2. Enter branch details in the new row
3. Set Main Branch and Disabled checkboxes as needed
4. Click "OK" to save

#### Edit Existing Branch
1. Modify any field in the grid
2. Changes are tracked automatically
3. Click "OK" to save all changes

#### Cancel Changes
- Click "Cancel" to reload original data and discard all unsaved changes

## SAP B1 Integration

### Service Layer Endpoint
- **Entity**: `BusinessPlaces`
- **Base URL**: `/BusinessPlaces`

### API Operations

#### Create
```javascript
POST /BusinessPlaces
{
  "BPLName": "Mumbai Branch",
  "BPLNameForeign": "मुंबई शाखा",
  "VATRegNum": "27AAAAA0000A1Z5",
  "RepName": "John Doe",
  "Industry": "Manufacturing",
  "MainBPL": "tNO",
  "Disabled": "tNO"
}
```

#### Read
```javascript
GET /BusinessPlaces(1)
GET /BusinessPlaces?$select=BPLID,BPLName,VATRegNum&$top=50
```

#### Update
```javascript
PATCH /BusinessPlaces(1)
{
  "BPLName": "Mumbai Head Office",
  "MainBPL": "tYES"
}
```

## Field Mappings

### MainBPL Enum (Main Branch)
- `tYES` - This is the main/head office branch
- `tNO` - Regular branch

### Disabled Enum
- `tYES` - Branch is disabled/inactive
- `tNO` - Branch is active

## Validation Rules

1. **BPLName**: Required, cannot be empty
2. **BPLID**: Read-only, assigned by SAP B1
3. **MainBPL**: Only one branch should be marked as main
4. **VATRegNum**: Should follow country-specific format
5. **Checkboxes**: Must map to tYES/tNO format

## UI Components

### Files
- `BranchSetup.jsx` - Main setup component
- `styles/branchSetup.css` - SAP B1-style CSS
- `Branch.jsx` - Legacy single-record form (deprecated)

### Styling
- SAP B1 color scheme (gray background, yellow inputs)
- Grid-based layout with sticky headers
- Horizontal scrolling for wide grid
- Responsive design with scrollable content area

## Usage Example

```javascript
import BranchSetup from './modules/branch/BranchSetup';

function App() {
  return <BranchSetup />;
}
```

## Backend Routes

```javascript
// routes/branchRoutes.js
GET    /api/branches/search    - List all branches
POST   /api/branches/create    - Create new branch
GET    /api/branches/:bplid    - Get single branch
PATCH  /api/branches/:bplid    - Update branch
```

## Testing

Run the test script to verify API connectivity:

```bash
node backend/scripts/checkBusinessPlacesFields.js
```

## Common Use Cases

### Scenario 1: Initial Setup - Multiple Branches
1. Open Branches - Setup
2. Click "Add Row" for each branch location
3. Enter branch details (name, address, GST, etc.)
4. Mark one branch as "Main Branch"
5. Click "OK" to save all

### Scenario 2: Update Branch Information
1. Find the branch in the grid
2. Update required fields (address, GST, etc.)
3. Click "OK" to save

### Scenario 3: Disable Inactive Branch
1. Find the branch in the grid
2. Check the "Disabled" checkbox
3. Click "OK" to save

### Scenario 4: Set Main Branch
1. Find the branch in the grid
2. Check the "Main Branch" checkbox
3. Uncheck "Main Branch" for other branches if needed
4. Click "OK" to save

## Important Notes

- **Entity Name**: Always use `BusinessPlaces` for API calls, not "Branches"
- **Enum Format**: Checkboxes must map to `tYES`/`tNO` format
- **Main Branch**: Only one branch should be marked as main
- **BPLID**: Auto-assigned, cannot be edited
- **Changes**: Not saved until "OK" is clicked
- **Cancel**: Discards all unsaved changes
- **Grid**: Supports horizontal scrolling for all fields

## Error Handling

### Common Errors

#### "BPLName is required"
**Solution**: Ensure all rows have a branch name before saving

#### "Property 'XXX' is invalid"
**Solution**: Check field name matches SAP B1 Service Layer exactly

#### "Cannot update BPLID"
**Solution**: BPLID is read-only, remove from update payload

#### "Main branch already exists"
**Solution**: Only one branch can be marked as main

## Integration Points

### Business Partner Integration
- Branches can be linked to customers via `DefaultCustomerID`
- Branches can be linked to vendors via `DefaultVendorID`

### Warehouse Integration
- Each branch can have a default warehouse via `DefaultWarehouseID`
- Used for inventory transactions

### Document Integration
- Sales documents can be filtered by branch
- Purchase documents can be filtered by branch
- Financial reports can be generated per branch

## Field Validation

### VATRegNum (GST Number)
- India: 15 characters (e.g., 27AAAAA0000A1Z5)
- Format varies by country
- Should be validated based on company country

### TaxOfficeNo
- Country-specific format
- Used for tax reporting
- Should match government records

## Future Enhancements

- [ ] Search/filter functionality
- [ ] Bulk import from CSV
- [ ] Export to Excel
- [ ] Address lookup integration
- [ ] GST validation
- [ ] Warehouse lookup modal
- [ ] Customer/Vendor lookup modals
- [ ] Branch-wise reporting
- [ ] Branch hierarchy support
- [ ] Multi-currency support per branch

## Troubleshooting

### Issue: "BusinessPlaces not found"
**Solution**: Ensure you're using `BusinessPlaces` entity, not "Branches"

### Issue: Checkbox not saving correctly
**Solution**: Verify mapping to tYES/tNO format, not true/false

### Issue: Cannot create branch
**Solution**: Check BPLName is provided and session is valid

### Issue: Grid too wide
**Solution**: Use horizontal scroll or adjust column widths in CSS
