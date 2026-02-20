/**
 * Caption Handler for Meta Business Suite
 * Handles React-controlled caption inputs with proper state updates
 */

const logger = require('../utils/logger');

/**
 * Find the correct caption textbox on the page
 * Tries multiple strategies to avoid selecting the wrong textbox
 * @param {Page} page - Puppeteer page instance
 * @returns {Promise<ElementHandle|null>} Caption textbox element or null
 */
async function findCaptionTextbox(page) {
    try {
        logger.log('[CAPTION] Searching for caption textbox...');

        // Strategy 1: Find textbox with caption-related aria-label or placeholder
        logger.log('[CAPTION] Strategy 1: Looking for textbox with caption-related attributes...');
        const captionBox1 = await page.evaluateHandle(() => {
            const textboxes = Array.from(document.querySelectorAll('div[role="textbox"][contenteditable="true"]'));

            // Look for textbox with caption-related hints
            for (const box of textboxes) {
                const ariaLabel = (box.getAttribute('aria-label') || '').toLowerCase();
                const placeholder = (box.getAttribute('placeholder') || '').toLowerCase();
                const dataText = (box.getAttribute('data-text') || '').toLowerCase();

                if (ariaLabel.includes('caption') ||
                    placeholder.includes('caption') ||
                    dataText.includes('caption') ||
                    ariaLabel.includes('write') ||
                    placeholder.includes('write')) {
                    return box;
                }
            }

            // Look for textbox near "Caption" label
            const labels = Array.from(document.querySelectorAll('label, span, div'));
            for (const label of labels) {
                const text = (label.textContent || '').trim();
                if (text === 'Caption' || text.includes('Add a caption') || text.includes('Write a caption')) {
                    // Find nearest textbox
                    let parent = label.parentElement;
                    for (let i = 0; i < 5 && parent; i++) {
                        const nearbyBox = parent.querySelector('div[role="textbox"][contenteditable="true"]');
                        if (nearbyBox) return nearbyBox;
                        parent = parent.parentElement;
                    }
                }
            }

            return null;
        });

        if (captionBox1 && (await captionBox1.asElement())) {
            logger.success('[CAPTION] Found caption textbox (Strategy 1: attribute/label match)');
            return captionBox1.asElement();
        }

        // Strategy 2: Find the specific selector known to work for Meta reels
        logger.log('[CAPTION] Strategy 2: Using known Meta reels selector...');
        try {
            const captionBox2 = await page.$('div._5rpu[contenteditable="true"][role="textbox"]');
            if (captionBox2) {
                logger.success('[CAPTION] Found caption textbox (Strategy 2: known selector)');
                return captionBox2;
            }
        } catch (e) {
            logger.warn(`[CAPTION] Strategy 2 failed: ${e.message}`);
        }

        // Strategy 3: Find the largest contenteditable textbox (caption is usually large)
        logger.log('[CAPTION] Strategy 3: Finding largest contenteditable textbox...');
        const captionBox3 = await page.evaluateHandle(() => {
            const textboxes = Array.from(document.querySelectorAll('div[contenteditable="true"]'));

            if (textboxes.length === 0) return null;
            if (textboxes.length === 1) return textboxes[0];

            // Find the one with largest height (caption box is usually taller)
            let largest = textboxes[0];
            let maxHeight = 0;

            for (const box of textboxes) {
                const rect = box.getBoundingClientRect();
                if (rect.height > maxHeight) {
                    maxHeight = rect.height;
                    largest = box;
                }
            }

            return largest;
        });

        if (captionBox3 && (await captionBox3.asElement())) {
            logger.success('[CAPTION] Found caption textbox (Strategy 3: largest textbox)');
            return captionBox3.asElement();
        }

        // Strategy 4: Fallback to any contenteditable div
        logger.log('[CAPTION] Strategy 4: Fallback to any contenteditable...');
        const captionBox4 = await page.$('div[contenteditable="true"]');
        if (captionBox4) {
            logger.success('[CAPTION] Found caption textbox (Strategy 4: fallback)');
            return captionBox4;
        }

        logger.error('[CAPTION] Could not find caption textbox with any strategy');
        return null;

    } catch (error) {
        logger.error(`[CAPTION] Error finding caption textbox: ${error.message}`);
        return null;
    }
}

/**
 * Clear existing caption text from textbox
 * @param {Page} page - Puppeteer page instance
 * @param {ElementHandle} textbox - Caption textbox element
 */
async function clearCaption(page, textbox) {
    try {
        logger.log('[CAPTION] Clearing existing caption...');

        // Click textbox to focus
        await textbox.click();
        await page.waitForTimeout(300);

        // Select all text
        await page.keyboard.down('Control');
        await page.keyboard.press('a');
        await page.keyboard.up('Control');
        await page.waitForTimeout(200);

        // Delete selected text
        await page.keyboard.press('Backspace');
        await page.waitForTimeout(300);

        // Verify it's empty
        const isEmpty = await page.evaluate((el) => {
            const text = el.innerText || el.textContent || '';
            return text.trim().length === 0;
        }, textbox);

        if (isEmpty) {
            logger.success('[CAPTION] Caption cleared successfully');
        } else {
            logger.warn('[CAPTION] Caption may not be fully cleared');
        }

    } catch (error) {
        logger.error(`[CAPTION] Error clearing caption: ${error.message}`);
        throw error;
    }
}

/**
 * Insert caption text using clipboard paste with proper React event triggering
 * This method is MORE RELIABLE than character-by-character typing, especially with emojis
 * @param {Page} page - Puppeteer page instance
 * @param {ElementHandle} textbox - Caption textbox element
 * @param {string} captionText - Caption to insert
 */
async function insertCaptionText(page, textbox, captionText) {
    try {
        logger.log('[CAPTION] Inserting caption text via clipboard paste...');

        // Focus the textbox
        await textbox.click();
        await page.waitForTimeout(500);

        // Method 1: Use CDP (Chrome DevTools Protocol) to set clipboard and paste
        logger.log('[CAPTION] Setting clipboard content...');
        try {
            // Get CDP session
            const client = await page.target().createCDPSession();
            
            // Grant clipboard permissions
            await client.send('Browser.grantPermissions', {
                permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
                origin: page.url()
            });

            // Write text to clipboard via CDP
            await page.evaluate((text) => {
                return navigator.clipboard.writeText(text);
            }, captionText);
            
            await page.waitForTimeout(300);
            logger.success('[CAPTION] Clipboard content set successfully');

            // Paste using Ctrl+V
            logger.log('[CAPTION] Pasting via Ctrl+V...');
            await page.keyboard.down('Control');
            await page.keyboard.press('v');
            await page.keyboard.up('Control');
            await page.waitForTimeout(500);

        } catch (clipboardError) {
            logger.warn(`[CAPTION] Clipboard method failed: ${clipboardError.message}`);
            logger.log('[CAPTION] Falling back to direct DOM manipulation...');
            
            // Fallback: Direct DOM insertion with React event triggering
            await page.evaluate((el, text) => {
                // Set text content directly
                el.innerText = text;
                el.textContent = text;
                
                // Try to update React fiber if exists
                const reactKey = Object.keys(el).find(key => key.startsWith('__react'));
                if (reactKey) {
                    const reactProps = el[reactKey];
                    if (reactProps && reactProps.memoizedProps) {
                        reactProps.memoizedProps.value = text;
                    }
                }
            }, textbox, captionText);
            
            await page.waitForTimeout(300);
        }

        // CRITICAL: Trigger ALL React events to ensure state updates
        logger.log('[CAPTION] Triggering React state update events...');
        await page.evaluate((el, text) => {
            // Fire InputEvent (most important for React)
            el.dispatchEvent(new InputEvent('input', { 
                bubbles: true, 
                cancelable: true, 
                inputType: 'insertText',
                data: text 
            }));

            // Fire generic input event
            el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));

            // Fire change event
            el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

            // Fire keyup event to simulate typing completion
            el.dispatchEvent(new KeyboardEvent('keyup', { 
                bubbles: true, 
                cancelable: true,
                key: 'v',
                code: 'KeyV',
                ctrlKey: true
            }));

            // Update data attributes if they exist (React might use these)
            if (el.hasAttribute('data-text')) {
                el.setAttribute('data-text', text);
            }
            if (el.hasAttribute('aria-label')) {
                // Some React components track state via aria-label
                const currentLabel = el.getAttribute('aria-label');
                if (currentLabel && currentLabel.toLowerCase().includes('empty')) {
                    el.setAttribute('aria-label', currentLabel.replace(/empty/gi, 'filled'));
                }
            }
        }, textbox, captionText);

        await page.waitForTimeout(500);

        // COMMIT TRIGGER: Press Space then Backspace to force React state commit
        logger.log('[CAPTION] Applying commit trigger (Space + Backspace)...');
        await page.keyboard.press('End'); // Move cursor to end
        await page.waitForTimeout(100);
        await page.keyboard.press('Space');
        await page.waitForTimeout(150);
        await page.keyboard.press('Backspace');
        await page.waitForTimeout(300);

        // Blur the field by clicking outside or pressing Tab (forces final state commit)
        logger.log('[CAPTION] Blurring textbox to commit state...');
        try {
            await page.keyboard.press('Tab');
            await page.waitForTimeout(300);
        } catch (tabError) {
            // Fallback: Click outside
            await page.evaluate(() => {
                const body = document.querySelector('body');
                if (body) {
                    body.click();
                }
            });
            await page.waitForTimeout(300);
        }

        // Re-focus and blur to ensure React captures the final state
        logger.log('[CAPTION] Final focus/blur cycle...');
        await textbox.click();
        await page.waitForTimeout(200);
        await page.evaluate((el) => {
            el.dispatchEvent(new FocusEvent('blur', { bubbles: true, cancelable: true }));
        }, textbox);
        await page.waitForTimeout(500);

        logger.success('[CAPTION] Caption text inserted with React events and commit triggers');

    } catch (error) {
        logger.error(`[CAPTION] Error inserting caption: ${error.message}`);
        throw error;
    }
}

/**
 * Verify caption was properly set
 * Supports full match or partial match (first 20 characters)
 * Ensures emojis are preserved
 * @param {Page} page - Puppeteer page instance
 * @param {string} expectedText - Expected caption text
 * @returns {Promise<Object>} Object with {verified: boolean, actualText: string, htmlContent: string}
 */
async function verifyCaption(page, expectedText) {
    try {
        logger.log('[CAPTION] Verifying caption was set correctly...');

        const result = await page.evaluate(() => {
            // Try multiple selectors to read caption
            const selectors = [
                'div._5rpu[contenteditable="true"][role="textbox"]',
                'div[role="textbox"][contenteditable="true"]',
                'div[contenteditable="true"]',
                'textarea'
            ];

            let foundElement = null;
            let actualText = '';
            let htmlContent = '';

            for (const selector of selectors) {
                const el = document.querySelector(selector);
                if (el) {
                    const text = el.innerText || el.textContent || el.value || '';
                    if (text.trim().length > 0) {
                        foundElement = el;
                        actualText = text.trim();
                        htmlContent = el.innerHTML || '';
                        break;
                    }
                }
            }

            return {
                actualText,
                htmlContent,
                foundElement: foundElement !== null
            };
        });

        const expectedTrimmed = expectedText.trim();
        const actualTrimmed = result.actualText.trim();

        // Check 1: Full match
        if (actualTrimmed === expectedTrimmed) {
            logger.success(`[CAPTION] ✅ Caption verified (full match): "${actualTrimmed.substring(0, 50)}${actualTrimmed.length > 50 ? '...' : ''}"`);
            return { verified: true, actualText: actualTrimmed, htmlContent: result.htmlContent };
        }

        // Check 2: Partial match (first 20 characters) - for cases where Meta might add extra content
        const minLength = Math.min(20, expectedTrimmed.length);
        const expectedStart = expectedTrimmed.substring(0, minLength);
        const actualStart = actualTrimmed.substring(0, minLength);

        if (expectedStart === actualStart && actualTrimmed.length > 0) {
            logger.success(`[CAPTION] ✅ Caption verified (partial match - first ${minLength} chars): "${actualStart}..."`);
            return { verified: true, actualText: actualTrimmed, htmlContent: result.htmlContent };
        }

        // Check 3: Not empty (minimal verification)
        if (actualTrimmed.length > 0) {
            logger.warn(`[CAPTION] ⚠️ Caption mismatch but not empty`);
            logger.warn(`[CAPTION]   Expected: "${expectedTrimmed.substring(0, 50)}${expectedTrimmed.length > 50 ? '...' : ''}"`);
            logger.warn(`[CAPTION]   Actual: "${actualTrimmed.substring(0, 50)}${actualTrimmed.length > 50 ? '...' : ''}"`);
            
            // Check if emojis are preserved (basic check)
            const hasEmojisInExpected = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(expectedTrimmed);
            const hasEmojisInActual = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(actualTrimmed);
            
            if (hasEmojisInExpected && !hasEmojisInActual) {
                logger.error(`[CAPTION] ❌ Emojis were LOST during insertion!`);
                return { verified: false, actualText: actualTrimmed, htmlContent: result.htmlContent };
            } else if (hasEmojisInExpected && hasEmojisInActual) {
                logger.log(`[CAPTION] ✅ Emojis preserved in caption`);
            }
            
            // Return false but with data for debugging
            return { verified: false, actualText: actualTrimmed, htmlContent: result.htmlContent };
        }

        // Check 4: Empty - critical failure
        logger.error(`[CAPTION] ❌ Caption field is EMPTY!`);
        logger.error(`[CAPTION]   Expected: "${expectedTrimmed.substring(0, 50)}${expectedTrimmed.length > 50 ? '...' : ''}"`);
        return { verified: false, actualText: actualTrimmed, htmlContent: result.htmlContent };

    } catch (error) {
        logger.error(`[CAPTION] Error verifying caption: ${error.message}`);
        return { verified: false, actualText: '', htmlContent: '' };
    }
}

/**
 * Set caption with proper React state updates
 * @param {Page} page - Puppeteer page instance
 * @param {string} captionText - Caption to insert
 */
async function setCaption(page, captionText) {
    try {
        logger.log('[CAPTION] Setting caption...');

        // Find caption textbox
        const textbox = await findCaptionTextbox(page);
        if (!textbox) {
            throw new Error('Caption textbox not found');
        }

        // Clear existing caption
        await clearCaption(page, textbox);

        // Insert caption text
        await insertCaptionText(page, textbox, captionText);

        logger.success('[CAPTION] Caption set successfully');

    } catch (error) {
        logger.error(`[CAPTION] Failed to set caption: ${error.message}`);
        throw error;
    }
}

/**
 * Apply caption with retry logic and comprehensive debug logging
 * @param {Page} page - Puppeteer page instance
 * @param {string} captionText - Caption to insert
 * @param {number} maxRetries - Maximum retry attempts (default: 3)
 */
async function applyCaptionWithRetry(page, captionText, maxRetries = 3) {
    const fs = require('fs');
    const path = require('path');
    const { getDebugPath } = require('../utils/debugCapture');
    
    try {
        logger.log(`[CAPTION] Applying caption with retry (max ${maxRetries} attempts)...`);

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            logger.log(`[CAPTION] Attempt ${attempt}/${maxRetries}...`);

            try {
                // Set caption
                await setCaption(page, captionText);

                // Wait before verification
                await page.waitForTimeout(1000);

                // Verify caption (now returns an object)
                const verificationResult = await verifyCaption(page, captionText);

                if (verificationResult.verified) {
                    logger.success(`[CAPTION] ✅ Caption successfully applied and verified on attempt ${attempt}`);

                    // Wait additional time to ensure React state is committed
                    logger.log('[CAPTION] Waiting 2 seconds for React state to stabilize...');
                    await page.waitForTimeout(2000);

                    return true;
                }

                // If not verified and not last attempt, retry
                if (attempt < maxRetries) {
                    logger.warn(`[CAPTION] ⚠️ Caption not verified, retrying in 1 second...`);
                    logger.log(`[CAPTION]   Extracted text: "${verificationResult.actualText.substring(0, 100)}..."`);
                    await page.waitForTimeout(1000);
                } else {
                    logger.error('[CAPTION] ❌ Caption verification failed after all retries');

                    // COMPREHENSIVE DEBUG LOGGING ON FAILURE
                    const debugDir = getDebugPath();
                    if (!fs.existsSync(debugDir)) {
                        fs.mkdirSync(debugDir, { recursive: true });
                    }

                    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '').replace('T', '_');
                    const baseFilename = `CAPTION_FAILED_${timestamp}`;

                    // 1. Save screenshot
                    const screenshotPath = path.join(debugDir, `${baseFilename}.png`);
                    await page.screenshot({ path: screenshotPath, fullPage: true });
                    logger.error(`[CAPTION] Debug screenshot saved: ${screenshotPath}`);

                    // 2. Save full page HTML
                    const htmlPath = path.join(debugDir, `${baseFilename}.html`);
                    const fullHtml = await page.content();
                    fs.writeFileSync(htmlPath, fullHtml, 'utf8');
                    logger.error(`[CAPTION] Debug HTML saved: ${htmlPath}`);

                    // 3. Save caption field details
                    const detailsPath = path.join(debugDir, `${baseFilename}_details.txt`);
                    const details = [
                        '=== CAPTION FAILURE DEBUG REPORT ===',
                        '',
                        `Timestamp: ${new Date().toISOString()}`,
                        `Attempts: ${maxRetries}`,
                        '',
                        '--- Expected Caption ---',
                        captionText,
                        '',
                        '--- Actual Extracted Text ---',
                        verificationResult.actualText || '(EMPTY)',
                        '',
                        '--- Caption Field HTML ---',
                        verificationResult.htmlContent || '(NOT FOUND)',
                        '',
                        '--- Verification Status ---',
                        `Verified: ${verificationResult.verified}`,
                        `Expected Length: ${captionText.length} chars`,
                        `Actual Length: ${(verificationResult.actualText || '').length} chars`,
                        `Has Emojis in Expected: ${/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(captionText)}`,
                        `Has Emojis in Actual: ${/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(verificationResult.actualText || '')}`,
                        '',
                        '=== END REPORT ==='
                    ].join('\n');
                    fs.writeFileSync(detailsPath, details, 'utf8');
                    logger.error(`[CAPTION] Debug details saved: ${detailsPath}`);

                    throw new Error('Caption verification failed after all retry attempts');
                }

            } catch (attemptError) {
                logger.error(`[CAPTION] Attempt ${attempt} failed: ${attemptError.message}`);

                if (attempt === maxRetries) {
                    throw attemptError;
                }

                await page.waitForTimeout(1000);
            }
        }

    } catch (error) {
        logger.error(`[CAPTION] Failed to apply caption with retry: ${error.message}`);
        throw error;
    }
}

module.exports = {
    findCaptionTextbox,
    clearCaption,
    insertCaptionText,
    verifyCaption,
    setCaption,
    applyCaptionWithRetry
};
