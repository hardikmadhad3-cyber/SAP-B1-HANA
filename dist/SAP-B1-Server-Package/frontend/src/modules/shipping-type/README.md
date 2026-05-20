# Shipping Types - Setup

## Overview
The Shipping Types Setup page replicates SAP Business One's shipping types configuration screen. It provides a grid-based interface for managing shipping carriers and their tracking information.

## Features

### Grid-Based Interface
- **Multi-row editing**: Add, edit, and delete multiple shipping types in a single session
- **Inline editing**: Edit directly in the grid cells with SAP B1-style yellow input fields
- **Auto-numbering**: Code is automatically assigned by SAP B1 on creation
- **Batch operations**: Save all changes (new, modified, deleted) in one operation

### Field Structure

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| Code | Integer | Auto-assigned by SAP B1 | Auto |
| Name | String | Shipping type name (e.g., "FedEx", "DHL") | Yes |
| Web Site | String | Tracking URL for the carrier | No |

### Operations

#### Add New Shipping Type
1. Click "Add Row" button
2. Enter shipping type details in the new row
3. Click "OK" to save

#### Edit Existing Shipping Type
1. Modify any field in the grid
2. Changes are tracked automatically
3. Click "OK" to save all changes

#### Delete Shipping Type
1. Click the "×" button in the row
2. Confirm deletion in the dialog
3. Click "OK" to apply deletion

#### Cancel Changes
- Click "Cancel" to reload original data and discard all unsaved changes

## SAP B1 Integration

### Service Layer Endpoint
- **Entity**: `ShippingTypes`
- **Base URL**: `/ShippingTypes`

### API Operations

#### Create
```javascript
POST /ShippingTypes
{
  "Name": "FedEx Ground",
  "Website": "https://www.fedex.com/tracking"
}
```

#### Read
```javascript
GET /ShippingTypes(1)
GET /ShippingTypes?$select=Code,Name,Website,ShippingCompany&$top=50
```

#### Update
```javascript
PATCH /ShippingTypes(1)
{
  "Name": "FedEx Express",
  "Website": "https://www.fedex.com/tracking"
}
```

#### Delete
```javascript
DELETE /ShippingTypes(1)
```

## Field Mappings

SAP B1 ShippingTypes entity contains only three fields:
- **Code** (integer) - Primary key, auto-assigned
- **Name** (string) - Required, shipping type name
- **Website** (string) - Optional, tracking URL

## Validation Rules

1. **Name**: Required, cannot be empty
2. **Website**: Optional, should be valid URL format
3. **Code**: Read-only, assigned by SAP B1

## UI Components

### Files
- `ShippingTypeSetup.jsx` - Main setup component
- `styles/shippingTypeSetup.css` - SAP B1-style CSS
- `ShippingType.jsx` - Legacy single-record form (deprecated)

### Styling
- SAP B1 color scheme (gray background, yellow inputs)
- Grid-based layout with sticky headers
- Responsive design with scrollable content area

## Usage Example

```javascript
import ShippingTypeSetup from './modules/shipping-type/ShippingTypeSetup';

function App() {
  return <ShippingTypeSetup />;
}
```

## Backend Routes

```javascript
// routes/shippingTypeRoutes.js
GET    /api/shipping-types/search    - List all shipping types
POST   /api/shipping-types/create    - Create new shipping type
GET    /api/shipping-types/:code     - Get single shipping type
PATCH  /api/shipping-types/:code     - Update shipping type
DELETE /api/shipping-types/:code     - Delete shipping type
```

## Testing

Run the test script to verify API connectivity:

```bash
node backend/scripts/testShippingTypes.js
```

## Common Use Cases

### Scenario 1: Initial Setup
1. Open Shipping Types - Setup
2. Click "Add Row" for each carrier
3. Enter carrier details (FedEx, UPS, DHL, etc.)
4. Click "OK" to save all

### Scenario 2: Update Tracking URL
1. Find the carrier in the grid
2. Update the "Web Site" field
3. Click "OK" to save

### Scenario 3: Remove Unused Carrier
1. Find the carrier in the grid
2. Click the "×" button
3. Confirm deletion
4. Click "OK" to apply

## Notes

- Changes are not saved until "OK" is clicked
- "Cancel" discards all unsaved changes
- Deleted records are removed from SAP B1 on save
- Code field is auto-assigned and cannot be edited
- Grid supports keyboard navigation (Tab, Enter)

## Troubleshooting

### Issue: "Name is required" error
**Solution**: Ensure all rows have a name before saving

### Issue: Changes not saving
**Solution**: Check SAP B1 connection and session validity

### Issue: Cannot delete shipping type
**Solution**: Shipping type may be in use by documents. Check references first.

## Future Enhancements

- [ ] Search/filter functionality
- [ ] Bulk import from CSV
- [ ] Export to Excel
- [ ] Sorting by column
- [ ] Pagination for large datasets
- [ ] Duplicate detection
- [ ] Integration with document templates
