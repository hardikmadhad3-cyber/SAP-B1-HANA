# Tax Code Setup - Visual Guide

## Page Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Tax Codes - Setup                          [Add] [Cancel] [Find]       │
├─────────────────────────────────────────────────────────────────────────┤
│  ✓ Success: Tax Code "GST18" created successfully.                      │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Code*      [GST18___]   Description* [GST 18%______________]   │   │
│  │                                                                  │   │
│  │  Tax Rate   [  18.00 ]                              ☐ Inactive  │   │
│  │                                                                  │   │
│  │  ☐ Freight              Tax Type [Tax Type Combination ▼]      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Tax Components Grid                                             │   │
│  │ ┌───┬────────┬──────────┬────────┬─────────┬──────────┬───────┐│   │
│  │ │ # │Type ABS│Tax Type  │  Code  │  Desc   │Sales Tax │Purch. ││   │
│  │ ├───┼────────┼──────────┼────────┼─────────┼──────────┼───────┤│   │
│  │ │ 1 │        │   ▼      │[___]🔍 │         │[___]🔍   │[___]🔍││   │
│  │ │ 2 │        │   ▼      │[___]🔍 │         │[___]🔍   │[___]🔍││   │
│  │ │ 3 │        │   ▼      │[___]🔍 │         │[___]🔍   │[___]🔍││   │
│  │ │ 4 │        │   ▼      │[___]🔍 │         │[___]🔍   │[___]🔍││   │
│  │ │ 5 │        │   ▼      │[___]🔍 │         │[___]🔍   │[___]🔍││   │
│  │ └───┴────────┴──────────┴────────┴─────────┴──────────┴───────┘│   │
│  │ [+ Add Row]                                                     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Color Scheme (SAP B1 Style)

### Backgrounds
- Page background: `#f0f2f5` (light gray)
- Toolbar: `#e8edf2` (blue-gray)
- Card/Panel: `#ffffff` (white)
- Grid header: `#d0d0d0` (medium gray)

### Input Fields
- Editable fields: `#ffffcc` (SAP B1 yellow)
- Readonly fields: `#e0e0e0` (light gray)
- Focus border: `#0070c0` (blue)

### Buttons
- Primary button: `#0070c0` gradient (blue)
- Secondary button: `#ffffff` gradient (white)
- Button border: `#a0aab4` (gray)

### Grid
- Cell background: `#ffffff` (white)
- Cell border: `#ccc` (light gray)
- Row hover: `#e8f0fe` (light blue)

### Alerts
- Success: `#e6f4ea` background, `#1a7a30` text
- Error: `#fde8e8` background, `#c00` text

## Component Hierarchy

```
TaxCodeSetup (Main Component)
├── Toolbar
│   ├── Title
│   ├── Add/Update Button
│   ├── Cancel Button
│   └── Find Button
├── Alert (conditional)
├── Header Section
│   ├── Row 1
│   │   ├── Code Input
│   │   ├── Description Input
│   │   ├── Tax Rate Input (readonly)
│   │   └── Inactive Checkbox
│   └── Row 2
│       ├── Freight Checkbox
│       └── Tax Type Dropdown
├── TaxComponentsGrid
│   ├── Grid Table
│   │   ├── Header Row
│   │   └── Data Rows (min 5)
│   │       ├── Row Number
│   │       ├── Type ABS ID Input
│   │       ├── Tax Type Dropdown
│   │       ├── Code Input + Lookup Button
│   │       ├── Description Input (readonly)
│   │       ├── Sales Tax Account Input + Lookup Button
│   │       ├── Purchase Tax Account Input + Lookup Button
│   │       └── Delete Button
│   ├── Add Row Button
│   └── Lookup Modals (conditional)
│       ├── VAT Groups Lookup
│       ├── Sales Tax Account Lookup
│       └── Purchase Tax Account Lookup
└── Find Modal (conditional)
    └── LookupModal Component
```

## User Interactions

### 1. Creating a New Tax Code
```
User Action                    → System Response
─────────────────────────────────────────────────────────
Click "Cancel"                 → Reset form to empty state
Enter Code (e.g., "GST18")     → Enable input, validate max 8 chars
Enter Description              → Enable input, validate max 100 chars
Select Tax Type                → Update dropdown value
Check/Uncheck Inactive         → Toggle tYES/tNO
Check/Uncheck Freight          → Toggle tYES/tNO
Click 🔍 in grid Code cell     → Open VAT Groups lookup modal
Select VAT Group               → Fill Code, Description, Rate
Click 🔍 in Sales Tax Account  → Open Chart of Accounts lookup
Select Account                 → Fill account code
Click "Add"                    → Validate → POST to API → Show success
```

### 2. Finding an Existing Tax Code
```
User Action                    → System Response
─────────────────────────────────────────────────────────
Click "Find"                   → Open Find modal
Enter search query             → Filter results
Click on result row            → Load tax code data
                               → Populate header fields
                               → Populate grid rows
                               → Switch to Update mode
```

### 3. Updating a Tax Code
```
User Action                    → System Response
─────────────────────────────────────────────────────────
Modify Description             → Enable Update button
Add/Delete grid rows           → Update VatGroups_Lines array
Modify grid cells              → Update line data
Click "Update"                 → Validate → PATCH to API → Show success
```

## Grid Interactions

### Adding Rows
- Click "+ Add Row" button
- New empty row appears at bottom
- Focus moves to first cell of new row

### Deleting Rows
- Click ✕ button in Actions column
- Row is removed immediately
- Remaining rows renumber automatically

### Lookup Interactions
- Click 🔍 button next to input field
- Modal opens with search functionality
- Type to search, press Enter or click Search
- Click on result row to select
- Modal closes, selected value fills input
- Related fields auto-populate (e.g., Description from Code)

## Validation Messages

### Error Messages
```
❌ "Tax Code is required."
❌ "Tax Code cannot exceed 8 characters."
❌ "Description is required."
❌ "Description cannot exceed 100 characters."
❌ "At least one Tax Type row is required."
❌ "Tax Code already exists. Please enter a different code."
```

### Success Messages
```
✓ "Tax Code 'GST18' created successfully."
✓ "Tax Code 'GST18' updated successfully."
✓ "Tax Code 'GST18' loaded."
```

## Keyboard Navigation

- **Tab**: Move to next field
- **Shift+Tab**: Move to previous field
- **Enter**: Submit form/search
- **Escape**: Close modal
- **Arrow Keys**: Navigate grid cells (future enhancement)

## Responsive Behavior

- Grid scrolls horizontally on smaller screens
- Minimum width maintained for usability
- Modal adapts to screen size (max 95vw)
- Buttons stack on very small screens (future enhancement)

## Accessibility Features

- Proper label associations
- Focus indicators on all interactive elements
- Keyboard navigation support
- ARIA labels for icon buttons
- Semantic HTML structure
- Color contrast compliance
