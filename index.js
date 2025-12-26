const puppeteer = require('puppeteer-core');
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.get('/', (req, res) => res.send('Keeper Active'));
app.listen(8080);

function findChrome() {
    const paths = ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', process.env.CHROME_PATH].filter(Boolean);
    for (const p of paths) { if (fs.existsSync(p)) return p; }
    throw new Error('Chrome not found');
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function startBrowser() {
    const userDataDir = path.join(__dirname, 'chrome_user_data');
    const cookiesPath = path.join(__dirname, 'replit_cookies.json');
    const REPL_URL = 'https://replit.com/@HUDV1/mb#main.py';

    console.log("Starting browser session...");
    let browser = null;

    try {
        const chromePath = findChrome();
        browser = await puppeteer.launch({
            headless: "new",
            executablePath: chromePath,
            userDataDir: userDataDir,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`));

        if (fs.existsSync(cookiesPath)) {
            const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
            await page.setCookie(...cookies);
            console.log(`✓ Cookies loaded`);
        }

        // Helper function to find button in shadow DOM and click with Puppeteer
        async function findAndClickButton(page) {
            try {
                const buttonHandle = await page.evaluateHandle(() => {
                    const BUTTON_SELECTOR = 'button[data-cy="ws-run-btn"]';

                    function findInShadow(selector, root = document) {
                        const el = root.querySelector(selector);
                        if (el) return el;
                        const all = root.querySelectorAll('*');
                        for (const node of all) {
                            if (node.shadowRoot) {
                                const found = findInShadow(selector, node.shadowRoot);
                                if (found) return found;
                            }
                        }
                        return null;
                    }

                    return findInShadow(BUTTON_SELECTOR);
                });

                const button = buttonHandle.asElement();
                if (button) {
                    await button.click();
                    return true;
                }
                return false;
            } catch (e) {
                console.error('Click error:', e.message);
                return false;
            }
        }

        // Helper to check if button shows "stopped" state (play icon)
        async function isButtonStopped(page) {
            return await page.evaluate(() => {
                const RUN_ICON_DATA = 'M20.593 10.91a1.25 1.25 0 0 1 0 2.18l-14.48 8.145a1.25 1.25 0 0 1-1.863-1.09V3.855a1.25 1.25 0 0 1 1.863-1.09l14.48 8.146Z';
                const BUTTON_SELECTOR = 'button[data-cy="ws-run-btn"]';

                function findInShadow(selector, root = document) {
                    const el = root.querySelector(selector);
                    if (el) return el;
                    const all = root.querySelectorAll('*');
                    for (const node of all) {
                        if (node.shadowRoot) {
                            const found = findInShadow(selector, node.shadowRoot);
                            if (found) return found;
                        }
                    }
                    return null;
                }

                const button = findInShadow(BUTTON_SELECTOR);
                if (button) {
                    const iconPath = button.querySelector('svg path');
                    if (iconPath && iconPath.getAttribute('d') === RUN_ICON_DATA) {
                        return true;
                    }
                }
                return false;
            });
        }

        async function forceRestartAction(page) {
            console.log('🔄 FORCE RESTART TRIGGERED: Clicking STOP/RUN sequence...');

            // First click - stop if running, or start if stopped
            const clicked1 = await findAndClickButton(page);
            if (!clicked1) {
                console.log('⚠️ Force restart failed: Button not found.');
                return;
            }

            await sleep(4000);

            // Second click - ensure it's running
            console.log('🔄 FORCE RESTART: Clicking RUN again...');
            await findAndClickButton(page);
        }

        async function loadAndInject() {
            console.log(`⏳ Loading Replit Workspace...`);
            try {
                await page.goto(REPL_URL, { waitUntil: 'networkidle2', timeout: 120000 });
                await sleep(25000); // Give Replit extra time to load

                // Startup force restart
                console.log('🚀 Monitor Active. Executing Startup Force Click...');
                await forceRestartAction(page);

                return true;
            } catch (e) {
                console.error("Load failed, retrying...", e.message);
                await sleep(10000);
                return loadAndInject();
            }
        }

        await loadAndInject();

        // Monitor loop - check every 5 seconds if stopped
        const monitorInterval = setInterval(async () => {
            try {
                const isStopped = await isButtonStopped(page);
                if (isStopped) {
                    console.log('▶️ State: Stopped. Auto-restarting...');
                    await findAndClickButton(page);
                }
            } catch (e) {
                console.error('Monitor error:', e.message);
            }
        }, 5000);

        // Force restart every 50 minutes
        const forceRestartInterval = setInterval(async () => {
            await forceRestartAction(page);
        }, 50 * 60 * 1000);

        // Memory cleanup every 5 minutes
        setInterval(async () => {
            console.log("🔄 Cleaning Page Memory (5m Refresh)...");
            clearInterval(monitorInterval);
            clearInterval(forceRestartInterval);
            await loadAndInject();
        }, 300000);

    } catch (err) {
        console.error("❌ Fatal Error:", err.message);
        if (browser) await browser.close();
        setTimeout(startBrowser, 5000);
    }
}

startBrowser();