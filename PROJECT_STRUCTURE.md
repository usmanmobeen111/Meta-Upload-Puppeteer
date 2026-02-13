# Meta Upload Dashboard - Project Structure

## 📁 Complete Folder Structure

```
c:\Users\usman\Desktop\Meta Upload Puppeteer\
│
├── python_ui\                          ⭐ NEW - PySide6 Dashboard
│   ├── main.py                         # Entry point
│   ├── start_dashboard.bat             # Windows launcher
│   ├── requirements.txt                # Python dependencies
│   ├── README.md                       # Documentation
│   │
│   ├── ui\
│   │   ├── __init__.py
│   │   ├── main_window.py              # Main window + sidebar
│   │   ├── settings_page.py            # Configuration page
│   │   ├── video_queue_page.py         # Video table + controls
│   │   ├── logs_page.py                # Live log viewer
│   │   └── progress_panel.py           # Progress bar component
│   │
│   ├── utils\
│   │   ├── __init__.py
│   │   ├── config_manager.py           # Config save/load
│   │   ├── video_scanner.py            # FFprobe duration detection
│   │   └── node_runner.py              # Subprocess + JSON parser
│   │
│   └── styles\
│       └── dark.qss                    # Premium dark theme
│
├── node_bridge\                        ⭐ NEW - Python ↔ Node Communication
│   ├── controller.js                   # CLI entry point
│   ├── json_logger.js                  # Structured logging
│   └── progress_reporter.js            # Progress mapping
│
├── automation\                         ✅ EXISTING - Unchanged
│   ├── uploader.js                     # Main uploader
│   ├── helpers.js                      # Workflow helpers
│   ├── captionHandler.js               # Caption logic
│   └── adsPowerClient.js               # AdsPower API
│
├── utils\                              ✅ EXISTING - Unchanged
│   ├── logger.js
│   ├── folderScanner.js
│   ├── statusMarker.js
│   ├── videoDuration.js
│   ├── randomDelay.js
│   └── debugCapture.js
│
├── config.json                         ✅ EXISTING - Modified by UI
├── package.json                        ✅ EXISTING
├── main.js                             ✅ EXISTING - Electron (not used)
└── README.md                           ✅ EXISTING
```

## 🎯 What Each Folder Does

### `python_ui/` (NEW)
The complete PySide6 dashboard application. Run `start_dashboard.bat` to launch.

### `node_bridge/` (NEW)
Bridge layer that allows Python to control Node.js automation. Python calls `controller.js` via subprocess.

### `automation/` (EXISTING)
Your existing Puppeteer automation logic. **NOT MODIFIED**. Controller calls uploader.js like before.

### `utils/` (EXISTING)
Your existing Node.js utilities. All work as before.

## 🔗 Communication Flow

```
┌─────────────────┐
│  Python UI      │
│  (PySide6)      │
└────────┬────────┘
         │
         │ subprocess
         ▼
┌─────────────────┐
│  controller.js  │  ← CLI entry point
└────────┬────────┘
         │
         │ imports
         ▼
┌─────────────────┐
│  uploader.js    │  ← Your existing logic
└────────┬────────┘
         │
         │ Puppeteer
         ▼
┌─────────────────┐
│  Meta Business  │
│     Suite       │
└─────────────────┘
```

## 🚀 Quick Start

### Option 1: Batch File (Recommended)
Double-click: `python_ui\start_dashboard.bat`

### Option 2: Command Line
```powershell
cd "c:\Users\usman\Desktop\Meta Upload Puppeteer\python_ui"
python main.py
```

## 📋 Files Summary

**Created:** 18 new files  
**Modified:** 0 existing files  
**Total lines of code:** ~1,500+

**Languages:**
- Python: ~800 lines
- JavaScript: ~400 lines
- QSS (Stylesheet): ~300 lines
