# API Debugging - Quick Reference

## Console Commands (Dev Mode)

```javascript
showApiSummary()  // Show API call statistics
showApiDetails()  // Show detailed log with timestamps & payloads
clearApiDebug()   // Clear call history
clearApiCache()   // Clear in-memory cache (force fresh data)
```

## Settings Buttons (Dev Mode)

In **Settings > Developer Options**:
- **Show API Summary** - Print statistics to console
- **Show API Details** - Print detailed log with timestamps and full payloads
- **Clear API Debug History** - Reset tracked calls

## What to Look For

### ✅ Healthy App
```
Calls in last minute: 15 / 60 (25%)
/subjects: Cache hit rate: 85%+
Average duration: <500ms
```

### ⚠️ Warning Signs
```
Calls in last minute: 50+ / 60     ← Approaching rate limit
/subjects: Cache hit rate: <50%    ← Cache not working
Average duration: >1000ms          ← Slow network/responses
```

### 🔴 Critical Issues
```
Calls in last minute: 58+ / 60     ← Will hit rate limit soon!
Rate limit: <5 remaining           ← Already limited
Errors: >0                         ← Failed requests
```

## Icon Legend

In console logs:
- 🌐 `[API]` - Real HTTP request (counts against limit)
- 💾 `[CACHE]` - Served from cache (doesn't count)
- ❌ `[ERROR]` - Request failed

## When Summaries Print

1. **App loads** - After dashboard data loads
2. **Manual refresh** - Pull to refresh on homepage  
3. **Background sync** - After cached data refreshes
4. **On demand** - Run `showApiSummary()` anytime

## Common Fixes

### Too many API calls?
- Check if cache hit rate is low
- Look for duplicate fetches
- Review pagination - each page is a separate call

### Rate limited (HTTP 429)?
- Wait for rate limit to reset (shown in summary)
- Reduce refresh frequency
- Ensure cache is working properly

### Slow loading?
- Check average duration
- Look for calls taking >2000ms
- Consider network connection quality

## Best Practices

1. **Subjects should be cached** - 80%+ cache hit rate
2. **Review statistics can be cached** - Updates infrequently  
3. **Assignments change often** - Lower cache hit rate is OK
4. **Summary endpoint** - Refresh frequently is OK (small response)

## Need More Details?

See [API_DEBUGGING.md](./API_DEBUGGING.md) for the complete guide.
