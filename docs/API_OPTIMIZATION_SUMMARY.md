# WaniKani API Optimization Summary

## 🚨 Problems Identified

### Before Optimization
- **27 API calls** on app open (45% of rate limit!)
- **0% cache hit rate**
- **Duplicate calls**:
  - `/summary`: 7 calls (should be 1)
  - `/user`: 3 calls (should be 1)
- **No conditional requests** (ETag/If-Modified-Since)
- **No `updated_after` filter** for incremental updates

## ✅ Solutions Implemented

Following [WaniKani API Best Practices](https://docs.api.wanikani.com/20170710/#best-practices):

### 1. ✨ In-Memory Caching (Best Practice #1: Caching)

Added aggressive caching with appropriate TTLs:

| Endpoint | Cache TTL | Reason (per WaniKani docs) |
|----------|-----------|----------------------------|
| `/user` | 1 hour | "isn't updated a ton, but when it does, it's going to be pretty important" |
| `/summary` | 5 minutes | "changes every hour" - we cache 5 min for responsive UX |
| `/subjects` | 24 hours | "Cache subjects as aggressively as possible. They aren't very frequently updated" |
| `/assignments` | 5 minutes | "moderate levels of updates" |

### 2. 🔄 Request Deduplication

**Problem**: When app loads, multiple components call `getSummary()` simultaneously
- `useDashboardData` → calls `getSummary()`
- `reviewNotificationIntegration` → calls `getSummary()`
- `_layout.tsx` → calls `getUserData()`

**Solution**: Concurrent calls to the same endpoint share the same Promise
- First call: makes API request
- Concurrent calls: wait for and share the same result
- **Result**: 7 calls → 1 call, 3 calls → 1 call

### 3. 🏷️ Conditional Requests (Best Practice #2)

Implemented `If-None-Match` (ETag) and `If-Modified-Since` headers:

```typescript
// Before: Always fetch full data
fetch(url, { headers: { Authorization: ... } })

// After: Ask server "has anything changed?"
fetch(url, { 
  headers: { 
    Authorization: ...,
    'If-None-Match': etag,  // Use stored ETag
  } 
})

// Server responds:
// - 304 Not Modified → Use cached data, no payload transfer!
// - 200 OK → Data changed, here's the new data
```

**Result**: Fast responses when data hasn't changed (still counts as 1 API call, but minimal data transfer)

### 4. 📅 Updated After Filter (Best Practice #3)

Implemented `updated_after` parameter for collections:

```typescript
// Before: Fetch ALL assignments every time (1000s of items, 7+ pagination calls)
GET /assignments  → 7 API calls + huge payload

// After: Only fetch assignments changed since last load
GET /assignments?updated_after=2025-12-12T15:30:00.000Z  → 1 API call + tiny payload
```

**Result**: 
- First load: Still fetches all (unavoidable)
- Subsequent loads: Only fetches what changed (usually 0-10 items vs 1000s)

### 5. 🧹 Smart Cache Invalidation

- **Manual refresh**: Clears in-memory cache → forces fresh data
- **Auto-refresh**: Uses cached data when valid
- **Offline**: Falls back to stale cache if API unavailable

## 📊 Expected Results

### Initial App Open (First Time)
- **Before**: 27 calls
- **After**: ~10-12 calls (still need to fetch initial data)
  - 1× `/summary` (with cache)
  - 1× `/user` (with cache)
  - 1× `/assignments` + pagination
  - 6× `/subjects` batches (from assignments)
  
### Subsequent App Opens (< 5 min later)
- **Before**: 27 calls
- **After**: 0-3 calls 🎉
  - 0× `/summary` (memory cache hit)
  - 0× `/user` (memory cache hit)
  - 0-1× `/assignments` (updated_after filter, likely 0 changes)
  - 0× `/subjects` (already cached)

### Manual Refresh
- **Before**: 27 calls
- **After**: 3-5 calls
  - 1× `/summary` (force refresh, likely 304 response)
  - 1× `/user` (force refresh, likely 304 response)
  - 1× `/assignments` (updated_after, likely small response)
  - 0× `/subjects` (cached)

## 🔍 How to Verify

1. **Clear app data** (Settings → Developer Options → Clear All Data & Logout)
2. **Login** and let app load completely
3. **Go to Settings** → Developer Options → Show API Details
4. **Count the calls** - should see ~10-12 on first load

Then:

5. **Close and reopen** the app
6. **Check Settings** → Developer Options → Show API Details again
7. **Should see 0-3 calls!** Most from memory cache

Then:

8. **Pull to refresh** on dashboard
9. **Check Settings** → Developer Options → Show API Details
10. **Should see ~3-5 calls** with several 304 responses

## 🎯 Key Changes Made

### Files Modified

1. **`src/utils/api.ts`**:
   - Added in-memory cache with TTLs
   - Added request deduplication via `pendingRequests` Map
   - Updated `getUserData()` - now uses cache + ETag
   - Updated `getSummary()` - now uses cache + ETag
   - Created `getAssignmentsOptimized()` - uses `updated_after` filter
   - Added `clearInMemoryCache()` utility

2. **`src/utils/cache.ts`**:
   - Added `getDataUpdatedAt()` / `saveDataUpdatedAt()` functions
   - For tracking last collection fetch timestamp

3. **`src/hooks/useDashboardData.tsx`**:
   - Updated to use `getAssignmentsOptimized()` instead of manual pagination
   - Passes `forceRefresh` option to getSummary/getUserData
   - Clears in-memory cache on force refresh

4. **`app/(app)/(tabs)/index.tsx`**:
   - Clears in-memory cache on manual pull-to-refresh

5. **`src/utils/reviewNotificationIntegration.ts`**:
   - Removed verbose logging (will use cached data automatically)

## 📚 WaniKani Best Practices Compliance

✅ **Caching**: Aggressive caching with appropriate TTLs per endpoint  
✅ **Conditional Requests**: Using If-None-Match (ETag) headers  
✅ **updated_after Filter**: Incremental updates for collections  
✅ **Rate Limit Handling**: Deduplication prevents hitting limits

## 🐛 Debugging

Use these Settings buttons to verify improvements:

- **Show API Summary** - See aggregate stats (call counts, cache hits)
- **Show API Details** - See individual calls with timestamps
- **Clear API Debug History** - Reset tracking

Or use console commands:
```javascript
showApiSummary()  // Quick stats
showApiDetails()  // Detailed log with payloads
clearApiDebug()   // Reset history
```

## 💡 What Changed Under the Hood

### getUserData() Before:
```typescript
// EVERY call = API request
export async function getUserData(apiToken: string) {
  const response = await fetch(`${API_BASE_URL}/user`, { ... });
  return response.json();
}
```

### getUserData() After:
```typescript
export async function getUserData(apiToken: string, options?) {
  // 1. Deduplicate concurrent calls
  if (pendingRequests.has('user_data')) return pendingRequests.get('user_data');
  
  // 2. Check in-memory cache (valid for 1 hour)
  if (memCache && Date.now() - memCache.timestamp < 1_HOUR) {
    return memCache.data; // 💾 CACHE HIT!
  }
  
  // 3. Use conditional request
  const etag = await getETag(url);
  const response = await fetch(url, {
    headers: { 
      'If-None-Match': etag // Ask: "changed since last time?"
    }
  });
  
  // 4. Handle 304 response
  if (response.status === 304) {
    return memCache.data; // 🎉 NOT MODIFIED - use cache!
  }
  
  // 5. Cache new data
  const data = await response.json();
  inMemoryCache.set('user_data', { data, timestamp: Date.now() });
  return data;
}
```

## 🎊 Expected Impact

- **Rate limit issues**: Should be eliminated ✅
- **App responsiveness**: Much faster on subsequent opens ✅
- **Data freshness**: Still get updates via conditional requests ✅
- **Offline support**: Maintains functionality with cached data ✅

## 🔮 Next Steps

After testing, if you still see issues:

1. Check if any other files are calling API functions directly
2. Review the detailed log to identify remaining duplicates
3. Consider adding caching to other endpoints (review_statistics, level_progressions)

## 📖 References

- [WaniKani API Best Practices](https://docs.api.wanikani.com/20170710/#best-practices)
- [Conditional Requests](https://docs.api.wanikani.com/20170710/#conditional-requests)
- [updated_after Filter](https://docs.api.wanikani.com/20170710/#leveraging-the-updated_after-filter)
