# SAP B1 Tax Code Setup - Field Lock Logic

## Overview
This document explains the field locking behavior in SAP B1 Tax Code Setup and how it's implemented in our project.

## Field Lock Rules

### Header Section

#### 1. Code Field
- **Add Mode**: Editable
- **Update Mode**: Read-only (locked)
- **Reason**: Primary key cannot be changed after creation

#### 2. Description Field
- **Add Mode**: Editable
- **Update Mode**: Editable
- **Reason**: Description can be updated anytime

#### 3. Tax Rate Field
- **Add Mode**: Read-only (locked)
- **Update Mode**: Read-only (locked)
- **Reason**: Tax Rate is automatically calculated from the sum of component tax rates in the grid
- **Calculation**: Sum of all Rate values from VatGroups_Lines

#### 4. Inactive Checkbox
- **Add Mode**: Editable
- **Update Mode**: Editable
- **Reason**: Can be toggled anytime to activate/deactivate tax code

#### 5. Freight Checkbox
- **Add Mode**: Editable
- **Update Mode**: Read-only (locked)
- **Reason**: Freight designation cannot be changed after creation as it affects tax calculation logic

#### 6. Tax Type Combination Dropdown
- **Add Mode**: Editable
- **Update Mode**: Read-only (locked)
- **Reason**: Tax type combination defines the structure and cannot be changed after creation

### Grid Section (Tax Components)

#### Auto-Generated Fields
The following fields in the grid are auto-generated based on Tax Type selection:

1. **Code Field**
   - **Status**: Read-only (locked)
   - **Reason**: Auto-generated from Tax Type
   - **Logic**: 
     - sys_SGST → "SGST"
     - sys_CGST → "CGST"
     - sys_IGST → "IGST"
     - etc.

2. **Description Field**
   - **Status**: Read-only (locked)
   - **Reason**: Auto-generated from Tax Type
   - **Logic**:
     - sys_SGST → "State GST"
     - sys_CGST → "Central GST"
     - sys_IGST → "Integrated GST"
     - etc.

#### Editable Fields
The following fields remain editable:

1. **Tax Type Dropdown**
   - Always editable
   - Triggers auto-population of Code and Description

2. **Sales Tax Account**
   - Always editable
   - Can be selected via lookup or typed manually

3. **Purchasing Tax Account**
   - Always editable
   - Can be selected via lookup or typed manually

4. **Non-Deductible %**
   - Always editable
   - Numeric input (0-100)

5. **Non-Deductible Account**
   - Always editable
   - Required if Non-Deductible % > 0

## Implementation Details

### Tax Rate Calculation Logic

```javascript
// Automatic calculation when grid lines change
const calculateTotalTaxRate = (lines) => {
  if (!lines || lines.length === 0) return "0.00";
  
  const total = lines.reduce((sum, line) => {
    const rate = parseFloat(line.Rate) || 0;
    return sum + rate;
  }, 0);
  
  return total.toFixed(2);
};
```

### Field Lock Implementation

```javascript
// Tax Rate - Always locked
<input
  className="tc-field__input tc-field__input--readonly"
  name="Rate"
  value={form.Rate}
  readOnly
  title="Tax Rate is calculated automatically from tax components"
/>

// Freight - Locked in update mode
<input
  type="checkbox"
  name="Freight"
  checked={form.Freight}
  onChange={handleChange}
  disabled={mode === "update"}
/>

// Tax Type Combination - Locked in update mode
<select
  name="TaxTypeCombination"
  value={form.TaxTypeCombination}
  onChange={handleChange}
  disabled={mode === "update"}
>
```

### Grid Auto-Population Logic

```javascript
// When Tax Type changes, auto-populate Code and Description
const handleTaxTypeChange = (rowIndex, taxType) => {
  const taxTypeMap = {
    "sys_SGST": { code: "SGST", description: "State GST" },
    "sys_CGST": { code: "CGST", description: "Central GST" },
    "sys_IGST": { code: "IGST", description: "Integrated GST" },
    "sys_CESS": { code: "CESS", description: "Cess" },
    "sys_VAT": { code: "VAT", description: "VAT" },
    "sys_CST": { code: "CST", description: "CST" },
    "sys_Service": { code: "SERVICE", description: "Service Tax" },
    "sys_Excise": { code: "EXCISE", description: "Excise Duty" },
    "sys_Custom": { code: "CUSTOM", description: "Custom Duty" },
  };
  
  const mapping = taxTypeMap[taxType] || { code: "", description: "" };
  
  const newLines = [...displayRows];
  newLines[rowIndex] = {
    ...newLines[rowIndex],
    TaxType: taxType,
    Code: mapping.code,
    Description: mapping.description,
  };
  
  onChange(newLines);
};
```

## Business Logic Rationale

### Why Tax Rate is Locked?
In SAP B1, composite tax codes (like GST = CGST + SGST) require the total rate to be calculated from components. This ensures:
- Accuracy: No manual entry errors
- Consistency: Total always matches sum of components
- Compliance: Tax calculations follow legal requirements

### Why Freight is Locked After Creation?
Freight tax codes have special handling in transactions:
- Different calculation methods
- Different posting logic
- Cannot be mixed with regular tax codes
- Changing this would break existing transactions

### Why Tax Type Combination is Locked?
Tax type combination determines:
- Which tax types can be used
- Validation rules
- Reporting categories
- Cannot be changed without recreating the tax code

### Why Code and Description are Auto-Generated in Grid?
Standardization:
- Ensures consistent naming
- Prevents typos
- Simplifies reporting
- Maintains data integrity

## User Experience

### Visual Indicators
1. **Read-only fields**: Gray background (#e0e0e0)
2. **Disabled checkboxes**: Gray text color
3. **Disabled dropdowns**: Gray background
4. **Tooltips**: Explain why field is locked

### Error Prevention
1. Fields are locked at UI level
2. Backend validation ensures data integrity
3. Clear error messages if rules violated
4. Tooltips guide users

## Testing Scenarios

### Test 1: Tax Rate Lock
1. Create new tax code
2. Verify Tax Rate field is read-only
3. Add components with rates
4. Verify Tax Rate updates automatically

### Test 2: Freight Lock
1. Create tax code with Freight checked
2. Save and reload
3. Verify Freight checkbox is disabled
4. Verify cannot be unchecked

### Test 3: Tax Type Combination Lock
1. Create tax code with "GST" combination
2. Save and reload
3. Verify dropdown is disabled
4. Verify cannot be changed

### Test 4: Grid Auto-Population
1. Select Tax Type "sys_CGST"
2. Verify Code auto-fills to "CGST"
3. Verify Description auto-fills to "Central GST"
4. Verify fields are read-only

## Migration from Old Implementation

If you have existing tax codes with manually entered rates:
1. Rates will be preserved
2. New tax codes follow locked logic
3. Updates to existing codes follow locked logic
4. No data migration needed

## Future Enhancements

Potential improvements:
1. Visual calculation preview showing component breakdown
2. Warning if total rate doesn't match sum of components
3. Bulk update utility for tax accounts
4. Template-based tax code creation
5. Copy tax code with new code

## Compliance Notes

This locking logic ensures:
- Tax calculations are accurate
- Audit trail is maintained
- Regulatory compliance
- Data integrity
- Consistent reporting

## Support

If you need to:
- Change freight designation: Create new tax code
- Change tax type combination: Create new tax code
- Modify tax rate: Update component rates in grid
- Update accounts: Always editable
