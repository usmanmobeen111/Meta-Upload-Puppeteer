# Meta Reels Automation

> **Automated Meta Reels uploader using AdsPower browser profiles, Puppeteer automation, and Electron GUI**

![Status](https://img.shields.io/badge/status-ready-brightgreen)
![Platform](https://img.shields.io/badge/platform-windows-blue)
![Node](https://img.shields.io/badge/node-%3E%3D16.0.0-green)

## 📋 Overview

This application automates the process of uploading Facebook/Meta Reels to Meta Business Suite using AdsPower browser profiles. It features a comprehensive Electron-based GUI for managing video folders, posting individual or bulk videos, and includes extensive debug capabilities.

## ✨ Features

- ✅ **Electron GUI** - User-friendly interface for managing videos
- ✅ **AdsPower Integration** - Uses AdsPower profiles for browser automation
- ✅ **Automated Workflow** - Complete 10-step posting automation
- ✅ **Bulk Posting** - Upload multiple videos sequentially
- ✅ **Debug Mode** - Captures screenshots, DOM snapshots, and text dumps at every step
- ✅ **Error Handling** - Automatic retries, error logging, and evidence capture
- ✅ **Posted Status Tracking** - Automatically marks folders as posted
- ✅ **Random Delays** - Human-like delays between actions (1.00-9.99 seconds)

## 🔧 Prerequisites

Before you begin, ensure you have the following installed:

1. **Node.js** (v16.0.0 or higher)
   - Download from [nodejs.org](https://nodejs.org/)

2. **AdsPower** desktop application
   - Download from [adspower.com](https://www.adspower.com/)
   - Must be running on your system
   - API should be accessible at `http://127.0.0.1:50325` (default)

3. **AdsPower API Key and Profile ID**
   - You'll need these to configure the application

## 📥 Installation

1. **Clone or download** this repository

2. **Navigate to the project folder**
   ```bash
   cd "Meta Upload Puppeteer"
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

## ⚙️ Configuration

### Initial Setup

1. **Open** `config.json` in a text editor

2. **Configure AdsPower settings:**
   ```json
   {
     "adspowerApiKey": "YOUR_API_KEY_HERE",
     "adspowerProfileId": "YOUR_PROFILE_ID_HERE",
     "metaBusinessUrl": "https://business.facebook.com/latest/reels_composer",
     "headless": false,
     "debugMode": true,
     "maxRetries": 3,
     "uploadTimeoutSeconds": 300
   }
   ```

3. **Replace placeholders:**
   - `YOUR_API_KEY_HERE` - Your AdsPower API key
   - `YOUR_PROFILE_ID_HERE` - Your AdsPower profile ID

### Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `adspowerApiKey` | Your AdsPower API key | Required |
| `adspowerProfileId` | AdsPower profile ID to use | Required |
| `metaBusinessUrl` | Meta Business Suite Reels composer URL | `https://business.facebook.com/latest/reels_composer` |
| `headless` | Run browser in headless mode | `false` |
| `debugMode` | Enable debug screenshots & DOM capture | `true` |
| `maxRetries` | Number of retries for failed clicks | `3` |
| `uploadTimeoutSeconds` | Max time to wait for video upload | `300` |

## 📁 Folder Structure Requirements

Your videos must be organized in the following structure:

```
RootFolder/
  ├── Video1/
  │   ├── reel.mp4           # Video file (any name, any extension)
  │   ├── caption.txt        # Caption text
  │   └── posted/
  │       └── status.json    # Posted status (created automatically)
  │
  ├── Video2/
  │   ├── my_video.mov       # Video file
  │   ├── caption.txt
  │   └── posted/
  │       └── status.json
  │
  └── Video3/
      ├── video.webm
      └── caption.txt
```

### Requirements:

- **One video file** per folder (`.mp4`, `.mov`, `.mkv`, `.webm`, `.avi`)
- **One `caption.txt`** file containing the caption
- **`posted/` subfolder** is created automatically after successful post
- **`status.json`** tracks posted status

### Example `caption.txt`:

```
Check out this amazing content! 🔥

#viral #reels #meta #trending
```

## 🚀 Usage

### Starting the Application

```bash
npm start
```

This will launch the Electron GUI.

### Step-by-Step Workflow

1. **Configure Settings**
   - Enter your AdsPower API Key and Profile ID in the GUI
   - Enable/disable Debug Mode
   - Click "Save Config"

2. **Select Root Folder**
   - Click "Select Root Folder"
   - Choose the folder containing your video subfolders
   - The app will automatically scan for videos

3. **Review Videos**
   - Check the video table showing all detected videos
   - Review folder names, video files, and caption previews
   - Posted status is shown for each folder

4. **Post Videos**
   - **Single Video**: Click "Post" button next to a video
   - **Bulk Upload**: Click "Post All Unposted" to post all unposted videos
   - **Stop**: Click "Stop Current Process" to interrupt

5. **Monitor Progress**
   - Watch the status panel for current action
   - View real-time logs in the console
   - Check random delay values being used

## 🔍 Debug Mode

When `debugMode: true` in config, the app captures extensive debug information:

### Captured Data

- **Screenshots** (PNG) - Full page screenshots at each step
- **HTML Snapshots** - Complete DOM HTML at each step
- **Visible Text** (TXT) - Extracted page text for quick searching
- **Error Evidence** - Screenshots, HTML, and logs when errors occur

### Debug Folders

```
debug/
  ├── screenshots/       # Step-by-step screenshots
  ├── html/              # DOM snapshots
  ├── text/              # Visible text dumps
  └── errors/            # Error evidence
```

### File Naming Convention

```
2026-02-05_11-22-14_Video1_STEP_2_CLICK_CREATE_REEL.png
│               │        │       │
│               │        │       └─ Step name
│               │        └─────────── Folder name
│               └──────────────────── Timestamp
```

### Debug Steps

1. `STEP_1_OPEN_BUSINESS_SUITE` - Navigate to Meta Business Suite
2. `STEP_2_CLICK_CREATE_REEL` - Click "Create Reel" button
3. `STEP_3_CLICK_ADD_VIDEO` - Click "Add Video" button
4. `STEP_4_UPLOAD_VIDEO` - Upload video file
5. `STEP_5_WAIT_UPLOAD` - Wait for upload completion
6. `STEP_6_PASTE_CAPTION` - Paste caption
7. `STEP_7_CLICK_NEXT_1` - Click first "Next" button
8. `STEP_8_CLICK_NEXT_2` - Click second "Next" button
9. `STEP_9_CLICK_SHARE` - Click "Share" button
10. `STEP_10_CONFIRM_POSTED` - Confirm posting success

## 📊 Logs

Application logs are saved to:

```
logs/
  └── app_YYYY-MM-DD_HH-MM-SS.log
```

Logs include:
- Timestamps
- Log levels (INFO, WARN, ERROR, SUCCESS)
- Detailed action descriptions
- Error messages and stack traces

## ⚠️ Troubleshooting

### Common Issues

#### 1. "Failed to start AdsPower profile"

**Solution:**
- Ensure AdsPower desktop app is running
- Check API key and profile ID are correct
- Verify AdsPower API is accessible at `http://127.0.0.1:50325`

#### 2. "Button not found: Create Reel"

**Solution:**
- Enable Debug Mode to capture screenshots
- Check the Meta Business Suite URL is correct
- Meta may have updated their UI - review debug screenshots
- Make sure you're logged in to the correct Facebook/Meta account in AdsPower profile

#### 3. "Upload did not complete within timeout"

**Solution:**
- Increase `uploadTimeoutSeconds` in config
- Check internet connection speed
- Try a smaller video file for testing

#### 4. "File input not found"

**Solution:**
- Enable Debug Mode
- Review screenshots to see the page state
- Meta may have changed their upload flow

### Debug Mode Recommendations

Always enable Debug Mode (`debugMode: true`) when:
- Testing for the first time
- Troubleshooting errors
- Meta updates their interface
- Developing custom selectors

## 🔒 Security Notes

- **Never commit** `config.json` with real API keys to version control
- Store API keys securely
- The `.gitignore` file already excludes sensitive data

## 🛠️ Technical Details

### Technology Stack

- **Electron** - Desktop GUI framework
- **Puppeteer** - Browser automation
- **AdsPower Local API** - Browser profile management
- **Node.js** - Runtime environment

### Architecture

```
┌─────────────┐
│  Electron   │ ◄─── User Interface
│     GUI     │
└──────┬──────┘
       │
       │ IPC
       │
┌──────▼──────┐
│    Main     │ ◄─── IPC Handlers
│   Process   │
└──────┬──────┘
       │
       │
    ┌──▼──────────────┐
    │   Automation    │
    │     Module      │
    └──┬──────────┬───┘
       │          │
   ┌───▼───┐  ┌──▼─────┐
   │AdsPower│ │Puppeteer│
   │  API   │ │ Browser │
   └────────┘ └─────────┘
```

## 📝 License

MIT License - Feel free to modify and distribute

## 🤝 Support

For issues or questions:
1. Check the logs in `/logs` folder
2. Enable Debug Mode and review captures
3. Check AdsPower connectivity

## 🎯 Future Enhancements

Potential improvements:
- [ ] Support for Instagram Reels
- [ ] Scheduled posting
- [ ] Multiple AdsPower profiles
- [ ] Video editing features
- [ ] Analytics dashboard

---

**Made with ❤️ using Electron + Puppeteer + AdsPower**
