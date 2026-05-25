---
description: Adding new custom fonts to the application
---

1. Download the font file (e.g., .ttf or .otf) to `assets/fonts/`.
   - You can use `curl` to download from a URL: `curl -L -o assets/fonts/FontName.ttf https://url.to/font.ttf`

2. Update `app/_layout.tsx` to include the new font in the `useFonts` hook:
   ```typescript
   const [fontsLoaded, fontError] = useFonts({
     // ... existing fonts
     'FontName': require('../assets/fonts/FontName.ttf'),
   });
   ```

3. Rebuild the app if necessary (usually Expo handles this with hot reloading, but sometimes a restart is needed for new assets).

4. Use the font in your styles:
   ```typescript
   style: {
     fontFamily: 'FontName',
   }
   ```
