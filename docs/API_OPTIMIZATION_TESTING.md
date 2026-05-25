# API Optimization Testing Guide

## 🧪 Test Plan

Follow these steps to verify the API optimizations are working correctly.

### Prerequisites
- Development build running
- Access to terminal/console output
- Clean slate (optional but recommended)

---

## Test 1: Initial Load (First Time User Experience)

### Steps:
1. **Reset to clean state**:
   - Go to Settings → Developer Options → Clear All Data & Logout
   - Login again

2. **Monitor initial load**:
   - Watch the app load completely
   - Wait until all data is displayed

3. **Check API calls**:
   - Go to Settings → Developer Options → Show API Details
   - Look at the console output

### Expected Results:
```
📋 Detailed API Call Log
================================================================================
Total calls: ~10-12 (down from 27!)

Expected calls:
- 1× /summary
- 1× /user  
- 1× /assignments + 5-7 pagination pages
- 0-6× /subjects (batched by assignment IDs)

Cache hits: 0 (first time, nothing cached yet)
```

### ✅ Success Criteria:
- Total calls < 15 (vs 27 before)
- No duplicate /summary or /user calls
- Zero "🔄 Deduplicating concurrent..." messages

---

## Test 2: Immediate Reopen (Cache Hit Test)

### Steps:
1. **Close the app** (swipe away)
2. **Reopen immediately** (< 5 minutes)
3. **Let it load**
4. **Check API calls**: Settings → Developer Options → Show API Details

### Expected Results:
```
📋 Detailed API Call Log
================================================================================
Total calls: 0-3 🎉

Expected calls:
- 0× /summary (💾 memory cache hit)
- 0× /user (💾 memory cache hit)
- 0-1× /assignments (updated_after filter, likely no changes)
- 0× /subjects (already cached)

Cache hits: High percentage!

Console should show:
✅ "💾 getSummary: Serving from memory cache"
✅ "💾 getUserData: Serving from memory cache"
✅ "No assignments updated since [timestamp]"
```

### ✅ Success Criteria:
- Total calls ≤ 3 (vs 27 before) **90% reduction!**
- Cache hit rate > 80%
- App loads instantly with cached data
- Look for console messages: "Serving from memory cache"

---

## Test 3: Manual Pull-to-Refresh

### Steps:
1. **Pull down to refresh** on dashboard
2. **Wait for refresh to complete**
3. **Check API calls**: Settings → Developer Options → Show API Details

### Expected Results:
```
📋 Detailed API Call Log
================================================================================
Total calls: 3-7

Expected calls:
- 1× /summary (likely 304 Not Modified if < 1 hour)
- 1× /user (likely 304 Not Modified)
- 1× /assignments (updated_after filter)
- 0-4× /subjects (only if new assignments)

304 responses: 2-3 (Not Modified)

Console should show:
✅ "✅ getSummary: 304 Not Modified - using cached data"
✅ "✅ getUserData: 304 Not Modified - using cached data"
✅ "Using updated_after filter: [timestamp]"
```

### ✅ Success Criteria:
- Total calls ≤ 7 (vs 27 before) **75% reduction!**
- See 304 responses (conditional requests working!)
- updated_after filter being used
- Console shows "304 Not Modified" messages

---

## Test 4: Concurrent Requests (Deduplication Test)

### Steps:
1. **From terminal/console**, run multiple times quickly:
   ```javascript
   showApiDetails()
   clearApiDebug()
   ```

2. **Rapidly open app twice** within 1 second
3. **Check console for deduplication messages**

### Expected Results:
```
Console should show:
✅ "🔄 Deduplicating concurrent getSummary request"
✅ "🔄 Deduplicating concurrent getUserData request"
```

### ✅ Success Criteria:
- Deduplication messages appear
- Only 1 actual API call made despite multiple concurrent requests

---

## Test 5: Long-Term Cache (After 6 minutes)

### Steps:
1. **Wait 6 minutes** after opening app (summary cache expires at 5 min)
2. **Pull to refresh** or reopen app
3. **Check API calls**: Settings → Developer Options → Show API Details

### Expected Results:
```
Expected calls:
- 1× /summary (cache expired, but may still get 304 if data unchanged)
- 0× /user (cache still valid, 1 hour TTL)
- 1× /assignments (updated_after filter)

Console should show:
✅ "✅ getSummary: 304 Not Modified - using cached data" (if no changes)
✅ "💾 getUserData: Serving from memory cache" (still valid)
✅ "Using updated_after filter: [timestamp]"
```

### ✅ Success Criteria:
- Summary may make API call but likely gets 304
- User still served from cache
- Total calls ≤ 5

---

## 🔍 Debugging Commands

Use these during testing:

### Console Commands:
```javascript
// See summary of all API activity
showApiSummary()

// See detailed log with timestamps and payloads
showApiDetails()

// Clear tracking history (doesn't clear cache)
clearApiDebug()

// Clear in-memory cache (force fresh API calls)
clearApiCache()
```

### Settings Buttons:
- **Show API Summary** - Print stats to console
- **Show API Details** - Print detailed log to console
- **Clear API Debug History** - Reset tracking + clear cache

---

## 📊 What to Look For

### Good Signs ✅
- Console messages with 💾 (cache hits)
- Console messages with 🔄 (request deduplication)
- 304 responses in detailed log
- "Using updated_after filter" messages
- Cache hit percentage > 50%
- Total calls on reopen < 5

### Bad Signs ❌
- Cache hit percentage = 0%
- Multiple identical calls at same timestamp
- No 304 responses
- No "memory cache" messages
- Total calls still > 20

---

## 🐛 Troubleshooting

### If you still see 27 calls:

1. **Check if cache is working**:
   ```javascript
   // In console
   showApiDetails()
   ```
   - Look for "💾 Serving from memory cache" messages
   - If none, caching isn't working

2. **Check for duplicates**:
   - Look at timestamps in detailed log
   - Multiple calls at same second = duplicates
   - Look for endpoint counts in summary

3. **Clear everything and retry**:
   ```javascript
   clearApiCache()
   clearApiDebug()
   ```
   - Then pull to refresh
   - Check again

### If cache hits = 0%:

1. **Check console for errors**:
   - Look for AsyncStorage errors
   - Look for "Error saving to cache" messages

2. **Verify storage permissions**:
   - App may not have permission to write to storage

3. **Check if forceRefresh is always true**:
   - Search code for `forceRefresh: true`
   - Make sure it's not hardcoded everywhere

---

## 📈 Success Metrics

| Scenario | Before | Target | Improvement |
|----------|--------|--------|-------------|
| **Initial open** | 27 calls | 10-12 calls | 55-60% ↓ |
| **Reopen (< 5 min)** | 27 calls | 0-3 calls | **90% ↓** |
| **Manual refresh** | 27 calls | 3-7 calls | 75-90% ↓ |
| **Cache hit rate** | 0% | 50-80% | ∞ improvement |

---

## 🎯 Key Indicators

After running all tests, you should see:

1. **Request Deduplication Working**:
   - Console shows: "🔄 Deduplicating concurrent..."
   - Multiple components sharing same API response

2. **Memory Cache Working**:
   - Console shows: "💾 Serving from memory cache"
   - Instant responses on reopen

3. **Conditional Requests Working**:
   - API responses include 304 status
   - Console shows: "✅ 304 Not Modified"

4. **updated_after Filter Working**:
   - Console shows: "📊 Using updated_after filter"
   - Console shows: "No assignments updated since..."

5. **Overall Improvement**:
   - Summary shows: "Cache Hits: 15 / 18 (83%)"
   - Rate limit usage: < 10% on reopen (vs 45% before)

---

## 💾 Cache Behavior Reference

### Memory Cache Lifetimes:
- **Summary**: 5 minutes
- **User**: 1 hour
- **Assignments**: 5 minutes
- **Subjects**: 24 hours

### When Cache is Cleared:
- Manual pull-to-refresh
- Settings → Clear API Debug History button
- Console: `clearApiCache()`
- App restart (memory cache only)

### When Cache is Used:
- App reopen (within TTL)
- Background refresh
- Concurrent requests
- Conditional requests (304 responses)

---

## 📝 Reporting Results

After testing, note:
1. Initial open: X calls (target: < 15)
2. Reopen: X calls (target: < 3)
3. Manual refresh: X calls (target: < 7)
4. Cache hit rate: X% (target: > 50%)
5. Any duplicate endpoints still appearing
6. Any errors in console

Then share the results or detailed log from Settings → Show API Details!
