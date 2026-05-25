# WaniKani API Debugging Guide

This guide explains how to debug and analyze API calls to understand rate limiting issues and caching behavior.

## Features

The API debugger automatically tracks:
- Every API call made to WaniKani
- Whether each call hit cache or made a real HTTP request
- Rate limit information from response headers
- API call duration
- Errors and failures
- Calls grouped by endpoint

## Automatic Summaries

The app automatically prints API call summaries at key moments:

### 1. Dashboard Loading Complete
When the app finishes loading dashboard data, you'll see:
```
🔍 Dashboard Loading Complete - API Call Summary:
================================================================================
📊 WaniKani API Call Summary (Last 5 minutes)
================================================================================
Total Calls:    25
  - API Calls:  15 (count against rate limit)
  - Cache Hits: 10
  - Errors:     0

Rate Limit:
  45/60 remaining
  Resets in: 32s

Calls in last minute: 15 / 60 (25%)
Average duration: 234ms

--------------------------------------------------------------------------------
By Endpoint:
--------------------------------------------------------------------------------
/subjects:
  Total: 10 | API: 3 | Cache: 7 (70%) | Errors: 0
/assignments:
  Total: 5 | API: 4 | Cache: 1 (20%) | Errors: 0
...
================================================================================
```

### 2. Manual Refresh
When you pull-to-refresh on the homepage, the summary prints after completion.

### 3. Background Refresh
When cached data is used and a background refresh completes.

## Manual Commands

In development mode, you can use these console commands:

```javascript
// Show current API call summary
showApiSummary()

// Show detailed log with timestamps and full request payloads
showApiDetails()

// Clear all tracked API calls (reset the debugger)
clearApiDebug()
```

You can also trigger these from the Settings screen:
- Go to **Settings > Developer Options**
- Tap **Show API Summary** or **Show API Details**
- Results will be printed to the console/terminal

## Understanding the Output

### Summary Output (`showApiSummary()`)
Shows aggregated statistics:

### Total Calls
All API operations in the last 5 minutes, including cache hits.

### API Calls
**These count against your rate limit!** This is the number of actual HTTP requests made to WaniKani's API. The limit is 60 per minute.

### Cache Hits
These are requests served from local cache - they don't count against your rate limit.

### Rate Limit
Shows how many requests you have remaining in the current minute and when it resets.

### By Endpoint
Shows which endpoints are being called most frequently and their cache hit rate.

### Detailed Log Output (`showApiDetails()`)
Shows individual API calls with full details:

```
📋 Detailed API Call Log (Last 5 minutes)
================================================================================

1. 🌐 [API] 2:45:32 PM
   Endpoint: /assignments
   Params: {
     "immediately_available_for_review": true,
     "burned": false
   }
   Duration: 234ms
   HTTP Status: 200
   Rate Limit: 45/60 remaining
   Rate Reset: in 28s (2:46:00 PM)

2. 💾 [CACHE] 2:45:33 PM
   Endpoint: /subjects
   Params: {
     "ids": 150
   }
   Duration: 12ms

3. ❌ [ERROR] 2:45:35 PM
   Endpoint: /reviews
   Params: {}
   Duration: 523ms
   HTTP Status: 429
   Error: API error: 429
   
================================================================================
```

This shows:
- **Timestamp** - Exact time the call was made
- **Endpoint** - Which API endpoint was called
- **Params** - Full request parameters/payload
- **Duration** - How long the call took
- **Rate Limit Info** - Remaining calls and reset time
- **Errors** - Full error messages if the call failed

## Common Issues & Solutions

### 🔴 Hitting Rate Limit (60/min)

**Symptoms:**
- `Calls in last minute: 58 / 60 (97%)`
- HTTP 429 errors
- App becomes slow or unresponsive

**Causes:**
1. **Too many pagination calls**: Subjects/assignments might require multiple pages
2. **Cache not working**: API calls that should be cached are hitting the network
3. **Duplicate calls**: Same data being fetched multiple times

**Solutions:**

#### 1. Check Cache Hit Rate
Look at the "By Endpoint" section. Subjects should have a high cache hit rate (>80%):
```
/subjects:
  Total: 20 | API: 2 | Cache: 18 (90%) | Errors: 0  ✅ Good!
```

If it's low:
```
/subjects:
  Total: 20 | API: 18 | Cache: 2 (10%) | Errors: 0  ❌ Problem!
```

This means caching isn't working properly. Check:
- Are you clearing cache too frequently?
- Is `skipCollectionCache` being used unnecessarily?

#### 2. Reduce Pagination Calls
If you see many `[pagination page X]` entries:
```
[pagination page 2]:
  Total: 15 | API: 15 | Cache: 0 (0%) | Errors: 0
[pagination page 3]:
  Total: 15 | API: 15 | Cache: 0 (0%) | Errors: 0
```

Solutions:
- Use `getAllAssignmentsCached()` instead of `getAssignments()` + `fetchAllPages()`
- Increase the pagination delay in `fetchAllPages()` (currently 100ms)
- Fetch data less frequently

#### 3. Use Conditional Requests
The API supports `If-None-Match` (ETag) and `If-Modified-Since` headers that return HTTP 304 (Not Modified) when data hasn't changed. These still count against rate limits but are faster.

Look for 304 responses:
```
💾 [CACHE] /subjects - 45ms | Rate limit: 45/60
```

### 🟡 Slow Loading

**Symptoms:**
- `Average duration: 2000ms` (>1 second)
- Long wait times for dashboard to load

**Causes:**
1. **Network latency**: Slow internet connection
2. **Large responses**: Fetching too much data at once
3. **Sequential calls**: Not parallelizing requests

**Solutions:**

1. **Check API call durations**: Look at individual call logs:
```
🌐 [API] /subjects ({"ids":500}) - 3500ms  ❌ Too slow!
```

2. **Batch smaller requests**: Instead of fetching 1000 subjects at once, batch into chunks:
```typescript
// Current (slow)
await getSubjects(apiToken, { ids: [1...1000] })

// Better (faster)
for (let i = 0; i < ids.length; i += 100) {
  await getSubjects(apiToken, { ids: ids.slice(i, i + 100) })
}
```

3. **Use background refresh**: The app already uses SWR pattern to show cached data immediately while refreshing in the background.

### 🟢 Optimize Caching

**Best Practices from WaniKani API Docs:**

1. **Cache subjects aggressively**: They rarely change
   - Current implementation: ✅ Uses memory cache + collection cache
   - Cache TTL: 24 hours

2. **Use conditional requests**: 
   - Current implementation: ✅ Uses ETag and Last-Modified headers
   - Returns 304 when data hasn't changed

3. **Leverage `updated_after` filter**:
   - For incremental updates, use `updated_after` parameter
   - Example: `getAssignments(token, { updated_after: lastSync })`

## Rate Limit Headers

The WaniKani API returns these headers with every response:

```
RateLimit-Limit: 60        # Max requests per minute
RateLimit-Remaining: 45    # Requests remaining
RateLimit-Reset: 1702394456 # Unix timestamp when limit resets
```

These are automatically captured and displayed in the debugger output.

## Advanced Analysis

### Get All Calls Programmatically

```javascript
// In development console
const calls = apiDebugger.getAllCalls()

// Filter for errors
const errors = calls.filter(c => c.error)

// Calculate average duration by endpoint
const avgByEndpoint = calls.reduce((acc, call) => {
  if (!acc[call.endpoint]) acc[call.endpoint] = { total: 0, count: 0 }
  acc[call.endpoint].total += call.duration
  acc[call.endpoint].count++
  return acc
}, {})

Object.entries(avgByEndpoint).forEach(([endpoint, stats]) => {
  console.log(`${endpoint}: ${(stats.total / stats.count).toFixed(0)}ms avg`)
})
```

## Monitoring in Production

The debugger is only enabled in development mode (`__DEV__`). For production monitoring, consider:

1. **Error tracking**: Use Sentry or similar to track API errors
2. **Analytics**: Track API call counts and durations
3. **Rate limit warnings**: Alert when approaching limits

## Recommendations

Based on the current implementation:

✅ **Already doing well:**
- SWR pattern (serve cache, refresh background)
- Memory cache for subjects
- Conditional requests (ETag/Last-Modified)
- Pagination with delays

⚠️ **Could improve:**
- Monitor cache hit rates - should be >70% for subjects
- Consider using `updated_after` for incremental syncs
- Add retry logic with exponential backoff for rate limit errors
- Prefetch next level subjects when user is close to leveling up

## Need Help?

If you're seeing unexpected behavior:
1. Run `showApiSummary()` in the console
2. Look for patterns (many calls to same endpoint, low cache hit rates, etc.)
3. Check the "By Endpoint" section for hotspots
4. Review recent code changes that might affect caching
