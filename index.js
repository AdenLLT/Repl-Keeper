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

        async function loadAndInject() {
            console.log(`⏳ Loading Replit Workspace...`);
            try {
                await page.goto(REPL_URL, { waitUntil: 'networkidle2', timeout: 120000 });
                await sleep(20000); // Wait for page to build

                await page.evaluate(() => {
                    // --- Integrated Logic from your Tampermonkey script ---
                    const CHECK_INTERVAL_MS = 5000;
                    const BUTTON_SELECTOR = 'button[data-cy="ws-run-btn"]';
                    const RUN_ICON_PATH_DATA = 'M20.593 10.91a1.25 1.25 0 0 1 0 2.18l-14.48 8.145a1.25 1.25 0 0 1-1.863-1.09V3.855a1.25 1.25 0 0 1 1.863-1.09l14.48 8.146Z';

                    // Helper to find elements inside nested Shadow DOMs
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

                    const simulateMouseClick = (element) => {
                        ['mousedown', 'mouseup', 'click'].forEach(type => {
                            element.dispatchEvent(new MouseEvent(type, {
                                bubbles: true,
                                cancelable: true,
                                view: window
                            }));
                        });
                    };

                    window.replitMonitor = setInterval(() => {
                        const button = findInShadow(BUTTON_SELECTOR);

                        if (button) {
                            const iconPath = button.querySelector('svg path');
                            if (iconPath && iconPath.getAttribute('d') === RUN_ICON_PATH_DATA) {
                                simulateMouseClick(button);
                                console.log('▶️ Found RUN icon. Clicking now.');
                            } else {
                                console.log('✅ Button found, but app is already running.');
                            }
                        } else {
                            console.log('🔍 Button component not found in DOM or ShadowDOM.');
                        }
                    }, CHECK_INTERVAL_MS);

                    console.log('🚀 Replit Auto-Run Monitor Started (5s interval)');
                });

            } catch (e) {
                console.error("Load failed, retrying...", e.message);
                await sleep(10000);
                return loadAndInject();
            }
        }

        await loadAndInject();

        // 5-Minute Refresh Logic (as requested in your script)
        setInterval(async () => {
            console.log("🔄 5-Minute Refresh Triggered...");
            // Clear the old interval inside the browser before reloading
            await page.evaluate(() => clearInterval(window.replitMonitor));
            await loadAndInject();
        }, 300000);

    } catch (err) {
        console.error("❌ Fatal Error:", err.message);
        if (browser) await browser.close();
        setTimeout(startBrowser, 5000);
    }
}

startBrowser();