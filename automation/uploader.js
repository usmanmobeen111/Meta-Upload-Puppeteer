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
const { getVideoDuration } = require('../utils/videoDuration');
const {
    clickButtonByText,
    clickButtonWithSVG,
    waitForPageLoad,
    waitForUploadComplete,
    pasteTextWithEmojis,
    // New Post workflow helpers
    clickCreatePost,
    openAddVideoDropdown,
    clickUploadFromComputer,
    waitForPostUploadComplete,
    clickPublishButton,
    waitForPublishConfirmation,
    fillOptionalTitleDescription
} = require('./helpers');
const AdsPowerClient = require('./adsPowerClient');
const { applyCaptionWithRetry } = require('./captionHandler');

// Step names for debug tracking (Reel workflow)
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

// Step names for Post workflow
const POST_STEPS = {
    OPEN_BUSINESS_SUITE: 'STEP_POST_1_OPEN_BUSINESS_SUITE',
    CLICK_CREATE_POST: 'STEP_POST_2_CLICK_CREATE_POST',
    CLICK_ADD_VIDEO_DROPDOWN: 'STEP_POST_3_CLICK_ADD_VIDEO_DROPDOWN',
    CLICK_UPLOAD_FROM_COMPUTER: 'STEP_POST_4_CLICK_UPLOAD_FROM_COMPUTER',
    UPLOAD_VIDEO: 'STEP_POST_5_UPLOAD_VIDEO',
    WAIT_UPLOAD_COMPLETE: 'STEP_POST_6_WAIT_UPLOAD_COMPLETE',
    FILL_CAPTION: 'STEP_POST_7_FILL_CAPTION',
    FILL_OPTIONAL_FIELDS: 'STEP_POST_8_FILL_OPTIONAL_FIELDS',
    CLICK_PUBLISH: 'STEP_POST_9_CLICK_PUBLISH',
    CONFIRM_PUBLISHED: 'STEP_POST_10_CONFIRM_PUBLISHED'
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
     * Upload a single video to Meta (Reel or Post)
     * Auto-detects video duration and routes to appropriate workflow
     * @param {Object} videoData - Video folder data
     * @returns {Promise<boolean>} Success status
     */
    async uploadVideo(videoData) {
        const { folderName, videoPath, caption, videoFile } = videoData;

        try {
            logger.log(`\n${'='.repeat(60)}`);
            logger.log(`Starting upload for: ${folderName}`);
            logger.log(`${'='.repeat(60)}\n`);

            // STEP 0: Detect video duration
            logger.log('🎬 Detecting video duration...');
            const duration = await getVideoDuration(videoPath);
            
            let workflowType = 'REEL'; // Default to Reel workflow
            
            if (duration !== null) {
                logger.log(`📏 Video duration: ${duration.toFixed(2)} seconds`);
                
                // Auto-select workflow based on duration
                if (duration < 90) {
                    workflowType = 'REEL';
                    logger.log('✅ Duration < 90 seconds → Using REEL workflow');
                } else {
                    workflowType = 'POST';
                    logger.log('✅ Duration >= 90 seconds → Using POST workflow');
                }
            } else {
                logger.warn('⚠️ Could not detect video duration');
                logger.warn('   Defaulting to REEL workflow');
                logger.warn('   Install FFprobe to enable auto-routing');
            }

            // Start AdsPower profile
            await this.startBrowser();

            // Execute appropriate workflow
            if (workflowType === 'POST') {
                logger.log('\n📝 Executing CREATE POST workflow...\n');
                await this.executePostWorkflow(folderName, videoPath, caption);
            } else {
                logger.log('\n🎥 Executing CREATE REEL workflow...\n');
                await this.executeWorkflow(folderName, videoPath, caption);
            }

            // Close browser first
            await this.closeBrowser();

            // Mark as posted ONLY after successful workflow completion
            markAsPosted(videoData.folderPath, videoFile);
            logger.success(`✅ Successfully posted: ${folderName}`);

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
     * Execute the complete Reel upload workflow
     */
    async executeWorkflow(folderName, videoPath, caption) {
        // Build dynamic URL with page ID from config
        const metaBusinessUrl = this.config.facebookPageId
            ? `https://business.facebook.com/latest/home?asset_id=${this.config.facebookPageId}`
            : this.config.metaBusinessUrl;

        // STEP 1: Navigate to Meta Business Suite
        logger.step('STEP 1: Opening Meta Business Suite...');
        await this.page.goto(metaBusinessUrl, {
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

        // STEP 6: Paste caption with React state updates and verification
        logger.step('STEP 6: Pasting caption...');
        await applyCaptionWithRetry(this.page, caption, 3);
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
     * Execute the complete CREATE POST workflow
     * For videos >= 90 seconds
     */
    async executePostWorkflow(folderName, videoPath, caption) {
        // Build dynamic URL with page ID from config
        const metaBusinessUrl = this.config.facebookPageId
            ? `https://business.facebook.com/latest/home?asset_id=${this.config.facebookPageId}`
            : this.config.metaBusinessUrl;

        // STEP 1: Navigate to Meta Business Suite
        logger.step('STEP POST 1: Opening Meta Business Suite...');
        await this.page.goto(metaBusinessUrl, {
            waitUntil: 'networkidle2',
            timeout: 60000
        });
        await randomDelay();
        await debugCapture(this.page, folderName, POST_STEPS.OPEN_BUSINESS_SUITE, this.config);

        // STEP 2: Click "Create Post"
        logger.step('STEP POST 2: Clicking "Create Post" button...');
        await clickCreatePost(this.page, this.config.maxRetries);
        await this.page.waitForTimeout(2000);
        await debugCapture(this.page, folderName, POST_STEPS.CLICK_CREATE_POST, this.config);

        // STEP 3: Open "Add video" dropdown
        logger.step('STEP POST 3: Opening "Add video" dropdown...');
        await openAddVideoDropdown(this.page, this.config.maxRetries);
        await this.page.waitForTimeout(1000);
        await debugCapture(this.page, folderName, POST_STEPS.CLICK_ADD_VIDEO_DROPDOWN, this.config);

        // STEP 4 & 5: Click "Upload from computer" and upload video
        logger.step('STEP POST 4: Clicking "Upload from computer"...');
        
        // CRITICAL: Set up file chooser listener BEFORE clicking the button
        logger.log('[UPLOAD] Setting up file chooser listener...');
        const fileChooserPromise = this.page.waitForFileChooser({ timeout: 10000 });
        
        // Now click Upload from computer option
        await clickUploadFromComputer(this.page, this.config.maxRetries);
        
        // Wait for the file chooser to appear
        logger.step('STEP POST 5: Uploading video file...');
        logger.log('[UPLOAD] Waiting for file chooser dialog to appear...');
        const fileChooser = await fileChooserPromise;
        
        logger.success('[UPLOAD] File chooser detected!');
        logger.log(`[UPLOAD] Uploading file: ${path.basename(videoPath)}`);
        
        // Accept the file
        await fileChooser.accept([videoPath]);
        logger.success(`[UPLOAD] ✅ Video uploaded successfully: ${path.basename(videoPath)}`);
        
        await randomDelay();
        await debugCapture(this.page, folderName, POST_STEPS.UPLOAD_VIDEO, this.config);

        // STEP 6: Wait for upload completion
        logger.step('STEP POST 6: Waiting for upload to complete...');
        await waitForPostUploadComplete(this.page, this.config.uploadTimeoutSeconds);
        await debugCapture(this.page, folderName, POST_STEPS.WAIT_UPLOAD_COMPLETE, this.config);

        // STEP 7: Fill caption (posts may have different caption field)
        logger.step('STEP POST 7: Filling caption...');
        try {
            // Try using the same caption handler as Reels
            await applyCaptionWithRetry(this.page, caption, 3);
        } catch (captionError) {
            logger.warn(`[POST] Standard caption method failed: ${captionError.message}`);
            logger.log('[POST] Trying direct textarea method...');
            
            // Fallback: find textarea and fill it
            await this.page.evaluate((captionText) => {
                const textareas = [...document.querySelectorAll('textarea')];
                if (textareas.length > 0) {
                    const textarea = textareas[0];
                    textarea.value = captionText;
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    textarea.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }, caption);
            
            logger.success('[POST] ✅ Caption filled (fallback method)');
        }
        await debugCapture(this.page, folderName, POST_STEPS.FILL_CAPTION, this.config);

        // STEP 8: Fill optional Title/Description fields if they exist
        logger.step('STEP POST 8: Checking for optional Title/Description fields...');
        await fillOptionalTitleDescription(this.page, caption);
        await debugCapture(this.page, folderName, POST_STEPS.FILL_OPTIONAL_FIELDS, this.config);

        // STEP 9: Click Publish button
        logger.step('STEP POST 9: Clicking "Publish" button...');
        await clickPublishButton(this.page, this.config.maxRetries);
        await debugCapture(this.page, folderName, POST_STEPS.CLICK_PUBLISH, this.config);

        // STEP 10: Wait for publish confirmation
        logger.step('STEP POST 10: Waiting for publish confirmation...');
        await waitForPublishConfirmation(this.page);
        await debugCapture(this.page, folderName, POST_STEPS.CONFIRM_PUBLISHED, this.config);
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
     * Click Share/Publish button with enhanced reliability
     * Handles nested div structures where Share is a div with role="button"
     */
    // async clickShareButton() {
    //     try {
    //         logger.log('[SHARE] Clicking Share/Publish button...');

    //         // Wait a moment for button to be ready
    //         await this.page.waitForTimeout(2000);

    //         // Strategy 1: Find divs with role="button" that contain "Share" text and are not busy
    //         logger.log('[SHARE] Strategy 1: Finding role="button" divs containing "Share" text...');
    //         let shareClicked = await this.page.evaluate(() => {
    //             // Find all elements with role="button"
    //             const buttons = Array.from(document.querySelectorAll('div[role="button"]'));
    //             console.log(`[SHARE] Found ${buttons.length} elements with role="button"`);

    //             // Find Share button by checking text content and aria-busy state
    //             const shareButton = buttons.find(btn => {
    //                 const ariaBusy = btn.getAttribute('aria-busy');
    //                 const text = (btn.textContent || '').trim();
    //                 const tabindex = btn.getAttribute('tabindex');

    //                 // Check if this button contains "Share" and is not busy
    //                 const hasShareText = text === 'Share' || text.includes('Share');
    //                 const isNotBusy = ariaBusy === 'false' || ariaBusy === null;
    //                 const isClickable = tabindex !== null && tabindex !== '-1';

    //                 if (hasShareText) {
    //                     console.log(`[SHARE] Potential Share button found: text="${text}", aria-busy="${ariaBusy}", tabindex="${tabindex}"`);
    //                 }

    //                 return hasShareText && isNotBusy && isClickable;
    //             });

    //             if (shareButton) {
    //                 console.log('[SHARE] Found Share button via role="button" and text match');
    //                 shareButton.click();
    //                 return true;
    //             }

    //             return false;
    //         });

    //         if (shareClicked) {
    //             logger.success('[SHARE] ✅ Share button clicked (Strategy 1: role="button" + text)');
    //         } else {
    //             // Strategy 2: Use XPath to find button containing Share text
    //             logger.log('[SHARE] Strategy 2: Using XPath to find Share button...');
    //             try {
    //                 const [shareButton] = await this.page.$x("//div[@role='button' and .//div[text()='Share']]");
    //                 if (shareButton) {
    //                     await shareButton.click();
    //                     shareClicked = true;
    //                     logger.success('[SHARE] ✅ Share button clicked (Strategy 2: XPath)');
    //                 }
    //             } catch (xpathError) {
    //                 logger.warn(`[SHARE] XPath strategy failed: ${xpathError.message}`);
    //             }

    //             if (!shareClicked) {
    //                 // Strategy 3: Find all role="button" or button elements and check text
    //                 logger.log('[SHARE] Strategy 3: Finding any button with "Share" text...');
    //                 shareClicked = await this.page.evaluate(() => {
    //                     const buttons = Array.from(document.querySelectorAll('[role="button"], button'));

    //                     // Find the one that contains "Share" text
    //                     const shareButton = buttons.find(btn => {
    //                         const text = (btn.textContent || btn.innerText || '').toLowerCase();
    //                         return text.includes('share');
    //                     });

    //                     if (shareButton) {
    //                         console.log('[SHARE] Found Share button (contains match)');
    //                         shareButton.click();
    //                         return true;
    //                     }

    //                     return false;
    //                 });

    //                 if (shareClicked) {
    //                     logger.success('[SHARE] ✅ Share button clicked (Strategy 3: Text contains)');
    //                 } else {
    //                     // Strategy 4: Use TreeWalker to find Share text and click parent
    //                     logger.log('[SHARE] Strategy 4: Using TreeWalker to find Share text node...');
    //                     shareClicked = await this.page.evaluate(() => {
    //                         const walker = document.createTreeWalker(
    //                             document.body,
    //                             NodeFilter.SHOW_TEXT,
    //                             null,
    //                             false
    //                         );

    //                         let node;
    //                         while (node = walker.nextNode()) {
    //                             const text = node.textContent.trim();
    //                             if (text === 'Share') {
    //                                 let parent = node.parentElement;
    //                                 while (parent) {
    //                                     const role = parent.getAttribute('role');
    //                                     if (role === 'button' || parent.tagName === 'BUTTON') {
    //                                         console.log('[SHARE] Found clickable parent via TreeWalker');
    //                                         parent.click();
    //                                         return true;
    //                                     }
    //                                     parent = parent.parentElement;
    //                                 }
    //                             }
    //                         }
    //                         return false;
    //                     });

    //                     if (shareClicked) {
    //                         logger.success('[SHARE] ✅ Share button clicked (Strategy 4: TreeWalker)');
    //                     } else {
    //                         // Strategy 5: Use helper function with all fallbacks
    //                         logger.log('[SHARE] Strategy 5: Using helper function with retries...');
    //                         try {
    //                             await clickButtonByText(this.page, 'Share', this.config.maxRetries);
    //                             shareClicked = true;
    //                             logger.success('[SHARE] ✅ Share button clicked (Strategy 5: Helper)');
    //                         } catch (e1) {
    //                             // Try "Publish" as final fallback
    //                             logger.log('[SHARE] Strategy 6: Trying "Publish" as fallback...');
    //                             try {
    //                                 await clickButtonByText(this.page, 'Publish', this.config.maxRetries);
    //                                 shareClicked = true;
    //                                 logger.success('[SHARE] ✅ Publish button clicked (Strategy 6: Fallback)');
    //                             } catch (e2) {
    //                                 throw new Error('Share/Publish button not found after all strategies');
    //                             }
    //                         }
    //                     }
    //                 }
    //             }
    //         }

    //         // If we reached here without clicking, throw error
    //         if (!shareClicked) {
    //             throw new Error('Failed to click Share/Publish button');
    //         }

    //         // Wait for page response after clicking
    //         logger.log('[SHARE] Waiting for page response...');
    //         await this.page.waitForTimeout(3000);

    //         // Check if we're still on the page or redirected
    //         const currentUrl = this.page.url();
    //         logger.log(`[SHARE] Current URL: ${currentUrl}`);

    //         logger.success('[SHARE] ✅ Share action completed');

    //     } catch (error) {
    //         logger.error(`[SHARE] ❌ Failed to click Share button: ${error.message}`);
    //         throw new Error(`Failed to click Share button: ${error.message}`);
    //     }
    // }

    async clickShareButton() {
        try {
            logger.log('[SHARE] Clicking Share/Publish button...');
            await this.page.waitForTimeout(2000);

            let shareClicked = false;
            let strategy = '';

            // Strategy 1: XPath exact match with aria-busy check
            logger.log('[SHARE] Strategy 1: XPath exact match with aria-busy="false"...');
            try {
                const xpath1 = `//div[@role='button' and @aria-busy='false' and .//div[normalize-space(text())='Share']]`;
                const [button1] = await this.page.$x(xpath1);
                if (button1) {
                    await button1.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
                    await this.page.waitForTimeout(500);
                    await button1.hover();
                    await this.page.waitForTimeout(300);
                    await button1.click();
                    shareClicked = true;
                    strategy = 'XPath exact match with aria-busy';
                    logger.success('[SHARE] Share button clicked (Strategy 1: XPath exact match)');
                }
            } catch (e) {
                logger.warn(`[SHARE] Strategy 1 failed: ${e.message}`);
            }

            // Strategy 2: XPath exact match without aria-busy
            if (!shareClicked) {
                logger.log('[SHARE] Strategy 2: XPath exact match without aria-busy...');
                try {
                    const xpath2 = `//div[@role='button' and .//div[normalize-space(text())='Share']]`;
                    const [button2] = await this.page.$x(xpath2);
                    if (button2) {
                        await button2.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
                        await this.page.waitForTimeout(500);
                        await button2.hover();
                        await this.page.waitForTimeout(300);
                        await button2.click();
                        shareClicked = true;
                        strategy = 'XPath exact match without aria-busy';
                        logger.success('[SHARE] Share button clicked (Strategy 2: XPath exact match)');
                    }
                } catch (e) {
                    logger.warn(`[SHARE] Strategy 2 failed: ${e.message}`);
                }
            }

            // Strategy 3: XPath contains
            if (!shareClicked) {
                logger.log('[SHARE] Strategy 3: XPath contains...');
                try {
                    const xpath3 = `//div[@role='button' and contains(., 'Share')]`;
                    const [button3] = await this.page.$x(xpath3);
                    if (button3) {
                        await button3.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
                        await this.page.waitForTimeout(500);
                        await button3.hover();
                        await this.page.waitForTimeout(300);
                        await button3.click();
                        shareClicked = true;
                        strategy = 'XPath contains';
                        logger.success('[SHARE] Share button clicked (Strategy 3: XPath contains)');
                    }
                } catch (e) {
                    logger.warn(`[SHARE] Strategy 3 failed: ${e.message}`);
                }
            }

            // Strategy 4: Helper clickButtonByText("Share")
            if (!shareClicked) {
                logger.log('[SHARE] Strategy 4: Helper clickButtonByText("Share")...');
                try {
                    if (typeof this.clickButtonByText === 'function') {
                        await this.clickButtonByText('Share');
                        shareClicked = true;
                        strategy = 'Helper clickButtonByText("Share")';
                        logger.success('[SHARE] Share button clicked (Strategy 4: Helper)');
                    }
                } catch (e) {
                    logger.warn(`[SHARE] Strategy 4 failed: ${e.message}`);
                }
            }

            // Strategy 5: Helper clickButtonByText("Publish")
            if (!shareClicked) {
                logger.log('[SHARE] Strategy 5: Helper clickButtonByText("Publish")...');
                try {
                    if (typeof this.clickButtonByText === 'function') {
                        await this.clickButtonByText('Publish');
                        shareClicked = true;
                        strategy = 'Helper clickButtonByText("Publish")';
                        logger.success('[SHARE] Share button clicked (Strategy 5: Helper Publish)');
                    }
                } catch (e) {
                    logger.warn(`[SHARE] Strategy 5 failed: ${e.message}`);
                }
            }

            // Strategy 6: Fallback to page.evaluate click
            if (!shareClicked) {
                logger.log('[SHARE] Strategy 6: Fallback page.evaluate click...');
                shareClicked = await this.page.evaluate(() => {
                    const buttons = Array.from(document.querySelectorAll('div[role="button"]'));
                    const shareButton = buttons.find(btn => {
                        const text = (btn.textContent || '').trim();
                        return text === 'Share' || text === 'Publish';
                    });
                    if (shareButton) {
                        shareButton.click();
                        return true;
                    }
                    return false;
                });
                if (shareClicked) {
                    strategy = 'page.evaluate fallback';
                    logger.success('[SHARE] Share button clicked (Strategy 6: page.evaluate)');
                }
            }

            if (!shareClicked) {
                throw new Error('Share button not clicked by any strategy');
            }

            // Verify UI state change
            await this.page.waitForTimeout(2000);
            const stateChanged = await this.page.evaluate(() => {
                const text = document.body.innerText.toLowerCase();
                return text.includes('posting') || text.includes('publishing') || text.includes('sharing');
            });

            if (stateChanged) {
                logger.success(`[SHARE] UI state change detected after ${strategy}`);
            }

            await this.page.waitForTimeout(1000);
            logger.success(`[SHARE] Share action completed using: ${strategy}`);

        } catch (error) {
            logger.error(`[SHARE] Failed: ${error.message}`);
            throw error;
        }
    }


    /**
     * Wait for posting confirmation
     */
    async waitForConfirmation() {
        try {
            logger.log('[CONFIRM] Waiting for posting confirmation (up to 180 seconds)...');

            const maxWait = 180000; // 3 minutes
            const startTime = Date.now();
            const screenshotInterval = 15000; // 15 seconds
            let lastScreenshotTime = startTime;
            let screenshotCount = 0;

            while (Date.now() - startTime < maxWait) {
                const elapsed = Math.floor((Date.now() - startTime) / 1000);

                // Check all signals
                const signals = await this.page.evaluate(() => {
                    const text = document.body.innerText.toLowerCase();
                    const html = document.documentElement.innerHTML.toLowerCase();

                    // Signal A: Success text
                    const successKeywords = [
                        'your reel is live',
                        'reel posted',
                        'posted',
                        'published',
                        'shared successfully',
                        'your post is now published'
                    ];
                    const hasSuccessText = successKeywords.some(keyword => text.includes(keyword) || html.includes(keyword));

                    // Signal B: Error detection
                    const errorKeywords = [
                        'something went wrong',
                        'try again',
                        'error',
                        'failed',
                        'could not publish',
                        'publishing failed'
                    ];
                    const hasError = errorKeywords.some(keyword => text.includes(keyword));

                    // Signal C: Share button state
                    const shareButtons = Array.from(document.querySelectorAll('div[role="button"]'));
                    const shareButton = shareButtons.find(btn => {
                        const btnText = (btn.textContent || '').trim();
                        return btnText === 'Share' || btnText === 'Publish';
                    });

                    const shareButtonDisappeared = !shareButton;
                    const shareButtonDisabled = shareButton ? shareButton.getAttribute('aria-disabled') === 'true' : false;
                    const shareButtonBusy = shareButton ? shareButton.getAttribute('aria-busy') === 'true' : false;
                    const shareButtonStateChanged = shareButtonDisappeared || shareButtonDisabled || shareButtonBusy;

                    // Signal D: Progress indicators
                    const progressKeywords = ['posting', 'publishing', 'sharing'];
                    const hasProgressIndicator = progressKeywords.some(keyword => text.includes(keyword) || html.includes(keyword));

                    return {
                        hasSuccessText,
                        hasError,
                        shareButtonDisappeared,
                        shareButtonDisabled,
                        shareButtonBusy,
                        shareButtonStateChanged,
                        hasProgressIndicator
                    };
                });

                // Signal E: URL change
                const currentUrl = this.page.url();
                const urlChanged = !currentUrl.includes('reels_composer') ||
                    currentUrl.includes('published') ||
                    currentUrl.includes('content');

                // Check for errors first
                if (signals.hasError) {
                    logger.error('[CONFIRM] Error detected on page!');
                    throw new Error('Error detected during posting');
                }

                // Check for success
                if (signals.hasSuccessText) {
                    logger.success(`[CONFIRM] Posting confirmed via success text after ${elapsed} seconds!`);
                    return;
                }

                // Check URL change
                if (urlChanged) {
                    logger.success(`[CONFIRM] Posting confirmed via URL change after ${elapsed} seconds!`);
                    logger.log(`[CONFIRM] New URL: ${currentUrl}`);
                    return;
                }

                // Log share button state changes
                if (signals.shareButtonStateChanged) {
                    if (signals.shareButtonDisappeared) {
                        logger.log(`[CONFIRM] Share button disappeared - posting likely in progress (${elapsed}s)`);
                    } else if (signals.shareButtonDisabled) {
                        logger.log(`[CONFIRM] Share button disabled - posting in progress (${elapsed}s)`);
                    } else if (signals.shareButtonBusy) {
                        logger.log(`[CONFIRM] Share button busy - posting in progress (${elapsed}s)`);
                    }
                }

                // Log progress indicators
                if (signals.hasProgressIndicator) {
                    logger.log(`[CONFIRM] Progress indicator detected (${elapsed}s)`);
                }

                // Signal F: Take screenshot every 15 seconds
                if (Date.now() - lastScreenshotTime >= screenshotInterval) {
                    screenshotCount++;
                    const screenshotPath = `./debug_confirmation_${screenshotCount}_${elapsed}s.png`;
                    await this.page.screenshot({ path: screenshotPath, fullPage: true });
                    logger.log(`[CONFIRM] Debug screenshot saved: ${screenshotPath} (${elapsed}s elapsed)`);
                    lastScreenshotTime = Date.now();
                }

                // Wait before next check
                await this.page.waitForTimeout(2000);
            }

            // Timeout reached
            logger.error('[CONFIRM] No posting confirmation detected after 180 seconds.');
            const finalScreenshot = `./debug_confirmation_timeout.png`;
            await this.page.screenshot({ path: finalScreenshot, fullPage: true });
            logger.log(`[CONFIRM] Final timeout screenshot saved: ${finalScreenshot}`);
            throw new Error('No posting confirmation detected after 180 seconds.');

        } catch (error) {
            logger.error(`[CONFIRM] Failed: ${error.message}`);
            throw error;
        }
    }
}

module.exports = MetaReelsUploader;
