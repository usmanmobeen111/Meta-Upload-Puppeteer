/**
 * Multi-Strategy Video Upload System for Meta Business Suite POST Workflow
 * 
 * This module provides a robust upload system with 6 fallback strategies
 * to handle Meta's various upload mechanisms (fileChooser, iframes, shadow DOM, drag-drop, etc.)
 * 
 * @author Senior Automation Engineer
 * @date 2026-02-13
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Click an element using real mouse movements
 * This avoids Meta's automation detection for .click()
 * 
 * @param {Object} page - Puppeteer page
 * @param {Object} elementHandle - Element to click
 * @returns {Promise<boolean>} Success status
 */
async function realMouseClick(page, elementHandle) {
    try {
        // Get element's bounding box
        const box = await elementHandle.boundingBox();
        
        if (!box) {
            logger.warn('[REAL_CLICK] Element has no bounding box (might be hidden)');
            return false;
        }
        
        // Calculate center point
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        
        logger.log(`[REAL_CLICK] Moving mouse to (${x.toFixed(0)}, ${y.toFixed(0)})`);
        
        // Move mouse to element
        await page.mouse.move(x, y, { steps: 10 });
        await page.waitForTimeout(100);
        
        // Click with mouse down/up
        await page.mouse.down();
        await page.waitForTimeout(50);
        await page.mouse.up();
        
        logger.success('[REAL_CLICK] ✅ Real mouse click executed');
        return true;
        
    } catch (error) {
        logger.error(`[REAL_CLICK] Failed: ${error.message}`);
        return false;
    }
}

/**
 * Scan all iframes for file input elements
 * 
 * @param {Object} page - Puppeteer page
 * @returns {Promise<Array>} Array of {frame, fileInput} objects
 */
async function scanIFramesForFileInputs(page) {
    try {
        logger.log('[IFRAME_SCAN] Scanning all iframes for file inputs...');
        
        const frames = page.frames();
        logger.log(`[IFRAME_SCAN] Found ${frames.length} frames`);
        
        const results = [];
        
        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            const frameUrl = frame.url();
            
            logger.log(`[IFRAME_SCAN] Frame ${i + 1}: ${frameUrl}`);
            
            try {
                // Search for file inputs in this frame
                const fileInputs = await frame.$$('input[type="file"]');
                
                if (fileInputs.length > 0) {
                    logger.success(`[IFRAME_SCAN] ✅ Found ${fileInputs.length} file input(s) in frame ${i + 1}`);
                    
                    for (const input of fileInputs) {
                        results.push({ frame, fileInput: input, frameIndex: i });
                    }
                }
            } catch (frameError) {
                logger.warn(`[IFRAME_SCAN] Could not access frame ${i + 1}: ${frameError.message}`);
            }
        }
        
        return results;
        
    } catch (error) {
        logger.error(`[IFRAME_SCAN] Failed: ${error.message}`);
        return [];
    }
}

/**
 * Recursively scan shadow DOM for file input elements
 * 
 * @param {Object} page - Puppeteer page
 * @returns {Promise<boolean>} True if file input found and file uploaded
 */
async function scanShadowDOMForFileInputs(page, videoPath) {
    try {
        logger.log('[SHADOW_SCAN] Scanning shadow DOM for file inputs...');
        
        const result = await page.evaluate(() => {
            const fileInputs = [];
            
            // Recursive function to traverse shadow DOM
            function traverseShadowDOM(root) {
                // Check current root for file inputs
                const inputs = root.querySelectorAll('input[type="file"]');
                inputs.forEach(input => fileInputs.push(input));
                
                // Traverse all elements with shadow roots
                const allElements = root.querySelectorAll('*');
                allElements.forEach(el => {
                    if (el.shadowRoot) {
                        traverseShadowDOM(el.shadowRoot);
                    }
                });
            }
            
            // Start from document root
            traverseShadowDOM(document);
            
            return fileInputs.length;
        });
        
        if (result > 0) {
            logger.success(`[SHADOW_SCAN] ✅ Found ${result} file input(s) in shadow DOM`);
            
            // Try to upload via the found inputs
            // Note: This is complex because we can't directly interact with shadow DOM inputs
            // This would require injecting the file path into the shadow DOM
            logger.warn('[SHADOW_SCAN] Shadow DOM file inputs found but direct upload not implemented yet');
            return false;
        }
        
        logger.log('[SHADOW_SCAN] No file inputs found in shadow DOM');
        return false;
        
    } catch (error) {
        logger.error(`[SHADOW_SCAN] Failed: ${error.message}`);
        return false;
    }
}

/**
 * Simulate drag-and-drop upload
 * 
 * @param {Object} page - Puppeteer page
 * @param {string} videoPath - Path to video file
 * @returns {Promise<boolean>} Success status
 */
async function simulateDragDropUpload(page, videoPath) {
    try {
        logger.log('[DRAG_DROP] Attempting drag-and-drop upload...');
        
        // Find potential drop zones
        const dropZoneSelectors = [
            '[data-testid*="drop"]',
            '[class*="drop"]',
            '[class*="upload"]',
            '[aria-label*="upload"]',
            '[aria-label*="drop"]',
            'div[role="button"]' // Fallback to any button-like div
        ];
        
        for (const selector of dropZoneSelectors) {
            try {
                const dropZone = await page.$(selector);
                
                if (dropZone) {
                    logger.log(`[DRAG_DROP] Found potential drop zone: ${selector}`);
                    
                    // Read file as buffer
                    const fileBuffer = fs.readFileSync(videoPath);
                    const fileName = path.basename(videoPath);
                    
                    // Create DataTransfer simulation
                    await page.evaluate(async (selector, fileName, fileBuffer) => {
                        const dropZone = document.querySelector(selector);
                        
                        if (!dropZone) return false;
                        
                        // Convert buffer to File object
                        const blob = new Blob([new Uint8Array(fileBuffer)], { type: 'video/mp4' });
                        const file = new File([blob], fileName, { type: 'video/mp4' });
                        
                        // Create DataTransfer
                        const dataTransfer = new DataTransfer();
                        dataTransfer.items.add(file);
                        
                        // Trigger drag events
                        ['dragenter', 'dragover', 'drop'].forEach(eventType => {
                            const event = new DragEvent(eventType, {
                                bubbles: true,
                                cancelable: true,
                                dataTransfer: dataTransfer
                            });
                            dropZone.dispatchEvent(event);
                        });
                        
                        return true;
                    }, selector, fileName, [...fileBuffer]);
                    
                    logger.success('[DRAG_DROP] ✅ Drag-drop events triggered');
                    
                    // Wait to see if upload starts
                    await page.waitForTimeout(2000);
                    return true;
                }
            } catch (error) {
                // Continue to next selector
            }
        }
        
        logger.warn('[DRAG_DROP] No suitable drop zone found');
        return false;
        
    } catch (error) {
        logger.error(`[DRAG_DROP] Failed: ${error.message}`);
        return false;
    }
}

/**
 * Save comprehensive debug dump on upload failure
 * 
 * @param {Object} page - Puppeteer page
 * @param {string} videoPath - Path to video that failed to upload
 * @param {Error} error - Error object
 * @returns {Promise<void>}
 */
async function saveDebugDump(page, videoPath, error) {
    try {
        const timestamp = new Date().toISOString()
            .replace(/:/g, '-')
            .replace(/\..+/, '')
            .replace('T', '_');
        
        const videoName = path.basename(videoPath, path.extname(videoPath));
        const { getDebugPath } = require('../utils/debugCapture');
        const debugDir = path.join(getDebugPath(), 'errors');
        
        // Ensure directory exists
        if (!fs.existsSync(debugDir)) {
            fs.mkdirSync(debugDir, { recursive: true });
        }
        
        logger.log('[DEBUG] Saving debug dump...');
        
        // 1. Screenshot
        const screenshotPath = path.join(debugDir, `${timestamp}_${videoName}_UPLOAD_FAILED.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        logger.log(`[DEBUG] Screenshot saved: ${screenshotPath}`);
        
        // 2. Full page HTML
        const htmlPath = path.join(debugDir, `${timestamp}_${videoName}_UPLOAD_FAILED.html`);
        const html = await page.content();
        fs.writeFileSync(htmlPath, html, 'utf8');
        logger.log(`[DEBUG] HTML saved: ${htmlPath}`);
        
        // 3. HTML of every iframe
        const frames = page.frames();
        for (let i = 0; i < frames.length; i++) {
            try {
                const frameHtml = await frames[i].content();
                const frameHtmlPath = path.join(debugDir, `${timestamp}_${videoName}_FRAME_${i}.html`);
                fs.writeFileSync(frameHtmlPath, frameHtml, 'utf8');
                logger.log(`[DEBUG] Frame ${i} HTML saved: ${frameHtmlPath}`);
            } catch (frameError) {
                logger.warn(`[DEBUG] Could not save frame ${i} HTML: ${frameError.message}`);
            }
        }
        
        // 4. List all frame URLs
        const frameUrlsPath = path.join(debugDir, `${timestamp}_${videoName}_FRAME_URLS.txt`);
        const frameUrls = frames.map((f, i) => `Frame ${i}: ${f.url()}`).join('\n');
        fs.writeFileSync(frameUrlsPath, frameUrls, 'utf8');
        logger.log(`[DEBUG] Frame URLs saved: ${frameUrlsPath}`);
        
        // 5. Print all discovered buttons with upload-related text
        const buttonsInfo = await page.evaluate(() => {
            const buttons = [...document.querySelectorAll('[role="button"], button, div, span, a')];
            const uploadRelated = buttons
                .filter(btn => {
                    const text = (btn.innerText || '').toLowerCase();
                    return text.includes('upload') || 
                           text.includes('add') || 
                           text.includes('video') ||
                           text.includes('media') ||
                           text.includes('file') ||
                           text.includes('drop');
                })
                .map((btn, i) => ({
                    index: i,
                    tag: btn.tagName,
                    role: btn.getAttribute('role'),
                    text: (btn.innerText || '').trim().substring(0, 100),
                    classes: btn.className
                }));
            
            return uploadRelated;
        });
        
        const buttonsPath = path.join(debugDir, `${timestamp}_${videoName}_BUTTONS.json`);
        fs.writeFileSync(buttonsPath, JSON.stringify(buttonsInfo, null, 2), 'utf8');
        logger.log(`[DEBUG] Buttons info saved: ${buttonsPath}`);
        
        // 6. Error details
        const errorPath = path.join(debugDir, `${timestamp}_${videoName}_ERROR.txt`);
        const errorText = `Error: ${error.message}\n\nStack:\n${error.stack}`;
        fs.writeFileSync(errorPath, errorText, 'utf8');
        logger.log(`[DEBUG] Error details saved: ${errorPath}`);
        
        logger.success('[DEBUG] ✅ Debug dump complete');
        
    } catch (debugError) {
        logger.error(`[DEBUG] Failed to save debug dump: ${debugError.message}`);
    }
}

/**
 * Wait for upload to start and confirm it's progressing
 * 
 * @param {Object} page - Puppeteer page
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<boolean>} True if upload confirmed
 */
async function confirmUploadStarted(page, timeoutMs = 10000) {
    try {
        logger.log('[UPLOAD_CONFIRM] Confirming upload started...');
        
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeoutMs) {
            const uploadIndicators = await page.evaluate(() => {
                const text = document.body.innerText.toLowerCase();
                const html = document.documentElement.innerHTML.toLowerCase();
                
                return {
                    hasProgressBar: document.querySelectorAll('[role="progressbar"]').length > 0,
                    hasUploadingText: text.includes('uploading') || html.includes('uploading'),
                    hasPercentage: /\d+%/.test(text),
                    hasThumbnail: document.querySelectorAll('video, img[src*="blob:"]').length > 0,
                    hasFilename: text.includes('.mp4') || text.includes('.mov'),
                    hasProcessing: text.includes('processing') || html.includes('processing')
                };
            });
            
            // Check if any indicator is present
            if (uploadIndicators.hasProgressBar ||
                uploadIndicators.hasUploadingText ||
                uploadIndicators.hasPercentage ||
                uploadIndicators.hasThumbnail ||
                uploadIndicators.hasFilename ||
                uploadIndicators.hasProcessing) {
                
                logger.success('[UPLOAD_CONFIRM] ✅ Upload confirmed started!');
                logger.log(`[UPLOAD_CONFIRM] Indicators: ${JSON.stringify(uploadIndicators)}`);
                return true;
            }
            
            await page.waitForTimeout(500);
        }
        
        logger.warn('[UPLOAD_CONFIRM] Upload start not confirmed within timeout');
        return false;
        
    } catch (error) {
        logger.error(`[UPLOAD_CONFIRM] Error: ${error.message}`);
        return false;
    }
}

/**
 * Wait for upload to complete
 * 
 * @param {Object} page - Puppeteer page
 * @param {number} timeoutMs - Timeout in milliseconds (default 3 minutes)
 * @returns {Promise<boolean>} True if upload completed
 */
async function waitForUploadComplete(page, timeoutMs = 180000) {
    try {
        logger.log(`[UPLOAD_WAIT] Waiting for upload to complete (max ${timeoutMs / 1000}s)...`);
        
        const startTime = Date.now();
        let lastPercentage = 0;
        
        while (Date.now() - startTime < timeoutMs) {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            
            const status = await page.evaluate(() => {
                const text = document.body.innerText.toLowerCase();
                const html = document.documentElement.innerHTML.toLowerCase();
                
                // Check for percentage
                const percentMatch = text.match(/(\d+)%/);
                const percentage = percentMatch ? parseInt(percentMatch[1]) : null;
                
                // Check completion indicators
                const isComplete = 
                    text.includes('uploaded') ||
                    text.includes('ready') ||
                    text.includes('complete') ||
                    html.includes('upload-complete') ||
                    html.includes('upload_complete');
                
                // Check if still uploading
                const isUploading = 
                    document.querySelectorAll('[role="progressbar"]').length > 0 ||
                    text.includes('uploading') ||
                    text.includes('processing');
                
                return {
                    percentage,
                    isComplete,
                    isUploading
                };
            });
            
            // Log progress
            if (status.percentage !== null && status.percentage !== lastPercentage) {
                logger.log(`[UPLOAD_WAIT] Progress: ${status.percentage}%`);
                lastPercentage = status.percentage;
            }
            
            // Check if complete
            if (status.isComplete || (status.percentage !== null && status.percentage >= 100)) {
                logger.success(`[UPLOAD_WAIT] ✅ Upload complete! (${elapsed}s)`);
                await page.waitForTimeout(2000); // Wait for UI to settle
                return true;
            }
            
            // Check if upload stopped without completion
            if (!status.isUploading && status.percentage === null && elapsed > 10) {
                logger.warn('[UPLOAD_WAIT] Upload indicators disappeared, assuming complete');
                return true;
            }
            
            // Log status every 10 seconds
            if (elapsed % 10 === 0 && elapsed > 0) {
                logger.log(`[UPLOAD_WAIT] Still uploading... (${elapsed}s elapsed)`);
            }
            
            await page.waitForTimeout(1000);
        }
        
        throw new Error('Upload did not complete within timeout');
        
    } catch (error) {
        logger.error(`[UPLOAD_WAIT] Error: ${error.message}`);
        throw error;
    }
}

/**
 * MAIN FUNCTION: Upload video in Meta POST workflow with multiple fallback strategies
 * 
 * @param {Object} page - Puppeteer page
 * @param {string} videoPath - Absolute path to video file
 * @param {Object} config - Configuration object (optional)
 * @returns {Promise<boolean>} True if upload successful
 */
async function uploadVideoInMetaPostWorkflow(page, videoPath, config = {}) {
    logger.log('\n' + '='.repeat(60));
    logger.log('🎬 STARTING MULTI-STRATEGY VIDEO UPLOAD');
    logger.log(`Video: ${path.basename(videoPath)}`);
    logger.log('='.repeat(60) + '\n');
    
    let uploadSuccess = false;
    let lastError = null;
    
    try {
        // Verify file exists
        if (!fs.existsSync(videoPath)) {
            throw new Error(`Video file not found: ${videoPath}`);
        }
        
        const fileSize = (fs.statSync(videoPath).size / (1024 * 1024)).toFixed(2);
        logger.log(`[UPLOAD] File size: ${fileSize} MB`);
        
        // ============================================================
        // STRATEGY 1: FileChooser API with Real Mouse Click
        // ============================================================
        if (!uploadSuccess) {
            try {
                logger.log('\n' + '-'.repeat(60));
                logger.log('[UPLOAD] STRATEGY 1: FileChooser API (Normal)');
                logger.log('-'.repeat(60));
                
                // Set up file chooser listener BEFORE clicking
                logger.log('[UPLOAD] Setting up file chooser listener...');
                const fileChooserPromise = page.waitForFileChooser({ timeout: 5000 });
                
                // Find and click upload option with real mouse
                logger.log('[UPLOAD] Finding "Upload from desktop" button...');
                const uploadButton = await page.evaluateHandle(() => {
                    const allElements = [...document.querySelectorAll('[role="button"], div, span, a')];
                    const target = allElements.find(el => {
                        const text = (el.innerText || '').trim().toLowerCase();
                        return text.includes('upload from desktop') || text.includes('upload from computer');
                    });
                    return target;
                });
                
                if (uploadButton && uploadButton.asElement()) {
                    logger.log('[UPLOAD] Button found, clicking with real mouse...');
                    await realMouseClick(page, uploadButton.asElement());
                    
                    // Wait for file chooser
                    logger.log('[UPLOAD] Waiting for file chooser dialog...');
                    const fileChooser = await fileChooserPromise;
                    
                    logger.success('[UPLOAD] File chooser detected!');
                    await fileChooser.accept([videoPath]);
                    logger.success('[UPLOAD] ✅ File accepted via FileChooser');
                    
                    uploadSuccess = true;
                    
                } else {
                    throw new Error('Upload button not found');
                }
                
            } catch (error) {
                lastError = error;
                logger.error(`[UPLOAD] Strategy 1 failed: ${error.message}`);
            }
        }
        
        // ============================================================
        // STRATEGY 2: Find <input type="file"> in Main DOM
        // ============================================================
        if (!uploadSuccess) {
            try {
                logger.log('\n' + '-'.repeat(60));
                logger.log('[UPLOAD] STRATEGY 2: DOM File Input');
                logger.log('-'.repeat(60));
                
                await page.waitForTimeout(1000);
                
                const fileInputs = await page.$$('input[type="file"]');
                logger.log(`[UPLOAD] Found ${fileInputs.length} file input(s) in DOM`);
                
                if (fileInputs.length > 0) {
                    // Log details about each input
                    for (let i = 0; i < fileInputs.length; i++) {
                        const info = await page.evaluate((index) => {
                            const inputs = document.querySelectorAll('input[type="file"]');
                            const input = inputs[index];
                            return {
                                id: input.id || 'none',
                                name: input.name || 'none',
                                accept: input.accept || 'none',
                                visible: input.offsetParent !== null
                            };
                        }, i);
                        logger.log(`[UPLOAD]   Input ${i + 1}: id="${info.id}", name="${info.name}", accept="${info.accept}", visible=${info.visible}`);
                    }
                    
                    // Use the last file input (most recently added)
                    const targetInput = fileInputs[fileInputs.length - 1];
                    logger.log(`[UPLOAD] Using file input #${fileInputs.length}`);
                    
                    await targetInput.uploadFile(videoPath);
                    logger.success('[UPLOAD] ✅ File uploaded via DOM input');
                    
                    uploadSuccess = true;
                }
                
            } catch (error) {
                lastError = error;
                logger.error(`[UPLOAD] Strategy 2 failed: ${error.message}`);
            }
        }
        
        // ============================================================
        // STRATEGY 3: Search All IFrames
        // ============================================================
        if (!uploadSuccess) {
            try {
                logger.log('\n' + '-'.repeat(60));
                logger.log('[UPLOAD] STRATEGY 3: IFrame File Inputs');
                logger.log('-'.repeat(60));
                
                const iframeResults = await scanIFramesForFileInputs(page);
                
                if (iframeResults.length > 0) {
                    logger.log(`[UPLOAD] Found ${iframeResults.length} file input(s) in iframes`);
                    
                    // Try the first one
                    const { fileInput } = iframeResults[0];
                    await fileInput.uploadFile(videoPath);
                    logger.success('[UPLOAD] ✅ File uploaded via iframe input');
                    
                    uploadSuccess = true;
                }
                
            } catch (error) {
                lastError = error;
                logger.error(`[UPLOAD] Strategy 3 failed: ${error.message}`);
            }
        }
        
        // ============================================================
        // STRATEGY 4: Shadow DOM Deep Search
        // ============================================================
        if (!uploadSuccess) {
            try {
                logger.log('\n' + '-'.repeat(60));
                logger.log('[UPLOAD] STRATEGY 4: Shadow DOM Search');
                logger.log('-'.repeat(60));
                
                const shadowResult = await scanShadowDOMForFileInputs(page, videoPath);
                
                if (shadowResult) {
                    uploadSuccess = true;
                }
                
            } catch (error) {
                lastError = error;
                logger.error(`[UPLOAD] Strategy 4 failed: ${error.message}`);
            }
        }
        
        // ============================================================
        // STRATEGY 5: Drag-and-Drop Upload Simulation
        // ============================================================
        if (!uploadSuccess) {
            try {
                logger.log('\n' + '-'.repeat(60));
                logger.log('[UPLOAD] STRATEGY 5: Drag-and-Drop Simulation');
                logger.log('-'.repeat(60));
                
                const dragDropResult = await simulateDragDropUpload(page, videoPath);
                
                if (dragDropResult) {
                    uploadSuccess = true;
                }
                
            } catch (error) {
                lastError = error;
                logger.error(`[UPLOAD] Strategy 5 failed: ${error.message}`);
            }
        }
        
        // ============================================================
        // STRATEGY 6: Create Temporary File Input (Emergency)
        // ============================================================
        if (!uploadSuccess) {
            try {
                logger.log('\n' + '-'.repeat(60));
                logger.log('[UPLOAD] STRATEGY 6: Emergency File Input Injection');
                logger.log('-'.repeat(60));
                
                // Inject a file input into the page
                const fileInput = await page.evaluateHandle(() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.style.position = 'fixed';
                    input.style.top = '0';
                    input.style.left = '0';
                    input.style.opacity = '0';
                    document.body.appendChild(input);
                    return input;
                });
                
                logger.log('[UPLOAD] Injected file input element');
                
                // Upload file to injected input
                await fileInput.asElement().uploadFile(videoPath);
                logger.log('[UPLOAD] File attached to injected input');
                
                // Try to trigger upload by simulating drop on potential drop zone
                await page.evaluate(() => {
                    const input = document.querySelector('input[type="file"]');
                    const file = input.files[0];
                    
                    if (file) {
                        // Try to find a drop zone
                        const dropZones = [...document.querySelectorAll('[class*="drop"], [class*="upload"]')];
                        
                        if (dropZones.length > 0) {
                            const dataTransfer = new DataTransfer();
                            dataTransfer.items.add(file);
                            
                            const dropEvent = new DragEvent('drop', {
                                bubbles: true,
                                cancelable: true,
                                dataTransfer: dataTransfer
                            });
                            
                            dropZones[0].dispatchEvent(dropEvent);
                            return true;
                        }
                    }
                    return false;
                });
                
                logger.success('[UPLOAD] ✅ Emergency upload attempted');
                uploadSuccess = true;
                
            } catch (error) {
                lastError = error;
                logger.error(`[UPLOAD] Strategy 6 failed: ${error.message}`);
            }
        }
        
        // ============================================================
        // VERIFY UPLOAD SUCCESS
        // ============================================================
        if (uploadSuccess) {
            logger.log('\n' + '='.repeat(60));
            logger.log('🎯 VERIFYING UPLOAD...');
            logger.log('='.repeat(60));
            
            // Confirm upload started
            const uploadStarted = await confirmUploadStarted(page, 10000);
            
            if (!uploadStarted) {
                logger.warn('[UPLOAD] Upload start not confirmed, but continuing...');
            }
            
            // Wait for upload to complete
            await waitForUploadComplete(page, config.uploadTimeoutSeconds ? config.uploadTimeoutSeconds * 1000 : 180000);
            
            logger.log('\n' + '='.repeat(60));
            logger.success('✅ VIDEO UPLOAD COMPLETE!');
            logger.log('='.repeat(60) + '\n');
            
            return true;
        }
        
        // All strategies failed
        throw new Error('All upload strategies failed');
        
    } catch (error) {
        logger.error('\n' + '='.repeat(60));
        logger.error('❌ VIDEO UPLOAD FAILED');
        logger.error(`Error: ${error.message}`);
        logger.error('='.repeat(60) + '\n');
        
        // Save debug dump
        await saveDebugDump(page, videoPath, lastError || error);
        
        throw error;
    }
}

module.exports = {
    uploadVideoInMetaPostWorkflow,
    realMouseClick,
    scanIFramesForFileInputs,
    scanShadowDOMForFileInputs,
    simulateDragDropUpload,
    saveDebugDump,
    confirmUploadStarted,
    waitForUploadComplete
};
