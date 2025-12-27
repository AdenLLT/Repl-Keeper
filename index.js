const puppeteer = require('puppeteer-core');
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.get('/', (req, res) => res.send('Keeper Active'));
app.listen(8080);

function findChrome() {
    const paths = [
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        process.env.CHROME_PATH
    ].filter(Boolean);

    for (const p of paths) {
        if (fs.existsSync(p)) return p;
    }
    throw new Error('Chrome not found');
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let browser = null;
let page = null;
let startTime = Date.now();

async function closeBrowser() {
    console.log('🔄 Closing browser...');
    try {
        if (page) await page.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
    } catch (err) {
        console.log('⚠️ Error closing browser:', err.message);
    }
    browser = null;
    page = null;
}

async function startBrowser() {
    console.log("🚀 Starting browser...");
    startTime = Date.now();

    const userDataDir = path.join(__dirname, 'chrome_user_data');
    const cookiesPath = path.join(__dirname, 'replit_cookies.json');

    try {
        const chromePath = findChrome();
        browser = await puppeteer.launch({
            headless: "new",
            executablePath: chromePath,
            userDataDir: userDataDir,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-blink-features=AutomationControlled'
            ]
        });

        page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

        // Enhanced logging
        page.on('console', msg => {
            const text = msg.text();
            if (!text.includes('WebSocket') && !text.includes('Failed to load')) {
                console.log(`[BROWSER] ${text}`);
            }
        });

        // Load cookies if they exist
        if (fs.existsSync(cookiesPath)) {
            const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
            await page.setCookie(...cookies);
            console.log('✓ Cookies loaded');
        }

        console.log('⏳ Navigating to Workspace...');
        await page.goto('https://replit.com/@HUDV1/mb#main.py', {
            waitUntil: 'networkidle2',
            timeout: 180000
        });

        console.log('⏳ Waiting for page to stabilize...');
        await sleep(45000);

        // Inject improved keeper script
        await page.addScriptTag({
            content: `
            (function() {
                console.log('🚀 Keeper v3.0 Active');

                const RUN_SELECTOR = 'button[data-cy="ws-run-btn"]';
                const PLAY_SVG = 'M20.593 10.91a1.25 1.25 0 0 1 0 2.18';
                let lastClickTime = 0;
                let consecutiveFailures = 0;

                function findInShadow(sel, root = document) {
                    let el = root.querySelector(sel);
                    if (el) return [el];

                    let found = [];
                    root.querySelectorAll('*').forEach(node => {
                        if (node.shadowRoot) {
                            found.push(...findInShadow(sel, node.shadowRoot));
                        }
                    });
                    return found;
                }

                function clickButton(btn) {
                    const now = Date.now();
                    if (now - lastClickTime < 5000) return false;

                    try {
                        // Multiple click strategies
                        btn.focus();

                        // Direct click
                        btn.click();

                        // Event simulation
                        ['mousedown', 'mouseup', 'click'].forEach(eventType => {
                            const event = new MouseEvent(eventType, {
                                bubbles: true,
                                cancelable: true,
                                view: window,
                                button: 0
                            });
                            btn.dispatchEvent(event);
                        });

                        // Pointer events
                        ['pointerdown', 'pointerup'].forEach(eventType => {
                            const event = new PointerEvent(eventType, {
                                bubbles: true,
                                cancelable: true,
                                view: window,
                                button: 0
                            });
                            btn.dispatchEvent(event);
                        });

                        lastClickTime = now;
                        consecutiveFailures = 0;
                        console.log('▶️ Run button clicked successfully');
                        return true;
                    } catch (err) {
                        console.error('❌ Click error:', err.message);
                        return false;
                    }
                }

                function checkAndClick() {
                    try {
                        const buttons = findInShadow(RUN_SELECTOR);

                        if (buttons.length === 0) {
                            consecutiveFailures++;
                            if (consecutiveFailures % 6 === 0) {
                                console.log('🔍 Searching for Run button...');
                            }
                            return;
                        }

                        const btn = buttons[0];
                        const isStopped = btn.innerHTML.includes(PLAY_SVG);

                        if (isStopped) {
                            console.log('⚠️ Repl is stopped! Attempting to start...');
                            clickButton(btn);
                        } else {
                            if (consecutiveFailures > 0) {
                                console.log('✅ Repl is running');
                                consecutiveFailures = 0;
                            }
                        }
                    } catch (err) {
                        console.error('❌ Check error:', err.message);
                    }
                }

                // Check every 8 seconds
                setInterval(checkAndClick, 8000);

                // Initial check after 3 seconds
                setTimeout(checkAndClick, 3000);

                console.log('✓ Monitoring started');
            })();
            `
        });

        console.log('✓ Keeper script injected and running');

        // Monitor and restart after 50 minutes
        const restartInterval = setInterval(async () => {
            const uptime = Date.now() - startTime;
            const uptimeMinutes = Math.floor(uptime / 60000);

            if (uptimeMinutes >= 50) {
                console.log(`⏰ Browser uptime: ${uptimeMinutes} minutes - initiating restart...`);
                clearInterval(restartInterval);
                await closeBrowser();
                await sleep(5000);
                startBrowser();
            }
        }, 60000); // Check every minute

        // Keep alive - monitor page health
        const healthCheck = setInterval(async () => {
            try {
                if (!page || page.isClosed()) {
                    console.log('❌ Page closed unexpectedly - restarting...');
                    clearInterval(healthCheck);
                    clearInterval(restartInterval);
                    await closeBrowser();
                    await sleep(5000);
                    startBrowser();
                }
            } catch (err) {
                console.log('❌ Health check failed - restarting...');
                clearInterval(healthCheck);
                clearInterval(restartInterval);
                await closeBrowser();
                await sleep(5000);
                startBrowser();
            }
        }, 30000); // Check every 30 seconds

    } catch (err) {
        console.error("❌ Fatal error:", err.message);
        await closeBrowser();
        console.log('🔄 Restarting in 10 seconds...');
        await sleep(10000);
        startBrowser();
    }
}

// Handle process signals
process.on('SIGTERM', async () => {
    console.log('📴 Received SIGTERM - shutting down gracefully...');
    await closeBrowser();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('📴 Received SIGINT - shutting down gracefully...');
    await closeBrowser();
    process.exit(0);
});

// Start the keeper
startBrowser();