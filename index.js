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
    const RELOAD_INTERVAL = 60 * 60 * 1000; // Reload every 60 minutes

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

        // Pass browser logs to terminal
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
                await sleep(30000); // Wait for hydration

                await page.addScriptTag({
                    content: `
                    (function() {
                        console.log('🚀 Keeper v2.3: Monitoring Started');
                        const RUN_SELECTOR = 'button[data-cy="ws-run-btn"]';
                        const PLAY_PATH = 'M20.593 10.91a1.25 1.25 0 0 1 0 2.18l-14.48 8.145a1.25 1.25 0 0 1-1.863-1.09V3.855a1.25 1.25 0 0 1 1.863-1.09l14.48 8.146Z';

                        function findInShadow(sel, root = document) {
                            let el = root.querySelector(sel);
                            if (el) return [el];
                            let found = [];
                            root.querySelectorAll('*').forEach(node => {
                                if (node.shadowRoot) found.push(...findInShadow(sel, node.shadowRoot));
                            });
                            return found;
                        }

                        setInterval(() => {
                            const btn = findInShadow(RUN_SELECTOR)[0];
                            if (btn) {
                                if (btn.innerHTML.includes(PLAY_PATH)) {
                                    console.log('▶️ Clicked Run');
                                    ['mousedown', 'mouseup', 'click'].forEach(t => 
                                        btn.dispatchEvent(new MouseEvent(t, {bubbles: true, view: window})));
                                } else {
                                    console.log('✅ App Running');
                                }
                            } else {
                                console.log('🔍 Searching for button...');
                            }
                        }, 15000);
                    })();`
                });
                console.log('✓ Script injected successfully.');
            } catch (e) {
                console.error("Load failed, retrying in 30s...", e.message);
                await sleep(30000);
                return loadAndInject();
            }
        }

        // Initial Load
        await loadAndInject();

        // Periodically refresh the page to prevent WebSocket/Memory death
        setInterval(async () => {
            console.log("🔄 Performing scheduled 60-minute refresh...");
            await loadAndInject();
        }, RELOAD_INTERVAL);

        // Keep process alive
        await new Promise(() => {});

    } catch (err) {
        console.error("❌ Fatal Error:", err.message);
        if (browser) await browser.close();
        setTimeout(startBrowser, 10000); // Restart entire browser on crash
    }
}

startBrowser();