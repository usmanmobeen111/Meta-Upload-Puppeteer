# Meta Upload Dashboard - PySide6 UI

A premium PySide6 dashboard application that controls the existing Node.js Puppeteer automation backend for uploading videos to Meta Business Suite.

## 🎯 Features

- ✅ **Auto-detect video duration** - Automatically route to POST (≥90s) or REEL (<90s) workflow
- ✅ **Premium dark theme UI** - Modern, CEO-level aesthetics with gradients and smooth animations
- ✅ **Batch upload** - Post all unposted videos with one click
- ✅ **Real-time progress tracking** - Live progress bar with step-by-step updates
- ✅ **Live log streaming** - Color-coded logs from Node.js backend
- ✅ **AdsPower integration** - Seamless browser automation
- ✅ **Status management** - Track which videos have been posted
- ✅ **Stop functionality** - Gracefully stop posting mid-process

## 🏗️ Architecture

```
Python (PySide6) ←→ Node.js (Puppeteer)
     UI Layer         Automation Engine
```

- **Python UI**: Controls the automation, displays logs, manages configuration
- **Node.js**: Executes Puppeteer workflows, outputs JSON logs
- **Communication**: Subprocess + JSON stdout/stdin

## 📁 Project Structure

```
Meta Upload Puppeteer/
├── python_ui/                      # Python PySide6 Application
│   ├── main.py                     # Entry point
│   ├── ui/
│   │   ├── main_window.py          # Main window with navigation
│   │   ├── settings_page.py        # Configuration page
│   │   ├── video_queue_page.py     # Video table and controls
│   │   ├── logs_page.py            # Live log viewer
│   │   └── progress_panel.py       # Progress display
│   ├── utils/
│   │   ├── config_manager.py       # Config save/load
│   │   ├── video_scanner.py        # Video duration detection
│   │   └── node_runner.py          # Subprocess runner & JSON parser
│   └── styles/
│       └── dark.qss                # Dark theme stylesheet
├── node_bridge/                    # Node.js Bridge Layer
│   ├── controller.js               # CLI entry point for Python
│   ├── json_logger.js              # Structured JSON logging
│   └── progress_reporter.js        # Progress mapping
├── automation/                      # Existing Puppeteer Logic
│   ├── uploader.js                 # Main uploader (UNCHANGED)
│   ├── helpers.js                  # Workflow helpers (UNCHANGED)
│   └── ...                         # Other automation files
└── config.json                     # Configuration file
```

## 🚀 Installation

### Prerequisites

1. **Node.js** (v14+)
2. **Python** (3.8+)
3. **FFmpeg/FFprobe** (for video duration detection)
4. **AdsPower** (browser automation platform)

### Install Python Dependencies

```powershell
cd "c:\Users\usman\Desktop\Meta Upload Puppeteer\python_ui"
pip install PySide6
```

### Install FFprobe (if not already installed)

Download FFmpeg from https://ffmpeg.org/download.html and add to PATH.

Verify installation:
```powershell
ffprobe -version
```

### Node.js Dependencies

Already installed in your project.

## ⚙️ Configuration

1. Launch the Python UI:
```powershell
cd "c:\Users\usman\Desktop\Meta Upload Puppeteer\python_ui"
python main.py
```

2. Navigate to **Settings** page

3. Configure:
   - AdsPower API Key
   - AdsPower Profile ID
   - Meta Page ID
   - Upload Folder Path
   - Debug Folder Path

4. Click **Save Configuration**

## 🎮 Usage

### 1. Scan Videos

1. Go to **Dashboard** page
2. Click **"Scan Folder"**
3. Videos will appear in the table with:
   - Duration (seconds + mm:ss format)
   - Type (REEL or POST)
   - Status (POSTED or UNPOSTED)

### 2. Post Single Video

1. Find the video in the table
2. Click **"Post Now"** button
3. Watch progress in the progress bar
4. Check logs in **Logs** page

### 3. Post All Unposted

1. Click **"Post All Unposted"** button
2. Confirm the action
3. All unposted videos will be posted sequentially
4. Monitor progress and logs

### 4. Stop Posting

1. Click **"Stop Current Posting"** button
2. Node.js process will terminate gracefully
3. AdsPower browser will close

### 5. View Logs

1. Navigate to **Logs** page
2. Watch live logs streaming from Node.js
3. Color-coded by level (INFO, SUCCESS, ERROR, WARN)
4. Click **"Save Logs to File"** to export

## 🎨 UI Preview

- **Dark Theme**: Professional gradient backgrounds
- **Sidebar Navigation**: Easy page switching
- **Progress Panel**: Live updates at the top
- **Video Queue Table**: Sortable, filterable video list
- **Action Buttons**: Post Now, Mark Posted, Open Folder
- **Real-time Logs**: Auto-scrolling with timestamps

## 🧠 How It Works

### Video Duration Detection

The system uses FFprobe to detect video duration:
- **< 90 seconds** → REEL workflow (Create Reel button)
- **≥ 90 seconds** → POST workflow (Create Post button)

### Python ↔ Node Communication

1. Python calls Node.js controller:
   ```powershell
   node controller.js post-single "C:\path\to\video\folder"
   ```

2. Node outputs JSON logs to stdout:
   ```json
   {"type":"log","level":"info","message":"Opening AdsPower..."}
   {"type":"progress","value":30,"step":"Opening Meta URL"}
   {"type":"success","message":"Posted successfully"}
   ```

3. Python parses JSON and updates UI in real-time

### Stop Mechanism

- Python sends `SIGTERM` to Node process
- Node catches signal and gracefully closes browser
- Status is saved before exit

## 🛠️ Troubleshooting

### FFprobe not found
- Download FFmpeg from https://ffmpeg.org/download.html
- Add to system PATH
- Restart terminal/Python UI

### PySide6 import error
```powershell
pip install --upgrade PySide6
```

### Node.js controller not found
- Ensure `node_bridge/controller.js` exists
- Check that Node.js is in PATH

### Videos not appearing
- Check upload folder path in Settings
- Ensure video files have valid extensions (.mp4, .mov, .avi, .mkv)
- Check folder structure (each video should be in its own subfolder)

## 🔧 Advanced

### Custom Progress Mapping

Edit `node_bridge/progress_reporter.js` to customize progress percentages for each workflow step.

### Custom Styling

Edit `python_ui/styles/dark.qss` to customize colors, fonts, and animations.

### Add New Commands

1. Add command in `node_bridge/controller.js`
2. Add button in Python UI to trigger it
3. Connect button to `node_runner.run_command()`

## 📝 License

© 2026 Meta Automation. All rights reserved.

---

**Built with ❤️ using PySide6 + Node.js + Puppeteer**
