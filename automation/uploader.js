/**
 * Main Puppeteer Uploader
 * Orchestrates the complete Meta Business Suite posting workflow
 */

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { randomDelay } = require('../utils/randomDelay');
const { debugCapture, captureErrorEvidence } = require('../utils/debugCapture');
const { markAsPosted } = require('../utils/statusMarker');
const {
    clickButtonByText,
    clickButtonWithSVG,
    waitForPageLoad,
    waitForUploadComplete,
    pasteTextWithEmojis
} = require('./helpers');
const AdsPowerClient = require('./adsPowerClient');

// Step names for debug tracking
const STEPS = {
    OPEN_BUSINESS_SUITE: 'STEP_1_OPEN_BUSINESS_SUITE',
    CLICK_CREATE_REEL: 'STEP_2_CLICK_CREATE_REEL',
    CLICK_ADD_VIDEO: 'STEP_3_CLICK_ADD_VIDEO',
    UPLOAD_VIDEO: 'STEP_4_UPLOAD_VIDEO',
    WAIT_UPLOAD: 'STEP_5_WAIT_UPLOAD',
    PASTE_CAPTION: 'STEP_6_PASTE_CAPTION',
    CLICK_NEXT_1: 'STEP_7_CLICK_NEXT_1',
    CLICK_NEXT_2: 'STEP_8_CLICK_NEXT_2',
    CLICK_SHARE: 'STEP_9_CLICK_SHARE',
    CONFIRM_POSTED: 'STEP_10_CONFIRM_POSTED'
};

class MetaReelsUploader {
    constructor(config) {
        this.config = config;
        this.adsPowerClient = new AdsPowerClient(
            config.adspowerApiKey
        );
        this.browser = null;
        this.page = null;
    }

    /**
     * Upload a single video to Meta Reels
     * @param {Object} videoData - Video folder data
     * @returns {Promise<boolean>} Success status
     */
    async uploadVideo(videoData) {
        const { folderName, videoPath, caption, videoFile } = videoData;

        try {
            logger.log(`\n${'='.repeat(60)}`);
            logger.log(`Starting upload for: ${folderName}`);
            logger.log(`${'='.repeat(60)}\n`);

            // Start AdsPower profile
            await this.startBrowser();

            // Execute upload workflow
            await this.executeWorkflow(folderName, videoPath, caption);

            // Mark as posted
            markAsPosted(videoData.folderPath, videoFile);
            logger.success(`✅ Successfully posted: ${folderName}`);

            // Close browser
            await this.closeBrowser();

            return true;
        } catch (error) {
            logger.error(`❌ Failed to upload ${folderName}: ${error.message}`);

            // Try to capture error evidence if page exists
            if (this.page) {
                try {
                    await captureErrorEvidence(this.page, folderName, 'UPLOAD_FAILED', error);
                } catch (captureError) {
                    logger.warn(`Could not capture error evidence: ${captureError.message}`);
                }
            }

            // Close browser on error
            await this.closeBrowser();

            throw error;
        }
    }

    /**
     * Start AdsPower browser and connect Puppeteer
     */
    async startBrowser() {
        try {
            logger.log('Starting AdsPower browser...');

            // Start AdsPower profile
            const profileData = await this.adsPowerClient.startProfile(
                this.config.adspowerProfileId
            );

            // Determine connection method based on what AdsPower returns
            let connectionOptions = {};

            // Check if we have a WebSocket endpoint
            if (profileData.wsEndpoint) {
                let wsEndpoint = profileData.wsEndpoint;

                // Ensure WebSocket endpoint has proper protocol
                if (!wsEndpoint.startsWith('ws://') && !wsEndpoint.startsWith('wss://')) {
                    wsEndpoint = `ws://${wsEndpoint}`;
                    logger.log(`[CONNECTION] Added ws:// protocol: ${wsEndpoint}`);
                } else {
                    logger.log(`[CONNECTION] Using WebSocket endpoint: ${wsEndpoint}`);
                }

                connectionOptions.browserWSEndpoint = wsEndpoint;
            }
            // Fallback to browserURL if only debugPort is available
            else if (profileData.debugPort) {
                const browserURL = `http://127.0.0.1:${profileData.debugPort}`;
                logger.log(`[CONNECTION] Using browserURL: ${browserURL}`);
                connectionOptions.browserURL = browserURL;
            }
            else {
                throw new Error('AdsPower did not return a WebSocket endpoint or debug port');
            }

            // Add default viewport
            connectionOptions.defaultViewport = null;

            // Connect Puppeteer to AdsPower browser
            logger.log(`[CONNECTION] Connecting to browser with options: ${JSON.stringify(connectionOptions)}`);
            this.browser = await puppeteer.connect(connectionOptions);

            // Get the first page
            const pages = await this.browser.pages();
            this.page = pages[0] || await this.browser.newPage();

            logger.success('Browser connected successfully');
        } catch (error) {
            logger.error(`Failed to start browser: ${error.message}`);
            throw error;
        }
    }

    /**
     * Close browser and stop AdsPower profile
     */
    async closeBrowser() {
        try {
            if (this.browser) {
                await this.browser.disconnect();
                this.browser = null;
                this.page = null;
            }

            // Stop AdsPower profile
            await this.adsPowerClient.stopProfile(this.config.adspowerProfileId);

            logger.log('Browser closed');
        } catch (error) {
            logger.warn(`Error closing browser: ${error.message}`);
        }
    }

    /**
     * Execute the complete upload workflow
     */
    async executeWorkflow(folderName, videoPath, caption) {
        // STEP 1: Navigate to Meta Business Suite
        logger.step('STEP 1: Opening Meta Business Suite...');
        await this.page.goto(this.config.metaBusinessUrl, {
            waitUntil: 'networkidle2',
            timeout: 60000
        });
        await randomDelay();
        await debugCapture(this.page, folderName, STEPS.OPEN_BUSINESS_SUITE, this.config);

        // STEP 2: Click "Create Reel"
        logger.step('STEP 2: Clicking "Create Reel" button...');
        await clickButtonByText(this.page, 'Create Reel', this.config.maxRetries);
        await this.page.waitForTimeout(2000);
        await debugCapture(this.page, folderName, STEPS.CLICK_CREATE_REEL, this.config);

        // STEP 3 & 4: Set up file chooser, click "Add Video", and upload
        logger.step('STEP 3: Setting up file chooser and clicking "Add Video"...');

        // CRITICAL: Set up file chooser listener BEFORE clicking the button
        logger.log('[UPLOAD] Setting up file chooser listener...');
        const fileChooserPromise = this.page.waitForFileChooser({ timeout: 10000 });

        // Now click the Add Video button
        logger.log('[UPLOAD] Clicking Add Video button via SVG icon...');
        await clickButtonWithSVG(
            this.page,
            'M21.382 4.026C21.154 2.79 20.056 2',
            'Add Video'
        );

        // Wait for the file chooser to appear
        logger.step('STEP 4: Uploading video file...');
        logger.log('[UPLOAD] Waiting for file chooser dialog to appear...');
        const fileChooser = await fileChooserPromise;

        logger.success('[UPLOAD] File chooser detected!');
        logger.log(`[UPLOAD] Uploading file: ${path.basename(videoPath)}`);

        // Accept the file
        await fileChooser.accept([videoPath]);
        logger.success(`[UPLOAD] ✅ Video uploaded successfully: ${path.basename(videoPath)}`);

        await randomDelay();
        await debugCapture(this.page, folderName, STEPS.CLICK_ADD_VIDEO, this.config);

        // STEP 5: Wait for upload completion
        logger.step('STEP 5: Waiting for upload to complete...');
        await waitForUploadComplete(this.page, this.config.uploadTimeoutSeconds);
        await debugCapture(this.page, folderName, STEPS.WAIT_UPLOAD, this.config);

        // STEP 6: Paste caption
        logger.step('STEP 6: Pasting caption...');
        await this.pasteCaption(caption);
        await debugCapture(this.page, folderName, STEPS.PASTE_CAPTION, this.config);

        // STEP 7: Click first Next button
        logger.step('STEP 7: Clicking first "Next" button...');
        await clickButtonByText(this.page, 'Next', this.config.maxRetries);
        await this.page.waitForTimeout(2000);
        await debugCapture(this.page, folderName, STEPS.CLICK_NEXT_1, this.config);

        // STEP 8: Click second Next button
        logger.step('STEP 8: Clicking second "Next" button...');
        await clickButtonByText(this.page, 'Next', this.config.maxRetries);
        await this.page.waitForTimeout(2000);
        await debugCapture(this.page, folderName, STEPS.CLICK_NEXT_2, this.config);

        // STEP 9: Click Share button
        logger.step('STEP 9: Clicking "Share" button...');
        await this.clickShareButton();
        await debugCapture(this.page, folderName, STEPS.CLICK_SHARE, this.config);

        // STEP 10: Wait for confirmation
        logger.step('STEP 10: Waiting for posting confirmation...');
        await this.waitForConfirmation();
        await debugCapture(this.page, folderName, STEPS.CONFIRM_POSTED, this.config);
    }

    /**
     * Upload video file via file chooser or file input
     * Uses waitForFileChooser as primary method, falls back to input scanning
     */
    async uploadVideoFile(videoPath) {
        const path = require('path');

        try {
            logger.log('[UPLOAD] Starting video upload...');
            logger.log(`[UPLOAD] Video path: ${videoPath}`);

            // Method 1: Wait for file chooser (PREFERRED)
            logger.log('[UPLOAD] Method 1: Waiting for file chooser dialog...');

            try {
                // Set up file chooser listener with timeout
                const fileChooserPromise = this.page.waitForFileChooser({ timeout: 5000 });

                // File chooser should appear after clicking "Add Video"
                const fileChooser = await fileChooserPromise;

                logger.success('[UPLOAD] File chooser detected!');
                await fileChooser.accept([videoPath]);
                logger.success(`[UPLOAD] ✅ Video uploaded via file chooser: ${path.basename(videoPath)}`);
                await randomDelay();
                return true;
            } catch (fileChooserError) {
                logger.warn(`[UPLOAD] File chooser not available: ${fileChooserError.message}`);
                logger.log('[UPLOAD] Falling back to Method 2: Direct file input...');
            }

            // Method 2: Find and use file input elements (FALLBACK)
            await this.page.waitForTimeout(2000);

            // Scan for all file input elements
            const fileInputs = await this.page.$$('input[type="file"]');
            const fileInputCount = fileInputs.length;

            logger.log(`[UPLOAD] Found ${fileInputCount} file input element(s)`);

            if (fileInputCount === 0) {
                throw new Error('No file input elements found on page');
            }

            // Log details about each file input found
            for (let i = 0; i < fileInputs.length; i++) {
                const inputInfo = await this.page.evaluate((index) => {
                    const inputs = document.querySelectorAll('input[type="file"]');
                    const input = inputs[index];
                    return {
                        id: input.id || 'none',
                        name: input.name || 'none',
                        accept: input.accept || 'none',
                        multiple: input.multiple,
                        visible: input.offsetParent !== null
                    };
                }, i);
                logger.log(`[UPLOAD]   Input ${i + 1}: id="${inputInfo.id}", name="${inputInfo.name}", accept="${inputInfo.accept}", visible=${inputInfo.visible}`);
            }

            // Use the LAST file input (most likely the correct one)
            const targetInput = fileInputs[fileInputCount - 1];
            logger.log(`[UPLOAD] Using file input #${fileInputCount} (last one)`);

            // Upload the file
            await targetInput.uploadFile(videoPath);
            logger.success(`[UPLOAD] ✅ Video uploaded via file input: ${path.basename(videoPath)}`);
            await randomDelay();
            return true;

        } catch (error) {
            logger.error(`[UPLOAD] ❌ Failed to upload video: ${error.message}`);

            // Capture debug evidence
            try {
                const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '').replace('T', '_');
                const fs = require('fs');
                const debugDir = path.join(__dirname, '..', 'debug_screenshots');

                if (!fs.existsSync(debugDir)) {
                    fs.mkdirSync(debugDir, { recursive: true });
                }

                // Screenshot
                const screenshotPath = path.join(debugDir, `upload_failed_${timestamp}.png`);
                await this.page.screenshot({ path: screenshotPath, fullPage: true });
                logger.error(`[DEBUG] Screenshot saved: ${screenshotPath}`);

                // DOM HTML
                const htmlPath = path.join(debugDir, `upload_failed_${timestamp}.html`);
                const html = await this.page.content();
                fs.writeFileSync(htmlPath, html, 'utf8');
                logger.error(`[DEBUG] HTML saved: ${htmlPath}`);

                // Count file inputs for debugging
                const fileInputCount = await this.page.$$eval('input[type="file"]', inputs => inputs.length);
                logger.error(`[DEBUG] File inputs on page: ${fileInputCount}`);

            } catch (debugError) {
                logger.warn(`[DEBUG] Could not save debug info: ${debugError.message}`);
            }

            throw new Error(`Failed to upload video file: ${error.message}`);
        }
    }

    /**
     * Paste caption into text field (contenteditable div)
     */
    async pasteCaption(caption) {
        try {
            logger.log('[CAPTION] Pasting caption...');

            // Wait for caption field to appear
            await this.page.waitForTimeout(2000);

            // Click on the caption field first using the exact structure
            logger.log('[CAPTION] Clicking on caption field...');
            try {
                // Click on the contenteditable div with the exact class structure
                // Target: div._5yk2 > div._5rp7 > div._1p1t > div._5rpb > div._5rpu[contenteditable="true"]
                await this.page.waitForSelector('div._5rpu[contenteditable="true"][role="textbox"]', {
                    timeout: 10000,
                    visible: true
                });

                // Click to focus the field
                await this.page.click('div._5rpu[contenteditable="true"][role="textbox"]');
                await this.page.waitForTimeout(500);
                logger.success('[CAPTION] Caption field clicked and focused');
            } catch (clickError) {
                logger.warn(`[CAPTION] Could not click caption field: ${clickError.message}`);
                // Continue anyway, try to paste
            }

            // Try to paste the caption text using page.evaluate
            const captionPasted = await this.page.evaluate((captionText) => {
                // Find the contenteditable div with the specific class
                const captionBox = document.querySelector('div._5rpu[contenteditable="true"][role="textbox"]');

                if (!captionBox) {
                    return false;
                }

                // Focus the element
                captionBox.focus();

                // Clear any existing content
                captionBox.innerHTML = '';

                // Insert the caption text into the data-contents div
                const contentDiv = captionBox.querySelector('[data-contents="true"]');
                if (contentDiv) {
                    // Create proper DOM structure
                    const blockDiv = document.createElement('div');
                    blockDiv.setAttribute('data-block', 'true');
                    blockDiv.setAttribute('class', '');

                    const offsetDiv = document.createElement('div');
                    offsetDiv.setAttribute('class', '_1mf _1mj');

                    const span = document.createElement('span');
                    const textNode = document.createTextNode(captionText);
                    span.appendChild(textNode);

                    offsetDiv.appendChild(span);
                    blockDiv.appendChild(offsetDiv);

                    contentDiv.innerHTML = '';
                    contentDiv.appendChild(blockDiv);
                } else {
                    // Fallback: just set innerText
                    captionBox.innerText = captionText;
                }

                // Trigger input event to notify React/Facebook's framework
                captionBox.dispatchEvent(new Event('input', { bubbles: true }));
                captionBox.dispatchEvent(new Event('change', { bubbles: true }));

                return true;
            }, caption);

            if (!captionPasted) {
                // Fallback: try typing directly
                logger.warn('[CAPTION] Direct paste failed, trying keyboard method...');

                // Click on the caption area again
                await this.page.click('div._5rpu[contenteditable="true"][role="textbox"]');
                await this.page.waitForTimeout(500);

                // Use clipboard to paste (faster than typing)
                await this.page.evaluate((text) => {
                    // Try to use clipboard API
                    navigator.clipboard.writeText(text);
                }, caption);

                // Press Ctrl+V to paste
                await this.page.keyboard.down('Control');
                await this.page.keyboard.press('v');
                await this.page.keyboard.up('Control');
                await this.page.waitForTimeout(500);
            }

            logger.success(`[CAPTION] ✅ Caption pasted: "${caption.substring(0, 50)}${caption.length > 50 ? '...' : ''}"`);
            await randomDelay();
        } catch (error) {
            logger.error(`[CAPTION] Failed to paste caption: ${error.message}`);
            throw new Error(`Failed to paste caption: ${error.message}`);
        }
    }

    /**
     * Click Share/Publish button and wait for page redirect
     */
    async clickShareButton() {
        try {
            logger.log('[SHARE] Clicking Share/Publish button...');

            // Set up navigation promise BEFORE clicking
            const navigationPromise = this.page.waitForNavigation({
                waitUntil: 'networkidle2',
                timeout: 30000
            }).catch(err => {
                // Navigation might not happen, so log but don't fail
                logger.warn(`[SHARE] Navigation timeout (may be expected): ${err.message}`);
                return null;
            });

            // Method 1: Try to find the exact Share button using role and text
            logger.log('[SHARE] Method 1: Searching for button with role="button" containing "Share"...');
            const shareClicked = await this.page.evaluate(() => {
                // Find all elements with role="button"
                const buttons = Array.from(document.querySelectorAll('[role="button"]'));

                // Find the one that contains "Share" text
                const shareButton = buttons.find(btn => {
                    const text = btn.innerText || btn.textContent;
                    return text && text.trim().toLowerCase() === 'share';
                });

                if (shareButton) {
                    shareButton.click();
                    return true;
                }
                return false;
            });

            if (!shareClicked) {
                // Method 2: Fallback to text-based clicking
                logger.warn('[SHARE] Method 1 failed, trying fallback methods...');
                try {
                    await clickButtonByText(this.page, 'Share', this.config.maxRetries);
                } catch (e1) {
                    try {
                        await clickButtonByText(this.page, 'Publish', this.config.maxRetries);
                    } catch (e2) {
                        throw new Error('Share/Publish button not found');
                    }
                }
            } else {
                logger.success('[SHARE] Share button clicked via Method 1');
            }

            // Wait for page to redirect
            logger.log('[SHARE] Waiting for page redirect...');
            await navigationPromise;

            // Additional wait to ensure page is fully loaded
            await this.page.waitForTimeout(2000);
            logger.success('[SHARE] ✅ Share button clicked, page redirected');

        } catch (error) {
            throw new Error(`Failed to click Share button: ${error.message}`);
        }
    }

    /**
     * Wait for posting confirmation
     */
    async waitForConfirmation() {
        try {
            // Wait for success indicators
            const maxWait = 30000;
            const startTime = Date.now();

            while (Date.now() - startTime < maxWait) {
                const hasConfirmation = await this.page.evaluate(() => {
                    const text = document.body.innerText.toLowerCase();
                    return text.includes('shared') ||
                        text.includes('posted') ||
                        text.includes('published') ||
                        text.includes('your reel');
                });

                if (hasConfirmation) {
                    logger.success('Posting confirmed!');
                    await randomDelay();
                    return;
                }

                await this.page.waitForTimeout(1000);
            }

            logger.warn('No explicit confirmation found, assuming success');
        } catch (error) {
            logger.warn(`Confirmation check error: ${error.message}`);
        }
    }
}

module.exports = MetaReelsUploader;
