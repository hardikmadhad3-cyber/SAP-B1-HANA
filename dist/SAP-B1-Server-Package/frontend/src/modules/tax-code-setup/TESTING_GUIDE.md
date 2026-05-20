# Tax Code Setup - Testing Guide

## Test Scenarios

### 1. Create Simple Tax Code

#### Test Case: Create GST @ 18%
**Steps:**
1. Open Tax Code Setup page
2. Enter Code: "GST18"
3. Enter Description: "GST @ 18%"
4. Enter Tax Rate: 18.00
5. Select Tax Type Combination: "GST"
6. Click "Add"

**Expected Result:**
- Success message displayed
- Form switches to Update mode
- Code field becomes read-only

---

### 2. Create Composite Tax Code

#### Test Case: Create GST with CGST and SGST Components
**Steps:**
1. Click "Cancel" to reset form
2. Enter Code: "GST12"
3. Enter Description: "GST @ 12% (CGST + SGST)"
4. Enter Tax Rate: 12.00
5. Select Tax Type Combination: "GST"
6. In grid, add first component:
   - Tax Type: sys_CGST
   - Code: "CGST6"
   - Description: "Central GST @ 6%"
   - Sales Tax Account: Select from lookup
   - Purchasing Tax Account: Select from lookup
7. Click "+ Add Row"
8. Add second component:
   - Tax Type: sys_SGST
   - Code: "SGST6"
   - Description: "State GST @ 6%"
   - Sales Tax Account: Select from lookup
   - Purchasing Tax Account: Select from lookup
9. Click "Add"

**Expected Result:**
- Tax code created with 2 components
- Both components saved correctly
- Success message displayed

---

### 3. Create Tax Code with Non-Deductible Component

#### Test Case: Create VAT with 50% Non-Deductible
**Steps:**
1. Click "Cancel" to reset form
2. Enter Code: "VAT50ND"
3. Enter Description: "VAT with 50% Non-Deductible"
4. Enter Tax Rate: 10.00
5. In grid, add component:
   - Tax Type: sys_VAT
   - Code: "VAT10"
   - Description: "VAT @ 10%"
   - Sales Tax Account: Select from lookup
   - Purchasing Tax Account: Select from lookup
   - Non-Deductible: 50.00
   - Non-Deductible Account: Select from lookup
6. Click "Add"

**Expected Result:**
- Tax code created with non-deductible component
- Non-deductible account saved
- Success message displayed

---

### 4. Find and Update Tax Code

#### Test Case: Update Existing Tax Code
**Steps:**
1. Click "Find" button
2. In lookup modal, search for "GST18"
3. Click on the row to select
4. Modify Description to "GST @ 18% (Updated)"
5. Modify Tax Rate to 18.50
6. Click "Update"

**Expected Result:**
- Tax code loaded successfully
- Code field is read-only
- Changes saved successfully
- Success message displayed

---

### 5. Validation Tests

#### Test Case 5.1: Required Field Validation
**Steps:**
1. Click "Cancel" to reset form
2. Leave Code empty
3. Enter Description: "Test"
4. Click "Add"

**Expected Result:**
- Error message: "Tax Code is required."
- Form not submitted

#### Test Case 5.2: Code Length Validation
**Steps:**
1. Enter Code: "VERYLONGCODE" (more than 8 chars)
2. Enter Description: "Test"
3. Click "Add"

**Expected Result:**
- Error message: "Tax Code cannot exceed 8 characters."
- Form not submitted

#### Test Case 5.3: Tax Rate Range Validation
**Steps:**
1. Enter Code: "TEST"
2. Enter Description: "Test"
3. Enter Tax Rate: 150.00 (exceeds 100)
4. Click "Add"

**Expected Result:**
- Error message: "Tax Rate must be between 0 and 100."
- Form not submitted

#### Test Case 5.4: Non-Deductible Without Account
**Steps:**
1. Enter Code: "TEST"
2. Enter Description: "Test"
3. In grid, add component:
   - Tax Type: sys_VAT
   - Non-Deductible: 50.00
   - Non-Deductible Account: (leave empty)
4. Click "Add"

**Expected Result:**
- Error message: "Line 1: Non-Deductible Account is required when Non-Deductible % is greater than 0."
- Form not submitted

---

### 6. Freight Tax Code

#### Test Case: Create Freight Tax Code
**Steps:**
1. Click "Cancel" to reset form
2. Enter Code: "FREIGHT"
3. Enter Description: "Freight Tax"
4. Enter Tax Rate: 5.00
5. Check "Freight" checkbox
6. Click "Add"

**Expected Result:**
- Freight tax code created
- Freight flag saved correctly
- Success message displayed

---

### 7. Inactive Tax Code

#### Test Case: Mark Tax Code as Inactive
**Steps:**
1. Click "Find" and select existing tax code
2. Check "Inactive" checkbox
3. Click "Update"

**Expected Result:**
- Tax code marked as inactive
- Inactive flag saved correctly
- Success message displayed

---

### 8. Grid Operations

#### Test Case 8.1: Add Multiple Rows
**Steps:**
1. Create new tax code
2. Click "+ Add Row" 5 times
3. Verify grid displays all rows

**Expected Result:**
- All rows displayed correctly
- Each row has unique row number
- All fields editable

#### Test Case 8.2: Delete Row
**Steps:**
1. Add 3 rows to grid
2. Fill in data for all rows
3. Click delete button (✕) on row 2
4. Verify row is removed

**Expected Result:**
- Row 2 deleted
- Remaining rows renumbered
- Data preserved in other rows

#### Test Case 8.3: Account Lookup
**Steps:**
1. Add row to grid
2. Click lookup button (🔍) for Sales Tax Account
3. Search for account
4. Select account from list

**Expected Result:**
- Lookup modal opens
- Search works correctly
- Selected account populated in field
- Account name stored

---

### 9. Tax Type Combination

#### Test Case: Test All Tax Type Combinations
**Steps:**
1. Create tax codes for each combination:
   - GST
   - CST
   - CSTCS
   - IGST
   - ITCS
   - Service
   - VAT
   - CENVAT+VAT
   - Define New

**Expected Result:**
- All combinations work correctly
- Dropdown displays all options
- Selected value saved correctly

---

### 10. Business Rule Warnings

#### Test Case 10.1: Zero Rate with Components
**Steps:**
1. Create tax code with Rate: 0.00
2. Add tax components
3. Click "Add"
4. Check browser console

**Expected Result:**
- Warning in console: "Tax Rate is 0 but tax components are defined..."
- Tax code still created (warning only)

#### Test Case 10.2: Duplicate Tax Types
**Steps:**
1. Create tax code
2. Add two components with same Tax Type (e.g., sys_CGST)
3. Click "Add"
4. Check browser console

**Expected Result:**
- Warning in console: "Duplicate tax types found: sys_CGST"
- Tax code still created (warning only)

---

## Integration Tests

### Test Case: End-to-End Workflow
**Steps:**
1. Create new tax code with all fields
2. Find the created tax code
3. Update the tax code
4. Verify changes persisted
5. Create another tax code with same code (should fail)

**Expected Result:**
- Complete workflow works smoothly
- All operations successful
- Duplicate code rejected

---

## Performance Tests

### Test Case: Large Grid
**Steps:**
1. Create tax code
2. Add 50 rows to grid
3. Fill in data for all rows
4. Save tax code

**Expected Result:**
- Grid handles large number of rows
- No performance degradation
- All rows saved correctly

---

## Browser Compatibility

Test on:
- Chrome (latest)
- Firefox (latest)
- Edge (latest)
- Safari (latest)

**Expected Result:**
- Consistent behavior across all browsers
- UI renders correctly
- All features work

---

## Accessibility Tests

### Test Case: Keyboard Navigation
**Steps:**
1. Use Tab key to navigate through form
2. Use Enter to submit
3. Use Escape to close modals

**Expected Result:**
- All fields accessible via keyboard
- Tab order logical
- Keyboard shortcuts work

---

## Error Handling Tests

### Test Case: Network Error
**Steps:**
1. Disconnect network
2. Try to create tax code
3. Verify error message

**Expected Result:**
- Appropriate error message displayed
- Form remains in editable state
- No data loss

### Test Case: Server Error
**Steps:**
1. Create tax code with invalid data (backend validation)
2. Verify error message from server

**Expected Result:**
- Server error message displayed
- Form remains in editable state
- User can correct and retry

---

## Data Integrity Tests

### Test Case: Special Characters
**Steps:**
1. Enter Code with special characters: "GST@18"
2. Enter Description with special characters: "GST & Cess"
3. Save tax code

**Expected Result:**
- Special characters handled correctly
- Data saved and retrieved correctly

### Test Case: Unicode Characters
**Steps:**
1. Enter Description with unicode: "GST टैक्स"
2. Save tax code

**Expected Result:**
- Unicode characters saved correctly
- Display correctly on retrieval

---

## Regression Tests

Run all test cases after any code changes to ensure:
- No existing functionality broken
- New features work correctly
- Performance not degraded
