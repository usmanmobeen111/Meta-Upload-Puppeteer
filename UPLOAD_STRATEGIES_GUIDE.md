# Meta Upload Multi-Strategy System - Usage Guide

## Overview

This document explains how to use the new multi-strategy video upload system for Meta Business Suite POST workflow.

## What It Does

The system attempts **6 different upload strategies** in order until one succeeds:

1. **FileChooser API** - Standard file dialog with real mouse clicks
2. **DOM File Input** - Direct `<input type="file">` element upload
3. **IFrame Search** - Scan all iframes for file inputs
4. **Shadow DOM** - Recursive shadow DOM traversal
5. **Drag-and-Drop** - Simulate drag-drop events
6. **Emergency Injection** - Inject file input as last resort

## Key Features

✅ **Real Mouse Clicks** - Avoids automation detection  
✅ **Automatic Fallback** - Tries all strategies until one works  
✅ **Upload Confirmation** - Verifies upload started and completed  
✅ **Comprehensive Debugging** - Saves screenshots, HTML, frame info on failure  
✅ **Detailed Logging** - See exactly which strategy succeeded  

## How It Works

### Automatic Integration

The system is **automatically used** for videos >= 90 seconds:

```javascript
// Your existing code works as-is
const uploader = new MetaReelsUploader(config);
await uploader.uploadVideo(videoData);
```

The uploader detects video duration and routes to POST workflow, which now uses the multi-strategy system.

### Manual Usage

To call the function directly:

```javascript
const { uploadVideoInMetaPostWorkflow } = require('./automation/uploadStrategies');

// Must be on Create Post screen with "Add video" dropdown open
const success = await uploadVideoInMetaPostWorkflow(page, videoPath, config);
```

## Understanding the Logs

### Successful Upload

```
=================================================================
🎬 STARTING MULTI-STRATEGY VIDEO UPLOAD
Video: my_video.mp4
=================================================================

[UPLOAD] File size: 45.23 MB

------------------------------------------------------------
[UPLOAD] STRATEGY 1: FileChooser API (Normal)
------------------------------------------------------------
[UPLOAD] Setting up file chooser listener...
[UPLOAD] Finding "Upload from desktop" button...
[UPLOAD] Button found, clicking with real mouse...
[REAL_CLICK] Moving mouse to (450, 320)
[REAL_CLICK] ✅ Real mouse click executed
[UPLOAD] Waiting for file chooser dialog...
[UPLOAD] File chooser detected!
[UPLOAD] ✅ File accepted via FileChooser

=================================================================
🎯 VERIFYING UPLOAD...
=================================================================
[UPLOAD_CONFIRM] Confirming upload started...
[UPLOAD_CONFIRM] ✅ Upload confirmed started!
[UPLOAD_WAIT] Waiting for upload to complete (max 180s)...
[UPLOAD_WAIT] Progress: 25%
[UPLOAD_WAIT] Progress: 50%
[UPLOAD_WAIT] Progress: 75%
[UPLOAD_WAIT] Progress: 100%
[UPLOAD_WAIT] ✅ Upload complete! (45s)

=================================================================
✅ VIDEO UPLOAD COMPLETE!
=================================================================
```

### Failed Strategy (with fallback)

```
------------------------------------------------------------
[UPLOAD] STRATEGY 1: FileChooser API (Normal)
------------------------------------------------------------
[UPLOAD] Strategy 1 failed: Upload button not found

------------------------------------------------------------
[UPLOAD] STRATEGY 2: DOM File Input
------------------------------------------------------------
[UPLOAD] Found 2 file input(s) in DOM
[UPLOAD]   Input 1: id="none", name="file", accept="video/*", visible=false
[UPLOAD]   Input 2: id="none", name="video", accept="video/*", visible=false
[UPLOAD] Using file input #2
[UPLOAD] ✅ File uploaded via DOM input
```

## Debugging Failed Uploads

If all strategies fail, the system automatically saves debug information:

### Debug Files Location

```
debug/errors/
├── 2026-02-13_12-47-30_my_video_UPLOAD_FAILED.png     (screenshot)
├── 2026-02-13_12-47-30_my_video_UPLOAD_FAILED.html    (full HTML)
├── 2026-02-13_12-47-30_my_video_FRAME_0.html          (iframe 0)
├── 2026-02-13_12-47-30_my_video_FRAME_1.html          (iframe 1)
├── 2026-02-13_12-47-30_my_video_FRAME_URLS.txt        (frame URLs)
├── 2026-02-13_12-47-30_my_video_BUTTONS.json          (upload buttons)
└── 2026-02-13_12-47-30_my_video_ERROR.txt             (error details)
```

### How to Use Debug Files

1. **Screenshot** - See what the page looked like when upload failed
2. **HTML** - Search for file inputs, upload buttons, error messages
3. **Frame HTML** - Check if upload UI is in an iframe
4. **Frame URLs** - See which iframes were present
5. **Buttons JSON** - See all upload-related buttons found
6. **Error TXT** - Stack trace and error message

## Configuration

### Upload Timeout

Default is 300 seconds (5 minutes). To change:

```javascript
const config = {
    uploadTimeoutSeconds: 600  // 10 minutes
};
```

## Troubleshooting

### All Strategies Fail

**Symptoms:**
```
[UPLOAD] Strategy 1 failed: Upload button not found
[UPLOAD] Strategy 2 failed: No file input elements found on page
[UPLOAD] Strategy 3 failed: No iframes found
...
❌ VIDEO UPLOAD FAILED
Error: All upload strategies failed
```

**Solutions:**
1. Check debug screenshot to see current UI state
2. Verify you're on the correct page (Create Post screen)
3. Check if "Add video" dropdown is actually open
4. Meta may have changed their UI - inspect HTML for new selectors

### Upload Starts But Doesn't Complete

**Symptoms:**
```
[UPLOAD_CONFIRM] ✅ Upload confirmed started!
[UPLOAD_WAIT] Progress: 25%
[UPLOAD_WAIT] Still uploading... (60s elapsed)
[UPLOAD_WAIT] Still uploading... (120s elapsed)
Error: Upload did not complete within timeout
```

**Solutions:**
1. Increase `uploadTimeoutSeconds` in config
2. Check internet connection speed
3. Try with a smaller video file
4. Check network requests in browser DevTools

### Meta Detects Automation

**Symptoms:**
- CAPTCHA appears
- "Suspicious activity" warning
- Upload button doesn't respond

**Solutions:**
1. Use realistic AdsPower profile with human-like fingerprint
2. Add random delays between actions
3. The system already uses real mouse clicks (helps avoid detection)
4. Don't run automation too frequently

### Upload Completes But Post Doesn't Publish

This means the upload succeeded but the publish step failed. This is a separate issue from the upload system.

**Check:**
1. Caption field filled correctly?
2. Publish button clicked?
3. Any error messages on final screen?

## Advanced Usage

### Using Individual Helper Functions

```javascript
const {
    realMouseClick,
    scanIFramesForFileInputs,
    saveDebugDump,
    confirmUploadStarted
} = require('./automation/uploadStrategies');

// Click element safely
await realMouseClick(page, elementHandle);

// Scan iframes manually
const iframeInputs = await scanIFramesForFileInputs(page);

// Save debug info manually
await saveDebugDump(page, videoPath, error);

// Check if upload started
const started = await confirmUploadStarted(page, 10000);
```

### Strategy Order

The strategies run in this specific order:

1. **FileChooser** (most reliable, standard method)
2. **DOM Input** (fast, direct)
3. **IFrames** (handles iframe-based uploads)
4. **Shadow DOM** (for web components)
5. **Drag-Drop** (simulates user drag action)
6. **Emergency** (last resort, injects input)

You can modify the order by editing `uploadVideoInMetaPostWorkflow()` in `uploadStrategies.js`.

## Best Practices

✅ **DO** let the system try all strategies before giving up  
✅ **DO** check debug dumps to understand failures  
✅ **DO** use realistic browser profiles to avoid detection  
✅ **DO** verify video file exists before calling upload  

❌ **DON'T** disable strategies unless you know what you're doing  
❌ **DON'T** set timeout too low (uploads can take time)  
❌ **DON'T** modify the upload system without testing thoroughly  

## Support

If you encounter issues:

1. Check debug dumps in `debug/errors/`
2. Review logs for which strategies were attempted
3. Verify your AdsPower profile is working
4. Check Meta Business Suite for UI changes
5. Test with a small video file first

## Related Files

- `automation/uploadStrategies.js` - Main upload system
- `automation/uploader.js` - POST workflow integration
- `automation/helpers.js` - Shared helper functions
- `debug/errors/` - Debug dumps directory
