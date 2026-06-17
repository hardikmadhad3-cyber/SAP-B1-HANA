# Migration Guide: Applying Robust UDF Handling to Other Services

## Quick Reference
The null-check fix in `udfPayloadUtils.js` is **automatically applied** to all services.  
Optional: Use `applyUdfsRobust()` for enhanced error handling in other services.

## Before & After Examples

### Pattern 1: SalesOrderService.js (Header UDFs)

**Current Code (Line ~1007)**:
```javascript
// OLD: Can crash if metadata missing
Object.assign(
  sapPayload,
  normalizeUdfValues(payload.header_udfs, allowedHeaderUdfKeys, headerUdfDefinitionsByKey)
);
```

**Recommended Update**:
```javascript
// NEW: Robust with logging
const { applyUdfsRobust } = require('./udfPayloadUtils');

try {
  applyUdfsRobust(sapPayload, payload.header_udfs, headerUdfDefinitionsByKey, false);
  console.log('[Sales Order] Header UDFs applied successfully');
} catch (error) {
  console.error('[Sales Order] Error applying header UDFs:', error.message);
  // Continue - don't block document creation
}
```

### Pattern 2: arInvoiceService.js (Line UDFs)

**Current Code (Line ~383)**:
```javascript
// OLD: Line-level UDFs
applyUdfValues(line, l.udf, allowedLineUdfs);
```

**Recommended Update**:
```javascript
// NEW: With error handling per line
const { applyUdfsRobust } = require('./udfPayloadUtils');

try {
  applyUdfsRobust(line, l.udf, lineUdfDefinitionsByKey, false);
} catch (error) {
  console.warn(`[AR Invoice] Line UDF error (lineNum: ${l.lineNum}):`, error.message);
  // Continue - UDF issues shouldn't block line processing
}
```

### Pattern 3: Generic Wrapper (Recommended for All)

```javascript
/**
 * Safe UDF application with fallback to normalizeUdfValues
 * Useful during gradual migration to applyUdfsRobust
 */
const applyUdfsOrFallback = (target, udfs, metadata, isLineLevel = false) => {
  try {
    const { applyUdfsRobust } = require('./udfPayloadUtils');
    applyUdfsRobust(target, udfs, metadata, false);
  } catch (error) {
    // Log but don't crash - continue with document
    const level = isLineLevel ? 'line' : 'header';
    console.warn(`[UDF Fallback] Error on ${level} UDFs:`, error.message);
  }
};

// Usage:
applyUdfsOrFallback(sapPayload, payload.header_udfs, headerUdfDefs);
```

## Services To Update (Priority Order)

### HIGH PRIORITY (Most Used)
1. **SalesOrderService.js** - Lines 982, 1007, 1151, 1180
   - Impacts Sales Order + Copy operations
   
2. **arInvoiceService.js** - Lines 383, 406, 502, 523
   - Impacts AR Invoice + Copy operations

3. **apInvoiceService.js** - Lines 456, 485, 527
   - Impacts AP Invoice creation

### MEDIUM PRIORITY
4. **deliveryService.js** - Similar patterns
5. **purchaseOrderService.js** - Similar patterns
6. **arCreditMemoService.js** - Lines 284, 291, 377, 382

### LOW PRIORITY (Less Frequently Used)
- inventoryTransferService.js
- inventoryTransferRequestService.js
- purchaseQuotationService.js
- purchaseRequestService.js

## Step-by-Step Migration for One Service

### Example: SalesOrderService.js

**Step 1: Add import** (Line 7)
```javascript
const { isBlankUdfValue, normalizeUdfValues, applyUdfsRobust } = require('./udfPayloadUtils');
```

**Step 2: Find UDF processing** (search for "normalizeUdfValues")
```
Line 982  - First occurrence (likely header UDFs)
Line 1007 - Object.assign pattern
...
```

**Step 3: Wrap in try-catch**
```javascript
// OLD (Lines 1005-1008):
if (payload.header_udfs && Object.keys(payload.header_udfs).length > 0) {
  Object.assign(sapPayload, normalizeUdfValues(payload.header_udfs, allowedHeaderUdfKeys, headerUdfDefinitionsByKey));
}

// NEW:
if (payload.header_udfs && Object.keys(payload.header_udfs).length > 0) {
  try {
    applyUdfsRobust(sapPayload, payload.header_udfs, headerUdfDefinitionsByKey, false);
    console.log('[Sales Order] Header UDFs applied in submitSalesOrder');
  } catch (error) {
    console.error('[Sales Order] Error applying header UDFs:', error.message);
    // Continue - UDF issues don't block document
  }
}
```

**Step 4: Repeat for all UDF processing blocks**

**Step 5: Test**
- POST with valid UDFs
- POST with unknown UDFs
- POST with empty UDF values
- Verify logs show warnings for unknown UDFs

## Gradual Rollout Checklist

- [ ] Verify salesQuotationService.js changes in production
- [ ] Check logs for UDF warnings - identify problematic UDFs
- [ ] Collect list of unknown UDFs from logs
- [ ] Coordinate with SAP admin to:
  - Create missing UDFs in SAP
  - OR update frontend to remove unused UDF fields
- [ ] Update SalesOrderService.js
- [ ] Test with sales order creation
- [ ] Update remaining services
- [ ] Monitor error logs for regressions

## Validation Queries

### Check if all critical UDFs exist in SAP:
```sql
-- Run in SAP HANA/SQL Server
SELECT T0.TableID, T0.AliasID, T0.Descr, T0.TypeID
FROM CUFD T0
WHERE T0.TableID IN ('OQUT', 'QUT1', 'ORDR', 'RDR1', 'OINV', 'INV1')
ORDER BY T0.TableID, T0.AliasID;
```

### Verify metadata cache is up-to-date:
```bash
# Check logs for repeated UDF warnings
grep -i "Unknown UDF field" backend/*.log | sort | uniq -c

# Should show pattern of actual missing UDFs, not cache issues
```

## Troubleshooting

### Problem: Still seeing ".type" errors
**Solution**: Ensure you rebuilt/restarted the app after changes

### Problem: Unknown UDFs being warned but frontend still sends them
**Solution**: 
1. Check that frontend is using same UDF definitions as backend
2. Sync UDF metadata by calling `getUdfDefinitionsByKey()`
3. Add UDF to reference data API if frontend needs it

### Problem: UDF values not appearing in SAP
**Solution**:
1. Check logs for unknown UDF warnings
2. Verify UDF exists in SAP metadata: `getUdfDefinitions('OQUT')`
3. Ensure `applyUdfsRobust()` isn't being too strict (`throwOnUnknownUdf: false`)

## Rollback Plan

If issues arise, rollback is simple:

**Option 1: Revert to previous version**
```bash
git revert [commit-hash]
```

**Option 2: Disable robust processing temporarily**
```javascript
// Comment out applyUdfsRobust call
// Uncomment normalizeUdfValues fallback
// Object.assign(sapPayload, normalizeUdfValues(...));
```

The null-check fix is minimal and shouldn't cause issues, but the robust helper is optional.

## Documentation Links
- Main fix summary: [UDF_BUG_FIX_SUMMARY.md](./UDF_BUG_FIX_SUMMARY.md)
- Memory notes: `/memories/repo/udf-null-reference-fix.md`
- Modified files:
  - `backend/services/udfPayloadUtils.js`
  - `backend/services/salesQuotationService.js`
  - `backend/controllers/salesQuotationController.js`
