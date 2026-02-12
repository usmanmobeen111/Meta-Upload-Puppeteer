/**
 * Puppeteer Automation Helper Functions
 * Reusable utilities for Meta Business Suite automation
 */

const logger = require('../utils/logger');
const { randomDelay } = require('../utils/randomDelay');

/**
 * Click button containing specific SVG icon
 * @param {Object} page - Puppeteer page
 * @param {string} svgPathData - Part of the SVG path d attribute to search for
 * @param {string} buttonDescription - Description for logging
 */
async function clickButtonWithSVG(page, svgPathData, buttonDescription = 'button') {
    try {
        logger.log(`[FIND] Searching for ${buttonDescription} by SVG icon...`);

        await page.waitForTimeout(1000);

        const clicked = await page.evaluate((pathData) => {
            // Find all SVG elements
            const svgs = [...document.querySelectorAll('svg')];

            for (const svg of svgs) {
                // Check if this SVG contains a path with the specified data
                const paths = svg.querySelectorAll('path');
                for (const path of paths) {
                    const d = path.getAttribute('d');
                    if (d && d.includes(pathData)) {
                        // Found the SVG, now find the clickable parent
                        let parent = svg.parentElement;
                        while (parent) {
                            if (parent.getAttribute('role') === 'button' ||
                                parent.tagName === 'BUTTON' ||
                                parent.onclick) {
                                parent.click();
                                return true;
                            }
                            parent = parent.parentElement;
                        }
                    }
                }
            }
            return false;
        }, svgPathData);

        if (clicked) {
            logger.success(`✅ Clicked ${buttonDescription} via SVG icon`);
            await randomDelay();
            return true;
        }

        throw new Error(`Button with SVG containing "${svgPathData}" not found`);
    } catch (error) {
        logger.error(`[ERROR] Failed to click ${buttonDescription}: ${error.message}`);
        throw error;
    }
}

/**
 * Wait for page to be fully loaded and network idle
 * @param {Object} page - Puppeteer page
 * @param {number} timeoutMs - Timeout in milliseconds
 */
async function waitForPageLoad(page, timeoutMs = 30000) {
    try {
        logger.log('[WAIT] Waiting for page to be fully loaded...');

        // Wait for network to be idle
        await page.waitForNetworkIdle({ timeout: timeoutMs, idleTime: 500 });

        // Wait for DOM to be ready
        await page.waitForFunction(() => document.readyState === 'complete', { timeout: timeoutMs });

        // Additional wait for any dynamic content
        await page.waitForTimeout(2000);

        logger.success('[WAIT] ✅ Page fully loaded');
    } catch (error) {
        logger.warn(`[WAIT] Page load wait timeout: ${error.message}`);
        // Continue anyway, page might be loaded enough
    }
}

/**
 * Click button by visible text using DOM evaluation with ENHANCED fallback strategies
 * @param {Object} page - Puppeteer page
 * @param {string} text - Button text to search for
 * @param {number} retries - Number of retry attempts
 */
async function clickButtonByText(page, text, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            logger.log(`[FIND] Searching for button: "${text}" (Attempt ${attempt}/${retries})`);

            // Wait a moment for the page to be ready
            await page.waitForTimeout(1000);

            // Strategy 1: Exact text match with role="button"
            logger.log(`[FIND] Strategy 1: Exact text match with role="button" or button tag`);
            let clicked = await page.evaluate((searchText) => {
                const buttons = [...document.querySelectorAll('[role="button"], button')];
                const target = buttons.find(el =>
                    el.innerText && el.innerText.trim() === searchText
                );
                if (target) {
                    target.click();
                    return true;
                }
                return false;
            }, text);

            if (clicked) {
                logger.success(`✅ Clicked button: "${text}" (Strategy 1: Exact match)`);
                await randomDelay();
                return true;
            }

            // Strategy 2: Partial text match
            logger.log(`[FIND] Strategy 2: Partial text match (contains)`);
            clicked = await page.evaluate((searchText) => {
                const buttons = [...document.querySelectorAll('[role="button"], button')];
                const target = buttons.find(el =>
                    el.innerText && el.innerText.trim().includes(searchText)
                );
                if (target) {
                    target.click();
                    return true;
                }
                return false;
            }, text);

            if (clicked) {
                logger.success(`✅ Clicked button: "${text}" (Strategy 2: Partial match)`);
                await randomDelay();
                return true;
            }

            // Strategy 3: Search in all clickable elements (div, span, a)
            logger.log(`[FIND] Strategy 3: All clickable elements (case-insensitive)`);
            clicked = await page.evaluate((searchText) => {
                const allElements = [...document.querySelectorAll('div, span, a, button, [role="button"]')];
                const target = allElements.find(el =>
                    el.innerText &&
                    el.innerText.trim().toLowerCase().includes(searchText.toLowerCase()) &&
                    (el.onclick || el.getAttribute('role') === 'button' || el.tagName === 'BUTTON' || el.tagName === 'A')
                );
                if (target) {
                    target.click();
                    return true;
                }
                return false;
            }, text);

            if (clicked) {
                logger.success(`✅ Clicked button: "${text}" (Strategy 3: Clickable elements)`);
                await randomDelay();
                return true;
            }

            // Strategy 4: Find text node and click nearest parent with role="button"
            // This handles deeply nested structures like Facebook's Add Video button
            logger.log(`[FIND] Strategy 4: Find text node and click parent button`);
            clicked = await page.evaluate((searchText) => {
                // Get all text nodes containing the search text
                const walker = document.createTreeWalker(
                    document.body,
                    NodeFilter.SHOW_TEXT,
                    null,
                    false
                );

                let node;
                while (node = walker.nextNode()) {
                    if (node.textContent.trim() === searchText) {
                        // Find the nearest clickable parent
                        let parent = node.parentElement;
                        while (parent) {
                            if (parent.getAttribute('role') === 'button' ||
                                parent.tagName === 'BUTTON' ||
                                parent.onclick) {
                                parent.click();
                                return true;
                            }
                            parent = parent.parentElement;
                        }
                    }
                }
                return false;
            }, text);

            if (clicked) {
                logger.success(`✅ Clicked button: "${text}" (Strategy 4: Parent button)`);
                await randomDelay();
                return true;
            }

            logger.warn(`⚠️ Button not found: "${text}"`);

            if (attempt < retries) {
                logger.log(`[RETRY] Waiting 2 seconds before retry...`);
                await page.waitForTimeout(2000);
            }
        } catch (error) {
            logger.error(`[ERROR] Error clicking button: ${error.message}`);

            if (attempt < retries) {
                await page.waitForTimeout(2000);
            } else {
                // On final failure, take screenshot for debugging
                try {
                    const fs = require('fs');
                    const path = require('path');

                    // Ensure debug_screenshots directory exists
                    const debugDir = path.join(__dirname, '..', 'debug_screenshots');
                    if (!fs.existsSync(debugDir)) {
                        fs.mkdirSync(debugDir, { recursive: true });
                    }

                    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '').replace('T', '_');
                    const screenshotPath = path.join(debugDir, `button_not_found_${text.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.png`);
                    await page.screenshot({ path: screenshotPath, fullPage: true });
                    logger.error(`[DEBUG] Screenshot saved: ${screenshotPath}`);
                } catch (screenshotError) {
                    logger.warn(`[DEBUG] Could not save screenshot: ${screenshotError.message}`);
                }
                throw error;
            }
        }
    }

    throw new Error(`Failed to click button "${text}" after ${retries} attempts`);
}

/**
 * Wait for upload to complete by monitoring percentage indicator
 * @param {Object} page - Puppeteer page
 * @param {number} timeoutSeconds - Maximum wait time in seconds
 */
async function waitForUploadComplete(page, timeoutSeconds = 300) {
    logger.log(`[UPLOAD] Monitoring upload progress (max ${timeoutSeconds}s)...`);

    const startTime = Date.now();
    const maxWaitMs = timeoutSeconds * 1000;
    let lastPercentage = 0;
    let errorCount = 0;

    while (Date.now() - startTime < maxWaitMs) {
        try {
            // Check for upload percentage indicator
            const uploadStatus = await page.evaluate(() => {
                // Look for percentage text like "95%", "100%"
                const allElements = [...document.querySelectorAll('span')];
                const percentageElement = allElements.find(el =>
                    el.textContent && /^\d+%$/.test(el.textContent.trim())
                );

                if (percentageElement) {
                    return {
                        isUploading: true,
                        percentage: parseInt(percentageElement.textContent.trim())
                    };
                }

                // Also check for progress bars as fallback
                const progressBars = document.querySelectorAll('[role="progressbar"]');
                if (progressBars.length > 0) {
                    return { isUploading: true, percentage: null };
                }

                return { isUploading: false, percentage: null };
            });

            // Reset error count on successful check
            errorCount = 0;

            if (uploadStatus.isUploading) {
                if (uploadStatus.percentage !== null && uploadStatus.percentage !== lastPercentage) {
                    logger.log(`[UPLOAD] Progress: ${uploadStatus.percentage}%`);
                    lastPercentage = uploadStatus.percentage;

                    // If we reached 100%, we're done!
                    if (uploadStatus.percentage >= 100) {
                        logger.success('[UPLOAD] Upload reached 100%!');
                        await page.waitForTimeout(3000); // Wait for UI to settle
                        logger.success('[UPLOAD] ✅ Upload complete!');
                        await randomDelay();
                        return true;
                    }
                }
            } else {
                // No upload indicators found - upload is complete
                logger.success('[UPLOAD] ✅ Upload complete!');
                await randomDelay();
                return true;
            }

            // Wait before checking again
            await page.waitForTimeout(1000);
        } catch (error) {
            errorCount++;

            // If we get too many consecutive errors, assume upload is complete
            if (errorCount > 10) {
                logger.warn(`[UPLOAD] Too many errors, assuming upload complete`);
                return true;
            }

            // Only log every 10th error to avoid spam
            if (errorCount % 10 === 1) {
                logger.warn(`[UPLOAD] Error checking upload status: ${error.message}`);
            }

            await page.waitForTimeout(1000);
        }
    }

    throw new Error(`Upload did not complete within ${timeoutSeconds} seconds`);
}

/**
 * Wait for element to disappear
 * @param {Object} page - Puppeteer page
 * @param {string} selector - CSS selector
 * @param {number} timeoutMs - Timeout in milliseconds
 */
async function waitForElementDisappear(page, selector, timeoutMs = 30000) {
    try {
        await page.waitForSelector(selector, { hidden: true, timeout: timeoutMs });
        logger.log(`Element disappeared: ${selector}`);
        return true;
    } catch (error) {
        logger.warn(`Element did not disappear within timeout: ${selector}`);
        return false;
    }
}

/**
 * Wait for element to be enabled
 * @param {Object} page - Puppeteer page
 * @param {string} selector - CSS selector
 * @param {number} timeoutMs - Timeout in milliseconds
 */
async function waitForElementEnabled(page, selector, timeoutMs = 30000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        try {
            const isEnabled = await page.evaluate((sel) => {
                const element = document.querySelector(sel);
                return element && !element.disabled && !element.hasAttribute('aria-disabled');
            }, selector);

            if (isEnabled) {
                logger.log(`Element enabled: ${selector}`);
                return true;
            }

            await page.waitForTimeout(1000);
        } catch (error) {
            // Continue waiting
        }
    }

    logger.warn(`Element did not enable within timeout: ${selector}`);
    return false;
}

/**
 * Paste text with emoji support using clipboard
 * @param {Object} page - Puppeteer page
 * @param {string} selector - CSS selector for text input
 * @param {string} text - Text to paste
 */
async function pasteTextWithEmojis(page, selector, text) {
    try {
        logger.log('Pasting text with emoji support...');

        // Focus the element
        await page.click(selector);
        await page.waitForTimeout(500);

        // Use keyboard typing with delay for better compatibility
        await page.type(selector, text, { delay: 20 });

        logger.success('Text pasted successfully');
        await randomDelay();
    } catch (error) {
        logger.error(`Failed to paste text: ${error.message}`);
        throw error;
    }
}

/**
 * Wait for navigation or timeout
 * @param {Object} page - Puppeteer page
 * @param {number} timeoutMs - Timeout in milliseconds
 */
async function waitForNavigationOrTimeout(page, timeoutMs = 5000) {
    try {
        await Promise.race([
            page.waitForNavigation({ timeout: timeoutMs }),
            page.waitForTimeout(timeoutMs)
        ]);
    } catch (error) {
        // Timeout is acceptable, page might not navigate
    }
}

/**
 * Click "Create Post" button
 * @param {Object} page - Puppeteer page
 * @param {number} retries - Number of retry attempts
 */
async function clickCreatePost(page, retries = 3) {
    logger.log('[POST] Clicking "Create Post" button...');
    await clickButtonByText(page, 'Create Post', retries);
    logger.success('[POST] ✅ Clicked Create Post');
}

/**
 * Open "Add video" dropdown (for Post workflow)
 * @param {Object} page - Puppeteer page
 * @param {number} retries - Number of retry attempts
 */
async function openAddVideoDropdown(page, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            logger.log(`[POST] Opening "Add video" dropdown (Attempt ${attempt}/${retries})...`);
            await page.waitForTimeout(1000);

            // Strategy 1: Click button with text "Add video"
            let clicked = await page.evaluate(() => {
                const buttons = [...document.querySelectorAll('[role="button"], button')];
                const target = buttons.find(el => {
                    const text = (el.innerText || '').trim();
                    return text.toLowerCase().includes('add video');
                });
                if (target) {
                    target.click();
                    return true;
                }
                return false;
            });

            if (clicked) {
                logger.success('[POST] ✅ Opened Add video dropdown (Strategy 1)');
                await randomDelay();
                return true;
            }

            // Strategy 2: XPath search
            logger.log('[POST] Strategy 2: Using XPath...');
            const [dropdown] = await page.$x("//div[@role='button' and contains(., 'Add video')]");
            if (dropdown) {
                await dropdown.click();
                logger.success('[POST] ✅ Opened Add video dropdown (Strategy 2: XPath)');
                await randomDelay();
                return true;
            }

            if (attempt < retries) {
                await page.waitForTimeout(2000);
            }
        } catch (error) {
            logger.warn(`[POST] Error opening dropdown: ${error.message}`);
            if (attempt === retries) throw error;
        }
    }
    throw new Error('Failed to open Add video dropdown');
}

/**
 * Click "Upload from computer" option in dropdown
 * @param {Object} page - Puppeteer page
 * @param {number} retries - Number of retry attempts
 */
async function clickUploadFromComputer(page, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            logger.log(`[POST] Clicking "Upload from computer" (Attempt ${attempt}/${retries})...`);
            await page.waitForTimeout(1000);

            // Strategy 1: Exact text match
            let clicked = await page.evaluate(() => {
                const allElements = [...document.querySelectorAll('[role="button"], div, span, a')];
                const target = allElements.find(el => {
                    const text = (el.innerText || '').trim();
                    return text.toLowerCase().includes('upload from computer');
                });
                if (target) {
                    target.click();
                    return true;
                }
                return false;
            });

            if (clicked) {
                logger.success('[POST] ✅ Clicked "Upload from computer" (Strategy 1)');
                await randomDelay();
                return true;
            }

            // Strategy 2: Use helper function
            await clickButtonByText(page, 'Upload from computer', 1);
            logger.success('[POST] ✅ Clicked "Upload from computer" (Strategy 2: Helper)');
            await randomDelay();
            return true;

        } catch (error) {
            if (attempt < retries) {
                logger.warn(`[POST] Retry ${attempt}...`);
                await page.waitForTimeout(2000);
            } else {
                throw new Error(`Failed to click Upload from computer: ${error.message}`);
            }
        }
    }
}

/**
 * Wait for Post upload to complete
 * Similar to waitForUploadComplete but for Post workflow
 * @param {Object} page - Puppeteer page
 * @param {number} timeoutSeconds - Maximum wait time in seconds
 */
async function waitForPostUploadComplete(page, timeoutSeconds = 300) {
    logger.log(`[POST] Monitoring upload progress (max ${timeoutSeconds}s)...`);

    const startTime = Date.now();
    const maxWaitMs = timeoutSeconds * 1000;
    let lastPercentage = 0;

    while (Date.now() - startTime < maxWaitMs) {
        try {
            // Check for upload completion indicators
            const uploadStatus = await page.evaluate(() => {
                // Look for percentage text
                const allElements = [...document.querySelectorAll('span, div')];
                const percentageElement = allElements.find(el =>
                    el.textContent && /^\d+%$/.test(el.textContent.trim())
                );

                if (percentageElement) {
                    return {
                        isUploading: true,
                        percentage: parseInt(percentageElement.textContent.trim())
                    };
                }

                // Check for progress bars
                const progressBars = document.querySelectorAll('[role="progressbar"]');
                if (progressBars.length > 0) {
                    return { isUploading: true, percentage: null };
                }

                // Check for "Uploaded" or "Ready" text
                const text = document.body.innerText.toLowerCase();
                if (text.includes('uploaded') || text.includes('ready')) {
                    return { isUploading: false, percentage: 100 };
                }

                return { isUploading: false, percentage: null };
            });

            if (uploadStatus.percentage !== null && uploadStatus.percentage !== lastPercentage) {
                logger.log(`[POST] Progress: ${uploadStatus.percentage}%`);
                lastPercentage = uploadStatus.percentage;

                if (uploadStatus.percentage >= 100) {
                    logger.success('[POST] Upload reached 100%!');
                    await page.waitForTimeout(3000);
                    logger.success('[POST] ✅ Upload complete!');
                    await randomDelay();
                    return true;
                }
            }

            if (!uploadStatus.isUploading) {
                logger.success('[POST] ✅ Upload complete!');
                await randomDelay();
                return true;
            }

            await page.waitForTimeout(1000);
        } catch (error) {
            logger.warn(`[POST] Error checking upload: ${error.message}`);
            await page.waitForTimeout(1000);
        }
    }

    throw new Error(`Post upload did not complete within ${timeoutSeconds} seconds`);
}

/**
 * Click "Publish" button (for Post workflow)
 * @param {Object} page - Puppeteer page
 * @param {number} retries - Number of retry attempts
 */
async function clickPublishButton(page, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            logger.log(`[POST] Clicking "Publish" button (Attempt ${attempt}/${retries})...`);
            await page.waitForTimeout(2000);

            // Strategy 1: XPath exact match with aria-busy check
            logger.log('[POST] Strategy 1: XPath with aria-busy...');
            const xpath1 = `//div[@role='button' and @aria-busy='false' and .//div[normalize-space(text())='Publish']]`;
            const [button1] = await page.$x(xpath1);
            if (button1) {
                await button1.click();
                logger.success('[POST] ✅ Clicked Publish (Strategy 1: XPath)');
                await randomDelay();
                return true;
            }

            // Strategy 2: Use helper function
            logger.log('[POST] Strategy 2: Helper function...');
            await clickButtonByText(page, 'Publish', 1);
            logger.success('[POST] ✅ Clicked Publish (Strategy 2: Helper)');
            await randomDelay();
            return true;

        } catch (error) {
            if (attempt < retries) {
                logger.warn(`[POST] Retry ${attempt}...`);
                await page.waitForTimeout(2000);
            } else {
                throw new Error(`Failed to click Publish button: ${error.message}`);
            }
        }
    }
}

/**
 * Wait for publish confirmation
 * @param {Object} page - Puppeteer page
 * @param {number} timeoutSeconds - Maximum wait time in seconds
 */
async function waitForPublishConfirmation(page, timeoutSeconds = 180) {
    logger.log(`[POST] Waiting for publish confirmation (max ${timeoutSeconds}s)...`);

    const startTime = Date.now();
    const maxWaitMs = timeoutSeconds * 1000;

    while (Date.now() - startTime < maxWaitMs) {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);

        try {
            const signals = await page.evaluate(() => {
                const text = document.body.innerText.toLowerCase();
                const html = document.documentElement.innerHTML.toLowerCase();

                // Success keywords for Post
                const successKeywords = [
                    'published',
                    'posted',
                    'your post is live',
                    'your post is now published',
                    'post successful'
                ];
                const hasSuccess = successKeywords.some(keyword => 
                    text.includes(keyword) || html.includes(keyword)
                );

                // Error detection
                const errorKeywords = ['error', 'failed', 'try again', 'something went wrong'];
                const hasError = errorKeywords.some(keyword => text.includes(keyword));

                return { hasSuccess, hasError };
            });

            if (signals.hasSuccess) {
                logger.success('[POST] ✅ Post published successfully!');
                return true;
            }

            if (signals.hasError) {
                throw new Error('Publish failed - error detected on page');
            }

            // Log progress every 10 seconds
            if (elapsed % 10 === 0) {
                logger.log(`[POST] Still waiting... (${elapsed}s elapsed)`);
            }

            await page.waitForTimeout(2000);
        } catch (error) {
            if (error.message.includes('error detected')) {
                throw error;
            }
            // Continue waiting
            await page.waitForTimeout(2000);
        }
    }

    throw new Error(`Publish confirmation not detected within ${timeoutSeconds} seconds`);
}

/**
 * Fill optional Title and Description fields if they exist
 * @param {Object} page - Puppeteer page
 * @param {string} caption - Caption text to use
 */
async function fillOptionalTitleDescription(page, caption) {
    try {
        logger.log('[POST] Checking for optional Title/Description fields...');

        // Check if Title field exists
        const hasTitleField = await page.evaluate(() => {
            const labels = [...document.querySelectorAll('label')];
            return labels.some(label => 
                (label.innerText || '').toLowerCase().includes('title')
            );
        });

        if (hasTitleField) {
            logger.log('[POST] Title field found, filling it...');
            const title = caption.substring(0, 60);
            
            // Try to find and fill title input
            await page.evaluate((titleText) => {
                const inputs = [...document.querySelectorAll('input, textarea')];
                const titleInput = inputs.find(input => {
                    const label = input.previousElementSibling;
                    return label && (label.innerText || '').toLowerCase().includes('title');
                });
                
                if (titleInput) {
                    titleInput.value = titleText;
                    titleInput.dispatchEvent(new Event('input', { bubbles: true }));
                    titleInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }, title);
            
            logger.success(`[POST] ✅ Title filled: "${title}"`);
        }

        // Check if Description field exists
        const hasDescriptionField = await page.evaluate(() => {
            const labels = [...document.querySelectorAll('label')];
            return labels.some(label => 
                (label.innerText || '').toLowerCase().includes('description')
            );
        });

        if (hasDescriptionField) {
            logger.log('[POST] Description field found, filling it...');
            
            // Try to find and fill description textarea
            await page.evaluate((descText) => {
                const inputs = [...document.querySelectorAll('textarea')];
                const descInput = inputs.find(input => {
                    const label = input.previousElementSibling;
                    return label && (label.innerText || '').toLowerCase().includes('description');
                });
                
                if (descInput) {
                    descInput.value = descText;
                    descInput.dispatchEvent(new Event('input', { bubbles: true }));
                    descInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }, caption);
            
            logger.success('[POST] ✅ Description filled');
        }

        if (!hasTitleField && !hasDescriptionField) {
            logger.log('[POST] No optional Title/Description fields found - skipping');
        }

        await randomDelay();
    } catch (error) {
        logger.warn(`[POST] Could not fill optional fields: ${error.message}`);
        // Non-fatal error, continue workflow
    }
}

module.exports = {
    clickButtonWithSVG,
    waitForPageLoad,
    clickButtonByText,
    waitForUploadComplete,
    waitForElementDisappear,
    waitForElementEnabled,
    pasteTextWithEmojis,
    waitForNavigationOrTimeout,
    // New Create Post workflow helpers
    clickCreatePost,
    openAddVideoDropdown,
    clickUploadFromComputer,
    waitForPostUploadComplete,
    clickPublishButton,
    waitForPublishConfirmation,
    fillOptionalTitleDescription
};
