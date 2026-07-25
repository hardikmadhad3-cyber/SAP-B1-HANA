# Testing Tax Code API

## Quick Test Steps

1. **Check if backend is running**
   - Backend should be running on `http://localhost:5001`
   - Check terminal for any errors

2. **Test API endpoints directly**

Open browser console and run:

```javascript
// Test search tax codes
fetch('http://localhost:5001/api/tax-codes/search')
  .then(r => r.json())
  .then(data => console.log('Tax Codes:', data))
  .catch(err => console.error('Error:', err));

// Test lookup GL accounts
fetch('http://localhost:5001/api/tax-codes/lookup/gl-accounts')
  .then(r => r.json())
  .then(data => console.log('GL Accounts:', data))
  .catch(err => console.error('Error:', err));
```

3. **Check browser console for errors**
   - Open DevTools (F12)
   - Go to Console tab
   - Look for any red error messages
   - Check Network tab for failed requests

4. **Common Issues**

### Issue: "No results found"
**Possible causes:**
- Backend not running
- SAP Service Layer not connected
- No tax codes exist in SAP B1
- API endpoint mismatch

**Solutions:**
- Restart backend server: `cd SAP-B1/backend && npm start`
- Check SAP Service Layer connection in backend logs
- Verify .env file has correct SAP credentials
- Check if `/api/tax-codes/search` returns data

### Issue: Network error
**Possible causes:**
- Backend not running on port 5001
- CORS issues
- Firewall blocking requests

**Solutions:**
- Check backend is running: `netstat -ano | findstr :5001`
- Verify API_BASE_URL in frontend .env
- Check backend CORS configuration

### Issue: 401 Unauthorized
**Possible causes:**
- SAP Service Layer session expired
- Invalid SAP credentials

**Solutions:**
- Check backend .env file for SAP credentials
- Restart backend to create new session
- Verify SAP Service Layer is accessible

## Debug Mode

Add this to TaxCodeSetup.jsx temporarily:

```javascript
useEffect(() => {
  console.log('Testing API...');
  searchTaxCodes('').then(data => {
    console.log('Search results:', data);
  }).catch(err => {
    console.error('Search error:', err);
  });
}, []);
```

## Backend Logs

Check backend terminal for:
- `[SAP searchTaxCodes error]` - indicates API error
- `[SAP lookupGLAccounts error]` - indicates lookup error
- Session creation messages
- HTTP request logs
