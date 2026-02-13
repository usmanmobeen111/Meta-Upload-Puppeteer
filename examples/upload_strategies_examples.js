/**
 * EXAMPLE USAGE: Multi-Strategy Video Upload System
 * 
 * This file demonstrates how to use the new upload system
 * both automatically (via uploader.js) and manually.
 */

// ============================================================
// EXAMPLE 1: Automatic Usage (Recommended)
// ============================================================

const MetaReelsUploader = require('./automation/uploader');

async function automaticUploadExample() {
    const config = {
        adspowerApiKey: 'YOUR_API_KEY',
        adspowerProfileId: 'YOUR_PROFILE_ID',
        facebookPageId: 'YOUR_PAGE_ID',
        metaBusinessUrl: 'https://business.facebook.com/latest/home',
        uploadTimeoutSeconds: 300,  // 5 minutes timeout
        maxRetries: 3
    };
    
    const uploader = new MetaReelsUploader(config);
    
    const videoData = {
        folderName: 'My Video Folder',
        folderPath: 'C:\\Videos\\MyVideo',
        videoPath: 'C:\\Videos\\MyVideo\\video.mp4',
        videoFile: 'video.mp4',
        caption: 'Check out this awesome video! 🎥'
    };
    
    try {
        // The uploader automatically detects video duration
        // and routes to POST workflow for videos >= 90 seconds
        // POST workflow now uses the multi-strategy upload system
        await uploader.uploadVideo(videoData);
        
        console.log('✅ Video uploaded successfully!');
        
    } catch (error) {
        console.error('❌ Upload failed:', error.message);
        console.log('Check debug/errors/ folder for debugging info');
    }
}

// ============================================================
// EXAMPLE 2: Manual Usage (Advanced)
// ============================================================

const puppeteer = require('puppeteer-core');
const { uploadVideoInMetaPostWorkflow } = require('./automation/uploadStrategies');

async function manualUploadExample() {
    // Connect to AdsPower or any browser
    const browser = await puppeteer.connect({
        browserWSEndpoint: 'ws://127.0.0.1:50325/devtools/browser/...'
    });
    
    const page = (await browser.pages())[0];
    
    // Navigate to Create Post screen
    await page.goto('https://business.facebook.com/latest/home?asset_id=YOUR_PAGE_ID');
    
    // Click "Create Post" button
    await page.evaluate(() => {
        const button = [...document.querySelectorAll('[role="button"]')]
            .find(el => el.innerText.includes('Create Post'));
        if (button) button.click();
    });
    
    await page.waitForTimeout(2000);
    
    // Click "Add video" dropdown
    await page.evaluate(() => {
        const button = [...document.querySelectorAll('[role="button"]')]
            .find(el => el.innerText.toLowerCase().includes('add video'));
        if (button) button.click();
    });
    
    await page.waitForTimeout(1000);
    
    // NOW use the multi-strategy upload system
    const videoPath = 'C:\\Videos\\my-video.mp4';
    const config = {
        uploadTimeoutSeconds: 300
    };
    
    try {
        // This will:
        // 1. Try 6 different upload strategies
        // 2. Use real mouse clicks
        // 3. Verify upload started and completed
        // 4. Save debug info on failure
        const success = await uploadVideoInMetaPostWorkflow(page, videoPath, config);
        
        console.log('✅ Upload successful!');
        
        // Continue with caption, publish, etc.
        
    } catch (error) {
        console.error('❌ Upload failed:', error.message);
        // Debug dump automatically saved to debug/errors/
    }
}

// ============================================================
// EXAMPLE 3: Using Individual Helper Functions
// ============================================================

const {
    realMouseClick,
    scanIFramesForFileInputs,
    confirmUploadStarted,
    saveDebugDump
} = require('./automation/uploadStrategies');

async function helperFunctionsExample(page) {
    // Example: Click element with real mouse
    const button = await page.$('[role="button"]');
    if (button) {
        await realMouseClick(page, button);
    }
    
    // Example: Scan all iframes for file inputs
    const iframeInputs = await scanIFramesForFileInputs(page);
    console.log(`Found ${iframeInputs.length} file inputs in iframes`);
    
    // Example: Confirm upload started
    const uploadStarted = await confirmUploadStarted(page, 10000);
    if (uploadStarted) {
        console.log('✅ Upload confirmed');
    }
    
    // Example: Manual debug dump
    try {
        // ... some operation that might fail
    } catch (error) {
        await saveDebugDump(page, 'C:\\Videos\\video.mp4', error);
    }
}

// ============================================================
// EXAMPLE 4: Custom Strategy Order
// ============================================================

async function customStrategyExample(page, videoPath) {
    // If you want to customize which strategies to use,
    // you can call them individually from uploadStrategies.js
    
    const {
        realMouseClick,
        scanIFramesForFileInputs
    } = require('./automation/uploadStrategies');
    
    // Try your custom approach
    let success = false;
    
    // Custom Strategy 1: Try iframes first
    const iframeInputs = await scanIFramesForFileInputs(page);
    if (iframeInputs.length > 0) {
        const { fileInput } = iframeInputs[0];
        await fileInput.uploadFile(videoPath);
        success = true;
    }
    
    // Custom Strategy 2: Fall back to DOM inputs
    if (!success) {
        const fileInputs = await page.$$('input[type="file"]');
        if (fileInputs.length > 0) {
            await fileInputs[0].uploadFile(videoPath);
            success = true;
        }
    }
    
    return success;
}

// ============================================================
// EXAMPLE 5: Integration with Existing Workflow
// ============================================================

async function existingWorkflowIntegration() {
    // Your existing POST workflow code...
    
    const uploader = new MetaReelsUploader(config);
    await uploader.startBrowser();
    
    // Navigate to Meta Business Suite
    await uploader.page.goto('https://business.facebook.com/...');
    
    // Click "Create Post"
    await page.evaluate(() => {
        const btn = [...document.querySelectorAll('[role="button"]')]
            .find(el => el.innerText.includes('Create Post'));
        btn.click();
    });
    
    await page.waitForTimeout(2000);
    
    // Open "Add video" dropdown
    await page.evaluate(() => {
        const btn = [...document.querySelectorAll('[role="button"]')]
            .find(el => el.innerText.toLowerCase().includes('add video'));
        btn.click();
    });
    
    await page.waitForTimeout(1000);
    
    // REPLACE your old upload code with this:
    const { uploadVideoInMetaPostWorkflow } = require('./automation/uploadStrategies');
    await uploadVideoInMetaPostWorkflow(uploader.page, videoPath, uploader.config);
    
    // Continue with caption, publish, etc...
}

// ============================================================
// Run Examples
// ============================================================

if (require.main === module) {
    console.log('📚 Multi-Strategy Upload Examples');
    console.log('===================================');
    console.log('\nChoose an example to run:');
    console.log('1. Automatic Upload (recommended)');
    console.log('2. Manual Upload (advanced)');
    console.log('3. Helper Functions');
    console.log('\nEdit this file and uncomment the example you want to run.');
    
    // Uncomment to run:
    // automaticUploadExample();
    // manualUploadExample();
    // helperFunctionsExample();
}

module.exports = {
    automaticUploadExample,
    manualUploadExample,
    helperFunctionsExample
};
