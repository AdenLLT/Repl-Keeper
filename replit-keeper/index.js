const puppeteer = require('puppeteer');
const express = require('express');

// 1. Tiny web server so Koyeb knows the service is 'Healthy'
const app = express();
app.get('/', (req, res) => res.send('Browser is running 24/7!'));
app.listen(8080);

async function startBrowser() {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // IMPORTANT: Use your session cookie so you don't have to deal with 2FA/Captchas
    // Replace 'YOUR_COOKIE_VALUE' with the 'connect.sid' from your browser's DevTools
    await page.setCookie({
        name: 'connect.sid',
        value: 'YOUR_COOKIE_VALUE_HERE',
        domain: 'replit.com'
    });

    console.log("Navigating to Replit...");
    await page.goto('https://replit.com/~', { waitUntil: 'networkidle2' });

    // Function to click the run button if it exists
    async function clickRunButtonIfExists() {
        try {
            // Wait a bit for the page to render
            await page.waitForTimeout(2000);
            
            // Try to find and click the run button
            const runButtonClicked = await page.evaluate(() => {
                // Look for run button by various selectors and visibility
                const allButtons = document.querySelectorAll('button');
                
                for (const button of allButtons) {
                    const text = button.textContent.toLowerCase().trim();
                    const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
                    
                    // Check if button is the run button and is visible
                    if ((text.includes('run') || ariaLabel.includes('run')) && button.offsetParent !== null) {
                        console.log("Found run button with text: " + button.textContent);
                        button.click();
                        return true;
                    }
                }
                
                return false;
            });
            
            if (runButtonClicked) {
                console.log("Run button clicked at " + new Date().toLocaleTimeString());
            } else {
                console.log("Run button not found or not visible at " + new Date().toLocaleTimeString());
            }
        } catch (e) {
            console.log("Error checking for run button: " + e.message);
        }
    }

    // Function to press the M key
    async function pressM() {
        try {
            await page.keyboard.press('m');
            console.log("Pressed M key at " + new Date().toLocaleTimeString());
        } catch (e) {
            console.log("Error pressing M key: " + e.message);
        }
    }

    // Click run button on initial load
    await clickRunButtonIfExists();
    
    // Press M key after clicking run button
    await page.waitForTimeout(1000);
    await pressM();

    // Keep the loop running forever
    setInterval(async () => {
        try {
            await page.reload({ waitUntil: 'networkidle2' });
            console.log("Refreshed Replit at " + new Date().toLocaleTimeString());
            
            // Try to click run button after reload
            await clickRunButtonIfExists();
            
            // Press M key after reload
            await page.waitForTimeout(1000);
            await pressM();
        } catch (e) {
            console.log("Refresh failed, attempting to restart...");
        }
    }, 10 * 60 * 1000); // Refreshes every 10 minutes
}

startBrowser();