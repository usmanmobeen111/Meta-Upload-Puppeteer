# META UPLOAD PUPPETEER - POST WORKFLOW UPLOAD ISSUE

## Problem Summary
The video upload functionality in the POST workflow (for videos >= 90 seconds) is completely failing. Neither the file chooser dialog appears, nor are there any file input elements on the page to interact with.

## Current Behavior
1. Script successfully opens Meta Business Suite ✅
2. Script successfully clicks "Create Post" ✅  
3. Script successfully opens "Add video" dropdown ✅
4. Script attempts to click "Upload from desktop" ✅
5. **FAILURE**: After clicking "Upload from desktop":
   - The dropdown immediately closes
   - NO file chooser dialog appears
   - NO `<input type="file">` elements are found on the page
   - The page remains on the "Create post" screen with empty fields

## What We've Tried

###Attempt 1: File Chooser with Helper Function
```javascript
const fileChooserPromise = this.page.waitForFileChooser({ timeout: 15000 });
await clickUploadFromDesktop(this.page, this.config.maxRetries);
const fileChooser = await fileChooserPromise;
await fileChooser.accept([videoPath]);
```
**Result**: Timeout after 15 seconds - no file chooser appeared
**Problem**: `clickUploadFromDesktop` has a `randomDelay()` AFTER clicking, causing the dialog to close

### Attempt 2: File Chooser with Direct Click (No Delay)
```javascript
const fileChooserPromise = this.page.waitForFileChooser({ timeout: 15000 });

// Click directly without helper to avoid delay
const clicked = await this.page.evaluate(() => {
    const allElements = [...document.querySelectorAll('[role="button"], div, span, a')];
    const target = allElements.find(el => {
        const text = (el.innerText || '').trim().toLowerCase();
        return text.includes('upload from desktop') || text.includes('upload from computer');
    });
    if (target) {
        target.click();
        return true;
    }
    return false;
});

const fileChooser = await fileChooserPromise;
await fileChooser.accept([videoPath]);
```
**Result**: Timeout after 15 seconds - no file chooser appeared
**Problem**: Clicking the dropdown item does NOT trigger a file chooser

### Attempt 3: File Chooser + Fallback to File Input
```javascript
try {
    // Try file chooser...
} catch (uploadError) {
    // Fallback: search for file input elements
    const fileInputs = await this.page.$$('input[type="file"]');
    await fileInputs[fileInputs.length - 1].uploadFile(videoPath);
}
```
**Result**: Fallback also fails - "No file input elements found on page"
**Problem**: There are literally NO file input elements on the page after clicking

## Evidence from Debug Files

### Screenshot Evidence
**File**: `debug/errors/2026-02-13_12-21-49_Video_1_-_Copy__5__UPLOAD_FAILED_ERROR.png`
- Shows the "Create post" page
- "Add Video" dropdown is CLOSED
- No file chooser dialog visible
- Page is in the exact same state as before clicking "Upload from desktop"

### HTML Evidence
**File**: `debug/errors/2026-02-13_12-21-49_Video_1_-_Copy__5__UPLOAD_FAILED_ERROR.html`
- Searched for `input type="file"`: **0 results**
- The DOM has no file input elements at all
- Only visible elements are the regular UI (Post to, Media, Text, etc.)

## Key Question: HOW DOES THE UPLOAD ACTUALLY WORK?

The critical issue is: **What happens when a user manually clicks "Upload from desktop"?**

Possibilities:
1. Does it open a native file chooser dialog? (Our tests say NO)
2. Does it reveal a hidden file input? (HTML shows NO)
3. Does it use a different mechanism entirely?
4. Is there JavaScript preventing automation from triggering the upload?

## Working Comparison: REEL Workflow

The REEL workflow (for videos < 90 seconds) WORKS PERFECTLY:

```javascript
// Set up listener before clicking
const fileChooserPromise = this.page.waitForFileChooser({ timeout: 10000 });

// Click "Add Video" button (different from POST)
await clickButtonWithSVG(this.page, 'M21.382 4.026C21.154 2.79 20.056 2', 'Add Video');

// Wait for file chooser
const fileChooser = await fileChooserPromise;
await fileChooser.accept([videoPath]);
```

**This works because**: Clicking the "Add Video" button in the Reel workflow DOES trigger a file chooser dialog.

## System Information

- **Browser**: AdsPower (Puppeteer-controlled Chrome)
- **Target Site**: Meta Business Suite (business.facebook.com)
- **Automation**: Puppeteer
- **Node.js**: (insert version here)
- **OS**: Windows

## Logs

### Latest Upload Attempt Log
```
[12:21:33] [STEP] STEP POST 4: Uploading video file...
[12:21:33] [INFO] [UPLOAD] Setting up file chooser listener...
[12:21:33] [INFO] [UPLOAD] Clicking "Upload from desktop" button...
[12:21:34] [SUCCESS] [POST] ✅ Clicked upload option
[12:21:34] [INFO] [UPLOAD] Waiting for file chooser dialog...
[12:21:48] [ERROR] [UPLOAD] File chooser method failed: Waiting for `FileChooser` failed: 15000ms exceeded
[12:21:48] [INFO] [UPLOAD] Attempting fallback: Direct file input method...
[12:21:49] [ERROR] [UPLOAD] Fallback method also failed: No file input elements found on page
[12:21:49] [ERROR] ❌ Failed to upload: All upload methods failed
```

## Questions for Investigation

1. **What actually happens** when you manually click "Upload from desktop" in the POST workflow?
2. **Does Facebook/Meta detect and block** programmatic clicks on this specific button?
3. **Is there a different selector or method** used for posts vs reels?
4. **Does the dropdown close immediately** because  automation is being detected?
5. **Is there an API or different UI flow** for uploading videos to posts?

## Next Steps to Debug

1. **Manual Testing**: Have a human manually click through the POST workflow to observe what happens
2. **Network Tab Inspection**: Monitor network requests when clicking "Upload from desktop"
3. **DOM Mutation Observer**: Watch for DOM changes after clicking the button
4. **Alternative Selectors**: Try different ways to find and click the upload button
5. **Browser DevTools**: Manually inspect the dropdown and upload button elements

## Files Involved

- **Main Upload Logic**: `automation/uploader.js` (lines 341-412)
- **Helper Functions**: `automation/helpers.js` (lines 480-528)
- **Debug Screenshots**: `debug/errors/`
- **Debug HTML Snapshots**: `debug/errors/`

---

**Created**: 2026-02-13  
**Last Updated**: 2026-02-13  
**Status**: UNRESOLVED - Upload mechanism unknown
