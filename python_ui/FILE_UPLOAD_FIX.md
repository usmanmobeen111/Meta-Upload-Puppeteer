# POST Workflow Upload - Robust Implementation

## Overview
The POST workflow now uses the same robust upload mechanism as the Reel workflow, with primary file chooser method and fallback to direct file input.

## Upload Strategy

### Primary Method: File Chooser
1. Set up `waitForFileChooser()` listener BEFORE clicking button
2. Click "Upload from desktop" immediately (no delay)
3. Wait for file chooser dialog
4. Accept file upload

### Fallback Method: Direct File Input
If file chooser fails:
1. Search for `input[type="file"]` elements
2. Use the last file input (most recently added)
3. Upload directly via `uploadFile()`

## Implementation

```javascript
try {
    // Primary: File chooser method
    const fileChooserPromise = this.page.waitForFileChooser({ timeout: 15000 });
    
    // Click button without delay
    await this.page.evaluate(() => {
        const target = [...document.querySelectorAll('[role="button"], div, span, a')]
            .find(el => el.innerText.toLowerCase().includes('upload from desktop'));
        target.click();
    });
    
    const fileChooser = await fileChooserPromise;
    await fileChooser.accept([videoPath]);
    
} catch (uploadError) {
    // Fallback: Direct file input
    const fileInputs = await this.page.$$('input[type="file"]');
    await fileInputs[fileInputs.length - 1].uploadFile(videoPath);
}
```

## Key Points
- ✅ No delay after clicking to avoid missing file chooser
- ✅ Fallback ensures upload success even if dialog fails
- ✅ Comprehensive error messages for debugging
- ✅ Same pattern as working Reel workflow

---

**Status:** ✅ Implemented  
**Date:** 2026-02-13
