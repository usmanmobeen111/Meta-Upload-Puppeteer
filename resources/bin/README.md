# FFprobe Setup for Bundled Distribution

## Overview
This app now bundles FFprobe with the installer, so end users don't need to install FFmpeg separately.

## For Developers

### 1. Download FFprobe Binary

You need to obtain the `ffprobe.exe` binary and place it in the `resources/bin` directory before building the installer.

#### Option A: Download from Official FFmpeg (Recommended)
1. Visit: https://www.gyan.dev/ffmpeg/builds/
2. Download: **ffmpeg-release-essentials.zip** (smaller, contains just ffprobe and ffmpeg)
3. Extract the ZIP file
4. Navigate to the `bin` folder inside
5. Copy **ffprobe.exe** to your project's `resources/bin/` folder

#### Option B: Use Chocolatey Package
If you have FFmpeg installed via Chocolatey:
```powershell
# Find FFprobe location
where.exe ffprobe

# Copy to project (adjust path as needed)
Copy-Item "C:\ProgramData\chocolatey\bin\ffprobe.exe" "resources\bin\ffprobe.exe"
```

### 2. Verify File Structure

After placing ffprobe.exe, your project should look like:
```
Meta Upload Puppeteer/
├── resources/
│   └── bin/
│       └── ffprobe.exe  ← FFprobe binary (not in Git)
├── utils/
│   └── videoDuration.js
├── package.json
└── ...
```

### 3. Build the Installer

```powershell
npm run dist
```

The `ffprobe.exe` will be automatically bundled with your installer in the `resources/bin` directory.

## How It Works

**In Development:**
- Uses system FFprobe (from PATH environment variable)
- Falls back gracefully if not installed

**In Production (Packaged App):**
- Automatically uses bundled `ffprobe.exe` from `resources/bin/`
- No user installation required

## Important Notes

⚠️ **Do NOT commit ffprobe.exe to Git**
- The binary is ~50MB and should not be in version control
- Add `resources/bin/ffprobe.exe` to `.gitignore`

✅ **What's Committed:**
- Empty `resources/bin` folder structure
- This README with download instructions
- Code changes to detect bundled FFprobe

## License Note

FFmpeg/FFprobe is licensed under LGPL/GPL. When distributing:
- You can bundle the binary
- Mention FFmpeg in your credits/about section
- Provide link to FFmpeg source: https://ffmpeg.org

## Troubleshooting

**"FFprobe timeout" in packaged app:**
1. Verify `ffprobe.exe` is in `resources/bin/` before building
2. Check the built installer contains the binary
3. Ensure file isn't corrupted (compare checksums)

**Works in dev but not in production:**
- The code automatically switches between system and bundled FFprobe
- Check console logs for "Using bundled FFprobe" message
