/**
 * Random Delay Utility
 * Generates random delays between 1.00 and 9.99 seconds
 */

/**
 * Generate a random delay value between 1.00 and 9.99 seconds
 * Format: 1 digit before decimal, 2 digits after decimal
 * @returns {number} Random delay in seconds
 */
function generateRandomDelay() {
  // Generate random number between 1.00 and 9.99
  // Min: 1.00 (100 cents), Max: 9.99 (999 cents)
  const min = 100; // 1.00 * 100
  const max = 999; // 9.99 * 100
  
  const randomCents = Math.floor(Math.random() * (max - min + 1)) + min;
  const seconds = randomCents / 100;
  
  // Round to 2 decimal places to ensure format
  return Math.round(seconds * 100) / 100;
}

/**
 * Async function to pause execution for a random delay
 * @returns {Promise<number>} Promise that resolves with the delay value used
 */
async function randomDelay() {
  const delay = generateRandomDelay();
  const milliseconds = delay * 1000;
  
  console.log(`⏱️  Random delay: ${delay.toFixed(2)} seconds`);
  
  return new Promise(resolve => {
    setTimeout(() => resolve(delay), milliseconds);
  });
}

module.exports = {
  generateRandomDelay,
  randomDelay
};
