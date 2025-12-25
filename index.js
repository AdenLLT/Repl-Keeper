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
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        if (fs.existsSync(cookiesPath)) {
            const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
            await page.setCookie(...cookies);
            console.log(`✓ Cookies loaded (${cookies.length} cookies)`);
        } else {
            console.log('⚠️  No cookies found - you may need to log in first!');
        }

        const WORKSPACE_URL = 'https://replit.com/@HUDV1/mb#main.py';
        const CHECK_INTERVAL_MS = 5000;
        const BUTTON_SELECTOR = 'button[data-cy="ws-run-btn"]';
        const RUN_ICON_PATH_DATA = 'M20.593 10.91a1.25 1.25 0 0 1 0 2.18l-14.48 8.145a1.25 1.25 0 0 1-1.863-1.09V3.855a1.25 1.25 0 0 1 1.863-1.09l14.48 8.146Z';

        await page.goto(WORKSPACE_URL, {
            waitUntil: 'domcontentloaded',
            timeout: 180000
        });

        console.log('⏳ Waiting for Replit interface to fully load (30 seconds)...');
        await sleep(30000);

        console.log('✓ Page loaded. Starting state-aware monitor. Checking every 5 seconds.');

        // Inject the userscript logic into the page
        await page.evaluateOnNewDocument((BUTTON_SELECTOR, RUN_ICON_PATH_DATA) => {
            window.monitorAndClickRunButton = function() {
                const button = document.querySelector(BUTTON_SELECTOR);

                if (button) {
                    const iconPath = button.querySelector('svg path');

                    if (iconPath && iconPath.getAttribute('d') === RUN_ICON_PATH_DATA) {
                        const simulateMouseClick = (element) => {
                            const dispatchEvent = (type) => {
                                const event = new MouseEvent(type, {
                                    bubbles: true,
                                    cancelable: true,
                                    view: window
                                });
                                element.dispatchEvent(event);
                            };
                            dispatchEvent('mousedown');
                            dispatchEvent('mouseup');
                            dispatchEvent('click');
                        };

                        simulateMouseClick(button);
                        console.log('Replit Auto-Run: Found RUN icon (Play). Restarting service.');
                    } else {
                        console.log('Replit Auto-Run: Button found, but icon is NOT the RUN (Play) triangle. App is running or stopping.');
                    }
                } else {
                    console.log('Replit Auto-Run: Button component not found. Retrying in 5 seconds.');
                }
            };
        }, BUTTON_SELECTOR, RUN_ICON_PATH_DATA);

        // Start the monitoring loop from Node.js side
        setInterval(async () => {
            try {
                await page.evaluate(() => {
                    window.monitorAndClickRunButton();
                });

                // Save cookies periodically
                const cookies = await page.cookies();
                fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
            } catch (err) {
                console.log(`⚠️  Error in monitor cycle: ${err.message}`);
            }
        }, CHECK_INTERVAL_MS);

        await new Promise(() => {});

    } catch (err) {
        console.error("Error:", err.message);

        if (browser) {
            try {
                await browser.close();
                console.log('✓ Browser closed');
            } catch (closeErr) {
                console.log('⚠️  Error closing browser:', closeErr.message);
            }
        }

        cleanupLockFiles(userDataDir);
        console.log('⏳ Restarting in 30 seconds...');
        setTimeout(() => startBrowser(), 30000);
    }
}

startBrowser();