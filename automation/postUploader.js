/**
 * Meta POST Uploader Module
 * Handles video upload to Meta Business Suite as regular POSTS (not Reels)
 *
 * Uses the Nuclear Click Engine (clickElementByText) for all button interactions.
 * This makes the workflow profile-agnostic — no random class names, no SVG targeting.
 *
 * This is completely separate from the Reels workflow (uploader.js)
 * to ensure zero risk of breaking existing production functionality.
 */

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { randomDelay } = require('../utils/randomDelay');
const { debugCapture, captureErrorEvidence, getDebugPath } = require('../utils/debugCapture');
const { markAsPosted } = require('../utils/statusMarker');
const { clickElementByText } = require('./helpers');
const AdsPowerClient = require('./adsPowerClient');

// ─────────────────────────────────────────────
// Step names for debug tracking (POST workflow)
// ─────────────────────────────────────────────
const POST_STEPS = {
    OPEN_BUSINESS_SUITE: 'POST_STEP_1_OPEN_BUSINESS_SUITE',
    CLICK_CREATE_POST:   'POST_STEP_2_CLICK_CREATE_POST',
    DETECT_UI:           'POST_STEP_3_DETECT_UI',
    UPLOAD_VIDEO:        'POST_STEP_4_UPLOAD_VIDEO',
    PASTE_CAPTION:       'POST_STEP_5_PASTE_CAPTION',
    CLICK_PUBLISH:       'POST_STEP_6_CLICK_PUBLISH',
    CLICK_SHARE:         'POST_STEP_6B_CLICK_SHARE',
    CONFIRM_POSTED:      'POST_STEP_7_CONFIRM_POSTED'
};

// ─────────────────────────────────────────────
// Keyword banks (text-based, profile-agnostic)
// ─────────────────────────────────────────────
const KW = {
    CREATE_POST: [
        'Create post', 'Create Post', 'Create a post', 'New post'
    ],
    ADD_MEDIA_SINGLE: [
        'Add photo/video', 'Add video/photo', 'Add photo / video',
        'Add video / photo', 'Add media'
    ],
    ADD_VIDEO: [
        'Add video', 'Add Video'
    ],
    ADD_PHOTO: [
        'Add photo', 'Add Photo'
    ],
    UPLOAD_FROM_DESKTOP: [
        'Upload from desktop', 'Upload from computer',
        'From desktop', 'Upload file', 'Upload video'
    ],
    PUBLISH: [
        'Publish', 'Post', 'Share'
    ]
};

class MetaPostUploader {
    constructor(config) {
        this.config = config;
        this.adsPowerClient = new AdsPowerClient(config.adspowerApiKey);
        this.browser = null;
        this.page = null;
    }

    // ═══════════════════════════════════════════════════════════
    // PUBLIC ENTRY POINT
    // ═══════════════════════════════════════════════════════════

    /**
     * Upload a single video to Meta as a POST
     * @param {Object} videoData - Video folder data
     * @returns {Promise<boolean>} Success status
     */
    async uploadPost(videoData) {
        const { folderName, videoPath, caption, videoFile } = videoData;

        try {
            logger.log(`\n${'='.repeat(60)}`);
            logger.log(`Starting POST upload for: ${folderName}`);
            logger.log(`${'='.repeat(60)}\n`);

            await this.startBrowser();

            logger.log('\n📝 Executing CREATE POST workflow...\n');
            await this.executePostWorkflow(folderName, videoPath, caption);

            await this.closeBrowser();

            markAsPosted(videoData.folderPath, videoFile);
            logger.success(`✅ Successfully posted: ${folderName}`);

            return true;
        } catch (error) {
            logger.error(`❌ Failed to upload POST ${folderName}: ${error.message}`);

            if (this.page) {
                try {
                    await captureErrorEvidence(this.page, folderName, 'POST_UPLOAD_FAILED', error);
                } catch (captureError) {
                    logger.warn(`Could not capture error evidence: ${captureError.message}`);
                }
            }

            await this.closeBrowser();
            throw error;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // BROWSER LIFECYCLE
    // ═══════════════════════════════════════════════════════════

    async startBrowser() {
        try {
            logger.log('[POST] Starting AdsPower browser...');

            const profileData = await this.adsPowerClient.startProfile(
                this.config.adspowerProfileId
            );

            let connectionOptions = {};

            if (profileData.wsEndpoint) {
                let wsEndpoint = profileData.wsEndpoint;
                if (!wsEndpoint.startsWith('ws://') && !wsEndpoint.startsWith('wss://')) {
                    wsEndpoint = `ws://${wsEndpoint}`;
                }
                connectionOptions.browserWSEndpoint = wsEndpoint;
                logger.log(`[POST] Using WebSocket endpoint: ${wsEndpoint}`);
            } else if (profileData.debugPort) {
                const browserURL = `http://127.0.0.1:${profileData.debugPort}`;
                connectionOptions.browserURL = browserURL;
                logger.log(`[POST] Using browserURL: ${browserURL}`);
            } else {
                throw new Error('AdsPower did not return a WebSocket endpoint or debug port');
            }

            connectionOptions.defaultViewport = null;

            this.browser = await puppeteer.connect(connectionOptions);
            const pages = await this.browser.pages();
            this.page = pages[0] || await this.browser.newPage();

            logger.success('[POST] Browser connected successfully');
        } catch (error) {
            logger.error(`[POST] Failed to start browser: ${error.message}`);
            throw error;
        }
    }

    async closeBrowser() {
        try {
            if (this.browser) {
                await this.browser.disconnect();
                this.browser = null;
                this.page = null;
            }
            await this.adsPowerClient.stopProfile(this.config.adspowerProfileId);
            logger.log('[POST] Browser closed');
        } catch (error) {
            logger.warn(`[POST] Error closing browser: ${error.message}`);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // MAIN WORKFLOW ORCHESTRATOR
    // ═══════════════════════════════════════════════════════════

    async executePostWorkflow(folderName, videoPath, caption) {
        const metaBusinessUrl = this.config.facebookPageId
            ? `https://business.facebook.com/latest/home?asset_id=${this.config.facebookPageId}`
            : this.config.metaBusinessUrl;

        // ── STEP 1: Navigate ──────────────────────────────────
        logger.step('POST STEP 1: Opening Meta Business Suite...');
        await this.page.goto(metaBusinessUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        await randomDelay();
        await debugCapture(this.page, folderName, POST_STEPS.OPEN_BUSINESS_SUITE, this.config);

        // ── STEP 2: Click Create Post ─────────────────────────
        logger.step('POST STEP 2: Clicking "Create Post" button...');
        await this.clickCreatePost();
        await randomDelay();
        await debugCapture(this.page, folderName, POST_STEPS.CLICK_CREATE_POST, this.config);

        // Wait for dialog/composer to appear
        await this.page.waitForTimeout(2500);

        // ── STEP 3: Detect UI variant ─────────────────────────
        logger.step('POST STEP 3: Detecting POST upload UI variant...');
        const uiScenario = await this.detectPostUploadUI();
        logger.success(`[POST] Detected UI scenario: ${uiScenario}`);
        await debugCapture(this.page, folderName, POST_STEPS.DETECT_UI, this.config);

        // ── STEP 4: Upload video ──────────────────────────────
        logger.step('POST STEP 4: Uploading video file...');
        if (uiScenario === 'SCENARIO_A') {
            await this.uploadVideoScenarioA(videoPath);
        } else {
            await this.uploadVideoScenarioB(videoPath);
        }
        logger.success(`[POST] ✅ Video file submitted: ${path.basename(videoPath)}`);
        await randomDelay();
        await debugCapture(this.page, folderName, POST_STEPS.UPLOAD_VIDEO, this.config);

        // Wait for upload to process
        logger.log('[POST] Waiting for video upload to complete...');
        await this.waitForVideoUploadComplete();

        // ── STEP 5: Insert caption ────────────────────────────
        logger.step('POST STEP 5: Inserting caption...');
        await this.insertCaption(caption);
        await randomDelay();
        await debugCapture(this.page, folderName, POST_STEPS.PASTE_CAPTION, this.config);

        // ── STEP 6: Detect mode & publish ─────────────────────
        logger.step('POST STEP 6: Detecting publish mode (Reel vs Post)...');
        const publishMode = await this.detectPublishMode();
        logger.success(`[POST] Publish mode detected: ${publishMode}`);

        if (publishMode === 'REEL') {
            logger.log('[POST] → Reel mode detected → clicking "Share" button');
            await this.clickShare();
            await randomDelay();
            await debugCapture(this.page, folderName, POST_STEPS.CLICK_SHARE, this.config);
        } else {
            logger.log('[POST] → Post mode detected → clicking "Publish" button');
            await this.clickPublish();
            await randomDelay();
            await debugCapture(this.page, folderName, POST_STEPS.CLICK_PUBLISH, this.config);
        }

        // ── STEP 7: Confirm success ───────────────────────────
        logger.step('POST STEP 7: Waiting for posting confirmation...');
        await this.waitForPostSuccess();
        await debugCapture(this.page, folderName, POST_STEPS.CONFIRM_POSTED, this.config);

        logger.success('[POST] ✅ POST workflow completed successfully!');
    }

    // ═══════════════════════════════════════════════════════════
    // STEP IMPLEMENTATIONS
    // ═══════════════════════════════════════════════════════════

    /**
     * STEP 2 — Click "Create Post" button
     * Uses nuclear engine with text variants. Falls back to data-surface selector.
     */
    async clickCreatePost() {
        try {
            logger.log('[POST] Clicking Create Post button via nuclear engine...');

            // Try nuclear engine first (text-based, profile-agnostic)
            try {
                await clickElementByText(
                    this.page,
                    KW.CREATE_POST,
                    'Create Post',
                    {
                        negativeKeywords: ['reel', 'story', 'live', 'event', 'ad'],
                        contextSelectors: []  // Don't penalise nav — Create Post IS in the nav bar
                    }
                );
                logger.success('[POST] ✅ Create Post clicked via nuclear engine');
                return;
            } catch (nuclearErr) {
                logger.warn(`[POST] Nuclear engine failed: ${nuclearErr.message}`);
            }

            // Fallback: known data-surface attribute (works on some profiles)
            const fallbackSelector = '[data-surface="/bizweb:home/lib:biz-kit-home-page-entry"]';
            try {
                logger.log(`[POST] Trying data-surface fallback: ${fallbackSelector}`);
                await this.page.waitForSelector(fallbackSelector, { timeout: 5000 });
                await this.page.click(fallbackSelector);
                logger.success('[POST] ✅ Create Post clicked via data-surface selector');
                return;
            } catch (fallbackErr) {
                logger.warn(`[POST] data-surface fallback failed: ${fallbackErr.message}`);
            }

            throw new Error('Could not find Create Post button with any strategy');
        } catch (error) {
            logger.error(`[POST] Failed to click Create Post: ${error.message}`);
            await this._saveDebugEvidence('create_post_failed');
            throw error;
        }
    }

    /**
     * STEP 3 — Detect which UI variant Meta is showing
     *
     * Scenario A: Single "Add photo/video" (or "Add media") button
     * Scenario B: Separate "Add photo" + "Add video" buttons
     *
     * @returns {Promise<'SCENARIO_A'|'SCENARIO_B'>}
     */
    async detectPostUploadUI() {
        try {
            logger.log('[POST] Scanning for upload UI buttons...');
            await this.page.waitForTimeout(1500);

            const detection = await this.page.evaluate((kwSingle, kwVideo, kwPhoto) => {
                function getVisibleText(el) {
                    return (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
                }

                function isVisible(el) {
                    const s = window.getComputedStyle(el);
                    if (s.display === 'none' || s.visibility === 'hidden') return false;
                    if (parseFloat(s.opacity) === 0) return false;
                    const r = el.getBoundingClientRect();
                    return r.width > 0 && r.height > 0;
                }

                // Collect all clickable candidates
                const seen = new Set();
                const candidates = [];
                ['[role="button"]', 'button', '[tabindex="0"]'].forEach(sel => {
                    document.querySelectorAll(sel).forEach(el => {
                        if (!seen.has(el) && isVisible(el)) {
                            seen.add(el);
                            candidates.push(getVisibleText(el));
                        }
                    });
                });

                const hasSingle = kwSingle.some(kw =>
                    candidates.some(t => t.includes(kw.toLowerCase()))
                );
                const hasVideo = kwVideo.some(kw =>
                    candidates.some(t => t.includes(kw.toLowerCase()))
                );
                const hasPhoto = kwPhoto.some(kw =>
                    candidates.some(t => t.includes(kw.toLowerCase()))
                );

                return { hasSingle, hasVideo, hasPhoto, candidateCount: candidates.length };
            }, KW.ADD_MEDIA_SINGLE, KW.ADD_VIDEO, KW.ADD_PHOTO);

            logger.log(`[POST] UI detection: hasSingle=${detection.hasSingle}, hasVideo=${detection.hasVideo}, hasPhoto=${detection.hasPhoto}, candidates=${detection.candidateCount}`);

            if (detection.hasSingle) {
                logger.log('[POST] → Scenario A: Single "Add photo/video" button found');
                return 'SCENARIO_A';
            }

            if (detection.hasVideo) {
                logger.log('[POST] → Scenario B: Separate "Add video" button found');
                return 'SCENARIO_B';
            }

            // Default to Scenario A — it's the most common layout
            logger.warn('[POST] Could not detect UI variant, defaulting to Scenario A');
            return 'SCENARIO_A';

        } catch (error) {
            logger.error(`[POST] UI detection failed: ${error.message}`);
            return 'SCENARIO_A';
        }
    }

    /**
     * STEP 4A — Scenario A: Click "Add photo/video" → file chooser opens directly
     */
    async uploadVideoScenarioA(videoPath) {
        logger.log('[POST] Scenario A: Clicking "Add photo/video" button...');

        try {
            // Set up file chooser BEFORE clicking (race condition prevention)
            const [fileChooser] = await Promise.all([
                this.page.waitForFileChooser({ timeout: 12000 }),
                clickElementByText(
                    this.page,
                    KW.ADD_MEDIA_SINGLE,
                    'Add photo/video',
                    {
                        negativeKeywords: ['story', 'live', 'event', 'reel'],
                        contextSelectors: ['nav', 'aside', '[role="navigation"]']
                    }
                )
            ]);

            logger.success('[POST] File chooser detected!');
            logger.log(`[POST] Uploading: ${path.basename(videoPath)}`);
            await fileChooser.accept([videoPath]);
            logger.success('[POST] ✅ Video uploaded via Scenario A file chooser');

        } catch (chooserError) {
            logger.warn(`[POST] Scenario A file chooser failed: ${chooserError.message}`);
            logger.log('[POST] Checking if a dropdown appeared instead...');

            // Meta sometimes shows a dropdown after clicking "Add photo/video"
            await this.page.waitForTimeout(1000);
            const dropdownAppeared = await this._tryClickUploadFromDesktop();

            if (!dropdownAppeared) {
                logger.log('[POST] No dropdown found, falling back to direct file input...');
                await this.uploadViaFileInput(videoPath);
            } else {
                // Dropdown was clicked, now wait for file chooser
                try {
                    const fileChooser = await this.page.waitForFileChooser({ timeout: 8000 });
                    await fileChooser.accept([videoPath]);
                    logger.success('[POST] ✅ Video uploaded via Scenario A dropdown → file chooser');
                } catch (e) {
                    await this.uploadViaFileInput(videoPath);
                }
            }
        }
    }

    /**
     * STEP 4B — Scenario B: Click "Add video" → dropdown → "Upload from desktop"
     */
    async uploadVideoScenarioB(videoPath) {
        logger.log('[POST] Scenario B: Clicking "Add video" dropdown...');

        try {
            // Click "Add video" button
            await clickElementByText(
                this.page,
                KW.ADD_VIDEO,
                'Add video',
                {
                    negativeKeywords: ['story', 'live', 'event', 'reel', 'photo'],
                    contextSelectors: ['nav', 'aside', '[role="navigation"]']
                }
            );

            logger.log('[POST] Waiting for dropdown to appear...');
            await this.page.waitForTimeout(1000);

            // Set up file chooser BEFORE clicking upload option
            const [fileChooser] = await Promise.all([
                this.page.waitForFileChooser({ timeout: 12000 }),
                this._tryClickUploadFromDesktop()
            ]);

            if (fileChooser) {
                logger.log(`[POST] Uploading: ${path.basename(videoPath)}`);
                await fileChooser.accept([videoPath]);
                logger.success('[POST] ✅ Video uploaded via Scenario B dropdown → file chooser');
            } else {
                throw new Error('File chooser did not appear after clicking upload option');
            }

        } catch (error) {
            logger.warn(`[POST] Scenario B failed: ${error.message}`);
            logger.log('[POST] Falling back to direct file input...');
            await this.uploadViaFileInput(videoPath);
        }
    }

    /**
     * Helper: Click "Upload from desktop" / "Upload from computer" in dropdown
     * @returns {Promise<boolean>} true if successfully clicked
     */
    async _tryClickUploadFromDesktop() {
        try {
            await clickElementByText(
                this.page,
                KW.UPLOAD_FROM_DESKTOP,
                'Upload from desktop',
                {
                    negativeKeywords: [],
                    contextSelectors: []
                }
            );
            logger.success('[POST] ✅ Clicked "Upload from desktop"');
            return true;
        } catch (e) {
            logger.warn(`[POST] Could not click upload option: ${e.message}`);
            return false;
        }
    }

    /**
     * Fallback: Upload via direct file input element
     */
    async uploadViaFileInput(videoPath) {
        try {
            logger.log('[POST] Scanning for file input elements...');
            await this.page.waitForTimeout(2000);

            // Try video-specific inputs first, then any file input
            const selectors = [
                'input[type="file"][accept*="video"]',
                'input[type="file"][accept*="mp4"]',
                'input[type="file"]'
            ];

            for (const sel of selectors) {
                const inputs = await this.page.$$(sel);
                if (inputs.length > 0) {
                    logger.log(`[POST] Found ${inputs.length} file input(s) via "${sel}", using last one`);
                    await inputs[inputs.length - 1].uploadFile(videoPath);
                    logger.success(`[POST] ✅ Video uploaded via file input (${sel})`);
                    return;
                }
            }

            throw new Error('No file input elements found on page');
        } catch (error) {
            logger.error(`[POST] File input upload failed: ${error.message}`);
            await this._saveDebugEvidence('file_input_failed');
            throw new Error(`All upload methods failed: ${error.message}`);
        }
    }

    /**
     * Wait for video upload to complete (progress indicator disappears)
     */
    async waitForVideoUploadComplete(timeoutSeconds = 300) {
        logger.log(`[POST] Monitoring upload progress (max ${timeoutSeconds}s)...`);
        const startTime = Date.now();
        const maxWaitMs = timeoutSeconds * 1000;
        let lastPct = -1;

        while (Date.now() - startTime < maxWaitMs) {
            try {
                const status = await this.page.evaluate(() => {
                    // Check for percentage text like "45%", "100%"
                    const spans = [...document.querySelectorAll('span, div')];
                    const pctEl = spans.find(el => /^\d+%$/.test((el.textContent || '').trim()));
                    if (pctEl) {
                        return { uploading: true, pct: parseInt(pctEl.textContent.trim()) };
                    }
                    // Check for progress bar
                    if (document.querySelector('[role="progressbar"]')) {
                        return { uploading: true, pct: null };
                    }
                    return { uploading: false, pct: null };
                });

                if (status.uploading) {
                    if (status.pct !== null && status.pct !== lastPct) {
                        logger.log(`[POST] Upload progress: ${status.pct}%`);
                        lastPct = status.pct;
                        if (status.pct >= 100) {
                            logger.success('[POST] Upload reached 100%!');
                            await this.page.waitForTimeout(3000);
                            return;
                        }
                    }
                } else {
                    logger.success('[POST] ✅ Upload complete (no progress indicator)');
                    return;
                }

                await this.page.waitForTimeout(1000);
            } catch (e) {
                await this.page.waitForTimeout(1000);
            }
        }

        logger.warn('[POST] Upload wait timed out — continuing anyway');
    }

    /**
     * STEP 5 — Insert caption into the post text area
     *
     * Strategy order:
     * 1. aria-label based selector (most reliable)
     * 2. role="textbox" contenteditable
     * 3. role="combobox" contenteditable
     * 4. any contenteditable div
     * 5. keyboard typing fallback
     */
    async insertCaption(caption) {
        try {
            logger.log('[POST] Inserting caption...');
            await this.page.waitForTimeout(2000);

            // USER: paste your caption selector here if you have one
            // e.g. 'div[contenteditable="true"][aria-label="Write something..."]'
            const CAPTION_SELECTOR = null; // ← SET THIS when you have the selector

            const selectorsToTry = [
                ...(CAPTION_SELECTOR ? [CAPTION_SELECTOR] : []),
                'div[contenteditable="true"][role="combobox"][aria-label*="dialogue"]',
                'div[contenteditable="true"][role="combobox"][aria-label*="Write"]',
                'div[contenteditable="true"][role="textbox"]',
                'div[contenteditable="true"][role="combobox"]',
                'div[contenteditable="true"]'
            ];

            for (const selector of selectorsToTry) {
                logger.log(`[POST] Trying caption selector: ${selector}`);

                try {
                    const el = await this.page.$(selector);
                    if (!el) continue;

                    // Check it's visible
                    const visible = await this.page.evaluate(el => {
                        const s = window.getComputedStyle(el);
                        const r = el.getBoundingClientRect();
                        return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0;
                    }, el);

                    if (!visible) continue;

                    // Click to focus
                    await el.click();
                    await this.page.waitForTimeout(300);

                    // Select all + delete existing content
                    await this.page.keyboard.down('Control');
                    await this.page.keyboard.press('a');
                    await this.page.keyboard.up('Control');
                    await this.page.keyboard.press('Backspace');
                    await this.page.waitForTimeout(200);

                    // Type caption with human-like delay
                    await this.page.keyboard.type(caption, { delay: 15 });

                    // Verify text appeared
                    const inserted = await this.page.evaluate((el, expected) => {
                        const actual = (el.innerText || el.textContent || '').trim();
                        return actual.length > 0 && actual.includes(expected.substring(0, 20));
                    }, el, caption);

                    if (inserted) {
                        logger.success(`[POST] ✅ Caption inserted via selector: ${selector}`);
                        return;
                    }

                    logger.warn(`[POST] Caption verification failed for: ${selector}`);
                } catch (selectorErr) {
                    logger.warn(`[POST] Selector "${selector}" failed: ${selectorErr.message}`);
                }
            }

            // Last resort: evaluate-based insertion
            logger.warn('[POST] All selectors failed, trying evaluate-based insertion...');
            const evalInserted = await this.page.evaluate((text) => {
                const el = document.querySelector('div[contenteditable="true"]');
                if (!el) return false;
                el.focus();
                el.innerText = text;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            }, caption);

            if (evalInserted) {
                logger.success('[POST] ✅ Caption inserted via evaluate fallback');
            } else {
                throw new Error('Could not find caption textarea');
            }

        } catch (error) {
            logger.error(`[POST] Failed to insert caption: ${error.message}`);
            await this._saveDebugEvidence('caption_failed');
            throw error;
        }
    }

    /**
     * STEP 6 — Detect whether Meta is in Reel mode (Share) or Post mode (Publish)
     *
     * Scans visible buttons for 'Share' or 'Publish' text after video upload.
     * Returns 'REEL' if Share button found, 'POST' otherwise.
     *
     * @returns {Promise<'REEL'|'POST'>}
     */
    async detectPublishMode() {
        try {
            logger.log('[POST] Scanning for Share / Publish button to detect mode...');
            await this.page.waitForTimeout(2000);

            const mode = await this.page.evaluate(() => {
                function getVisibleText(el) {
                    return (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
                }

                function isVisible(el) {
                    const s = window.getComputedStyle(el);
                    if (s.display === 'none' || s.visibility === 'hidden') return false;
                    if (parseFloat(s.opacity) === 0) return false;
                    const r = el.getBoundingClientRect();
                    return r.width > 0 && r.height > 0;
                }

                const seen = new Set();
                const labels = [];
                ['[role="button"]', 'button'].forEach(sel => {
                    document.querySelectorAll(sel).forEach(el => {
                        if (!seen.has(el) && isVisible(el)) {
                            seen.add(el);
                            labels.push(getVisibleText(el).toLowerCase());
                        }
                    });
                });

                // 'Share' as an exact / near-exact button label wins over 'Publish'
                const hasShare   = labels.some(t => t === 'share' || t === 'share reel' || t === 'share post');
                const hasPublish = labels.some(t => t === 'publish' || t === 'post');

                return { hasShare, hasPublish, labels };
            });

            logger.log(`[POST] detectPublishMode → hasShare=${mode.hasShare}, hasPublish=${mode.hasPublish}`);

            if (mode.hasShare) {
                return 'REEL';
            }
            // Default to POST (Publish button) if not ambiguous
            return 'POST';

        } catch (error) {
            logger.warn(`[POST] detectPublishMode failed: ${error.message} — defaulting to POST mode`);
            return 'POST';
        }
    }

    /**
     * STEP 6 (Reel branch) — Two-phase Share:
     *
     * Phase A: Click the navigation Share trigger at the top of the composer
     *          (plain div with id="js_es", text "Share" — NOT role="button").
     *          This navigates to the publish/review screen.
     *
     * Phase B: After the page transitions, click the FINAL Share button:
     *          <div role="button" aria-busy="false" tabindex="0">…Share…</div>
     *          This is the actual publish action.
     */
    async clickShare() {
        try {
            logger.log('[POST] clickShare — Phase A: clicking navigation Share trigger...');
            await this.page.waitForTimeout(2000);

            // ── PHASE A: Navigation Share ─────────────────────────────────────
            // The first Share button is NOT a role="button" — it's a plain div
            // identified by id="js_es" and/or visible text "Share" in the header.
            // We use a broad page.evaluate scan so we don't miss it with XPath.

            const phaseAClicked = await this.page.evaluate(() => {
                function visibleText(el) {
                    return (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
                }

                // Priority 1: exact id="js_es" (the known navigation Share element)
                const byId = document.getElementById('js_es');
                if (byId && visibleText(byId) === 'Share') {
                    // click the closest clickable ancestor
                    let target = byId;
                    while (target && target !== document.body) {
                        if (target.getAttribute('role') === 'button' || target.tagName === 'BUTTON') {
                            target.click(); return 'id=js_es (role parent)';
                        }
                        target = target.parentElement;
                    }
                    // No role=button ancestor found — click the element itself
                    byId.click(); return 'id=js_es (direct)';
                }

                // Priority 2: any visible div whose DIRECT text is exactly "Share"
                // but is NOT the final aria-busy=false publish button
                const allDivs = Array.from(document.querySelectorAll('div'));
                for (const div of allDivs) {
                    // Skip the final publish button (it already has role="button" + aria-busy)
                    if (div.getAttribute('role') === 'button' && div.getAttribute('aria-busy') === 'false') continue;

                    const text = (div.innerText || div.textContent || '').replace(/\s+/g, ' ').trim();
                    if (text === 'Share') {
                        div.click(); return 'plain div text=Share';
                    }
                }

                return null; // not found
            });

            if (phaseAClicked) {
                logger.success(`[POST] ✅ Phase A Share clicked (${phaseAClicked})`);
            } else {
                // Fallback: click ANY Share element including role=button ones;
                // phase B will handle the second click if needed.
                logger.warn('[POST] Phase A: broad scan failed, trying XPath contains...');
                try {
                    const [fallbackBtn] = await this.page.$x(`//div[contains(.,'Share')]`);
                    if (fallbackBtn) {
                        await fallbackBtn.click();
                        logger.success('[POST] ✅ Phase A Share clicked (XPath fallback)');
                    }
                } catch (e) {
                    logger.warn(`[POST] Phase A XPath fallback failed: ${e.message}`);
                }
            }

            // ── Wait for publish screen to load ───────────────────────────────
            logger.log('[POST] Phase A done — waiting 4s for publish screen to load...');
            await this.page.waitForTimeout(4000);

            // ── PHASE B: Final Publish Share button ───────────────────────────
            // This is the definitive button: role="button" + aria-busy="false"
            // Structure: div[role=button][aria-busy=false] > span > div > div > div[text=Share]

            logger.log('[POST] clickShare — Phase B: clicking final publish Share button...');
            let shareClicked = false;
            let strategy = '';

            // B-Strategy 1: XPath strict — role=button + aria-busy=false + text=Share
            try {
                const xpath1 = `//div[@role='button' and @aria-busy='false' and .//div[normalize-space(text())='Share']]`;
                const [btn1] = await this.page.$x(xpath1);
                if (btn1) {
                    await btn1.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
                    await this.page.waitForTimeout(500);
                    await btn1.hover();
                    await this.page.waitForTimeout(300);
                    await btn1.click();
                    shareClicked = true;
                    strategy = 'B-XPath (role+aria-busy+text)';
                    logger.success('[POST] ✅ Phase B Share clicked (B-Strategy 1)');
                }
            } catch (e) {
                logger.warn(`[POST] B-Strategy 1 failed: ${e.message}`);
            }

            // B-Strategy 2: XPath role=button + text (without aria-busy)
            if (!shareClicked) {
                try {
                    const xpath2 = `//div[@role='button' and .//div[normalize-space(text())='Share']]`;
                    const [btn2] = await this.page.$x(xpath2);
                    if (btn2) {
                        await btn2.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
                        await this.page.waitForTimeout(500);
                        await btn2.hover();
                        await this.page.waitForTimeout(300);
                        await btn2.click();
                        shareClicked = true;
                        strategy = 'B-XPath (role+text)';
                        logger.success('[POST] ✅ Phase B Share clicked (B-Strategy 2)');
                    }
                } catch (e) {
                    logger.warn(`[POST] B-Strategy 2 failed: ${e.message}`);
                }
            }

            // B-Strategy 3: page.evaluate — role=button + aria-busy=false + text=Share
            if (!shareClicked) {
                shareClicked = await this.page.evaluate(() => {
                    const buttons = Array.from(document.querySelectorAll('div[role="button"]'));
                    const btn = buttons.find(b => {
                        const busy = b.getAttribute('aria-busy');
                        const text = (b.textContent || '').replace(/\s+/g, ' ').trim();
                        return text === 'Share' && (busy === 'false' || busy === null);
                    });
                    if (btn) { btn.click(); return true; }
                    return false;
                });
                if (shareClicked) {
                    strategy = 'B-evaluate (role+text)';
                    logger.success('[POST] ✅ Phase B Share clicked (B-Strategy 3)');
                }
            }

            // B-Strategy 4: Nuclear engine
            if (!shareClicked) {
                try {
                    await clickElementByText(
                        this.page,
                        ['Share', 'Share reel', 'Share post'],
                        'Share',
                        { negativeKeywords: ['cancel', 'discard', 'delete', 'remove', 'schedule'] }
                    );
                    shareClicked = true;
                    strategy = 'B-nuclear engine';
                    logger.success('[POST] ✅ Phase B Share clicked (B-Strategy 4: nuclear)');
                } catch (e) {
                    logger.warn(`[POST] B-Strategy 4 failed: ${e.message}`);
                }
            }

            if (!shareClicked) {
                // Phase B might not be needed if Phase A already did the full publish (single-step Reel)
                logger.warn('[POST] Phase B: no second Share button found — Phase A may have been the final publish step');
            } else {
                await this.page.waitForTimeout(2000);
                logger.success(`[POST] Share completed. Strategy: ${strategy}`);
            }

        } catch (error) {
            logger.error(`[POST] Failed in clickShare: ${error.message}`);
            await this._saveDebugEvidence('share_failed');
            throw error;
        }
    }

    /**
     * STEP 6 (Post branch) — Click Publish button
     *
     * Uses nuclear engine with scoring to avoid clicking wrong buttons.
     * Falls back to XPath if nuclear engine fails.
     */
    async clickPublish() {
        try {
            logger.log('[POST] Clicking Publish button...');
            await this.page.waitForTimeout(2000);

            // USER: paste your publish button selector here if you have one
            const PUBLISH_SELECTOR = null; // ← SET THIS when you have the selector

            // Try exact selector first if provided
            if (PUBLISH_SELECTOR) {
                try {
                    await this.page.waitForSelector(PUBLISH_SELECTOR, { timeout: 5000 });
                    await this.page.click(PUBLISH_SELECTOR);
                    logger.success('[POST] ✅ Publish clicked via exact selector');
                    return;
                } catch (e) {
                    logger.warn(`[POST] Exact publish selector failed: ${e.message}`);
                }
            }

            // Nuclear engine — prefer exact "Publish" match, penalise "Post" (too generic)
            try {
                await clickElementByText(
                    this.page,
                    KW.PUBLISH,
                    'Publish',
                    {
                        negativeKeywords: ['cancel', 'discard', 'delete', 'remove', 'schedule'],
                        contextSelectors: ['nav', 'aside', '[role="navigation"]']
                    }
                );
                logger.success('[POST] ✅ Publish clicked via nuclear engine');
                return;
            } catch (nuclearErr) {
                logger.warn(`[POST] Nuclear engine failed for Publish: ${nuclearErr.message}`);
            }

            // XPath fallback
            try {
                const [btn] = await this.page.$x(
                    `//div[@role='button' and @aria-busy='false' and .//div[normalize-space(text())='Publish']]`
                );
                if (btn) {
                    await btn.click();
                    logger.success('[POST] ✅ Publish clicked via XPath');
                    return;
                }
            } catch (xpathErr) {
                logger.warn(`[POST] XPath fallback failed: ${xpathErr.message}`);
            }

            throw new Error('Could not find Publish button with any strategy');
        } catch (error) {
            logger.error(`[POST] Failed to click Publish: ${error.message}`);
            await this._saveDebugEvidence('publish_failed');
            throw error;
        }
    }

    /**
     * STEP 7 — Wait for post success confirmation
     */
    async waitForPostSuccess(timeoutSeconds = 120) {
        logger.log(`[POST] Waiting for post confirmation (max ${timeoutSeconds}s)...`);
        const startTime = Date.now();
        const maxWaitMs = timeoutSeconds * 1000;

        while (Date.now() - startTime < maxWaitMs) {
            try {
                const result = await this.page.evaluate(() => {
                    const text = (document.body.innerText || '').toLowerCase();
                    const successKeywords = [
                        'published', 'posted', 'your post is live',
                        'your post is now published', 'post successful', 'post shared'
                    ];
                    const errorKeywords = ['something went wrong', 'try again', 'error occurred'];

                    return {
                        success: successKeywords.some(k => text.includes(k)),
                        error: errorKeywords.some(k => text.includes(k))
                    };
                });

                if (result.success) {
                    logger.success('[POST] ✅ Post published successfully!');
                    return true;
                }

                if (result.error) {
                    throw new Error('Error detected on page after clicking Publish');
                }

                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                if (elapsed % 15 === 0) {
                    logger.log(`[POST] Still waiting for confirmation... (${elapsed}s)`);
                }

                await this.page.waitForTimeout(2000);
            } catch (error) {
                if (error.message.includes('Error detected')) throw error;
                await this.page.waitForTimeout(2000);
            }
        }

        // Timeout — log current URL and treat as possible success
        const currentUrl = this.page.url();
        logger.warn(`[POST] Confirmation timeout. Current URL: ${currentUrl}`);
        logger.warn('[POST] Treating as possible success and continuing...');
        return false;
    }

    // ═══════════════════════════════════════════════════════════
    // DEBUG HELPERS
    // ═══════════════════════════════════════════════════════════

    /**
     * Save screenshot + HTML to debug folder on failure
     */
    async _saveDebugEvidence(label) {
        try {
            const debugDir = getDebugPath();
            if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });

            const ts = new Date().toISOString().replace(/[:.]/g, '-');
            const base = `post_${label}_${ts}`;

            const ssPath = path.join(debugDir, `${base}.png`);
            await this.page.screenshot({ path: ssPath, fullPage: true });
            logger.error(`[POST DEBUG] Screenshot: ${ssPath}`);

            const htmlPath = path.join(debugDir, `${base}.html`);
            const html = await this.page.content();
            fs.writeFileSync(htmlPath, html, 'utf8');
            logger.error(`[POST DEBUG] HTML dump: ${htmlPath}`);
        } catch (dbgErr) {
            logger.warn(`[POST DEBUG] Could not save debug evidence: ${dbgErr.message}`);
        }
    }
}

module.exports = MetaPostUploader;
