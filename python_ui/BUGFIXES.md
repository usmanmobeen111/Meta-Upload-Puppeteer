# Bug Fixes - February 13, 2026

## Issues Found During Testing

### 1. ❌ Import Error in controller.js

**Error Message:**
```
scanVideoFolders is not a function
```

**Root Cause:**
- `controller.js` was importing `scanVideoFolders` from `utils/folderScanner.js`
- But the actual export is named `scanFolders`

**Fix:**
Changed line 12 and line 110 in [controller.js](file:///c:/Users/usman/Desktop/Meta%20Upload%20Puppeteer/node_bridge/controller.js):

```javascript
// Before:
const { scanVideoFolders } = require('../utils/folderScanner');
const videoFolders = scanVideoFolders(uploadFolder);

// After:
const { scanFolders } = require('../utils/folderScanner');
const videoFolders = scanFolders(uploadFolder);
```

---

### 2. ❌ Encoding Error in node_runner.py

**Error Message:**
```
'charmap' codec can't decode byte 0x8f in position 41: character maps to <undefined>
```

**Root Cause:**
- Node.js existing logger outputs ANSI color codes (e.g., `\x1b[36m` for cyan, `\x1b[32m` for green)
- Python's subprocess was trying to decode these as text with default Windows encoding (charmap)
- ANSI escape sequences are not valid in charmap encoding

**Fix:**
Updated [node_runner.py](file:///c:/Users/usman/Desktop/Meta%20Upload%20Puppeteer/python_ui/utils/node_runner.py) to:

1. **Use binary mode** instead of text mode
2. **Decode with UTF-8** and `errors='replace'` to handle invalid bytes
3. **Strip ANSI color codes** using regex before displaying

```python
# Before:
self.process = subprocess.Popen(
    cmd,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True,  # ❌ Fails on ANSI codes
    universal_newlines=True
)

for line in iter(self.process.stdout.readline, ''):
    data = json.loads(line)  # ❌ Decoding error

# After:
self.process = subprocess.Popen(
    cmd,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    universal_newlines=False,  # ✅ Binary mode
)

for line in iter(self.process.stdout.readline, b''):
    # ✅ Decode with error handling
    line_str = line.decode('utf-8', errors='replace').strip()
    
    # ✅ Strip ANSI codes
    clean_line = re.sub(r'\x1b\[[0-9;]*m', '', line_str)
    data = json.loads(clean_line)
```

---

## Testing Status

### ✅ Fixed Issues

1. **Import error** - `scanFolders` now imports correctly
2. **Encoding error** - ANSI codes are now stripped and handled gracefully

### 🧪 Ready for Re-testing

The dashboard should now work correctly. Please retry:

1. **Post All** - Should scan folders without import error
2. **Post Single** - Should parse logs without encoding error
3. **View Logs** - Should display clean logs without ANSI codes

---

## What Changed

**Files Modified (3):**
1. `node_bridge/controller.js` - Fixed import and function call
2. `python_ui/utils/node_runner.py` - Fixed encoding handling

**Impact:**
- ✅ No changes to existing automation logic
- ✅ No breaking changes to UI
- ✅ Handles both JSON logs (from json_logger.js) and legacy logs (from old logger with ANSI codes)

---

## How It Works Now

```
Node.js Output:
  ├─ JSON messages (from json_logger.js) → Parsed as JSON
  └─ Legacy logs with ANSI codes → ANSI stripped → Displayed as text

Python Subprocess:
  ├─ Binary mode (avoids charmap encoding)
  ├─ UTF-8 decode with errors='replace'
  └─ Regex strip ANSI codes: \x1b[36m, \x1b[32m, etc.
```

---

**Status:** ✅ **FIXED - Ready for Testing**

Please restart the dashboard and try again!
