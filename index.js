const puppeteer = require('puppeteer-core');
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.get('/', (req, res) => res.send('Keeper is Active - No Extension Needed'));
app.listen(8080);

function findChrome() {
    const paths = [
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome-stable',
        process.env.CHROME_PATH,
    ].filter(Boolean);
    for (const p of paths) { if (fs.existsSync(p)) return p; }
    throw new Error('Chrome executable not found');
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Clean up Chrome lock files
function cleanupLockFiles(userDataDir) {
    try {
        const lockFile = path.join(userDataDir, 'SingletonLock');
        if (fs.existsSync(lockFile)) {
            fs.unlinkSync(lockFile);
            console.log('✓ Cleaned up lock file');
        }
    } catch (err) {
        console.log('⚠️  Could not clean lock file:', err.message);
    }
}

let browser = null;

async function startBrowser() {
    console.log("Starting browser...");

    const userDataDir = path.join(__dirname, 'chrome_user_data');
    const cookiesPath = path.join(__dirname, 'replit_cookies.json');

    try {
        // Clean up any leftover lock files
        cleanupLockFiles(userDataDir);

        const chromePath = findChrome();

        if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

        browser = await puppeteer.launch({
            headless: "new",
            executablePath: chromePath,
            userDataDir: userDataDir,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        if (fs.existsSync(cookiesPath)) {
            const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
            await page.setCookie(...cookies);
            console.log(`✓ Cookies loaded`);
        }

        const WORKSPACE_URL = 'https://replit.com/@HUDV1/mb#main.py';

        const runLogic = async () => {
            console.log(`\n🔄 [${new Date().toLocaleTimeString()}] Refreshing/Checking Workspace...`);

            try {
                // Increased timeout to 3 minutes for slow loads
                await page.goto(WORKSPACE_URL, { waitUntil: 'domcontentloaded', timeout: 180000 });

                console.log('⏳ Waiting for Replit interface to fully load (25 seconds)...');
                await sleep(25000);

                // Click the run button 3 times with 10 second delays
                for (let i = 1; i <= 3; i++) {
                    console.log(`\n🎯 Attempt ${i}/3 - Looking for run button...`);

                    try {
                        // Wait for the button to appear
                        await page.waitForSelector('button[data-cy="ws-run-btn"]', { timeout: 15000 });
                        console.log('✓ Button found in DOM');

                        const result = await page.evaluate(() => {
                            const button = document.querySelector('button[data-cy="ws-run-btn"]');

                            if (!button) {
                                return { success: false, reason: 'Button not found' };
                            }

                            // Check if it's the RUN button (not STOP)
                            const path = button.querySelector('svg path');
                            if (!path) {
                                return { success: false, reason: 'No SVG path found' };
                            }

                            const pathD = path.getAttribute('d');
                            const runIconPath = 'M20.593 10.91a1.25 1.25 0 0 1 0 2.18l-14.48 8.145a1.25 1.25 0 0 1-1.863-1.09V3.855a1.25 1.25 0 0 1 1.863-1.09l14.48 8.146Z';

                            if (pathD !== runIconPath) {
                                return { 
                                    success: false, 
                                    reason: 'Button is not in RUN state (probably STOP)',
                                    pathPreview: pathD ? pathD.substring(0, 30) + '...' : 'null'
                                };
                            }

                            // Trigger React's pressable events
                            const events = [
                                new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1 }),
                                new MouseEvent('mousedown', { bubbles: true, cancelable: true }),
                                new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1 }),
                                new MouseEvent('mouseup', { bubbles: true, cancelable: true }),
                                new MouseEvent('click', { bubbles: true, cancelable: true }),
                            ];

                            events.forEach(event => button.dispatchEvent(event));

                            // Also try direct click
                            button.click();

                            return { success: true, reason: 'Clicked RUN button' };
                        });

                        if (result.success) {
                            console.log(`✅ Click ${i}/3 successful! ${result.reason}`);
                        } else {
                            console.log(`⚠️  Click ${i}/3 failed: ${result.reason}`);
                            if (result.pathPreview) {
                                console.log(`   Path preview: ${result.pathPreview}`);
                            }
                        }

                    } catch (err) {
                        console.log(`❌ Click ${i}/3 error: ${err.message}`);
                    }

                    // Wait 10 seconds before next click (except after the last one)
                    if (i < 3) {
                        console.log(`⏱️  Waiting 10 seconds before next click...`);
                        await sleep(10000);
                    }
                }

                console.log(`\n✅ Completed all 3 click attempts`);

                // Save cookies
                const cookies = await page.cookies();
                fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));

            } catch (err) {
                console.log(`⚠️  Error in runLogic: ${err.message}`);
            }
        };

        // Initial Run
        await runLogic();

        // Run every 5 minutes
        setInterval(runLogic, 5 * 60 * 1000);

        await new Promise(() => {});

    } catch (err) {
        console.error("Error:", err.message);

        // Properly close browser if it exists
        if (browser) {
            try {
                await browser.close();
                console.log('✓ Browser closed');
            } catch (closeErr) {
                console.log('⚠️  Error closing browser:', closeErr.message);
            }
        }

        // Clean up lock files before restarting
        cleanupLockFiles(userDataDir);

        console.log('⏳ Restarting in 30 seconds...');
        setTimeout(() => startBrowser(), 30000);
    }
}

startBrowser();