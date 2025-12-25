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
    console.log("Starting browser...");
    const userDataDir = path.join(__dirname, 'chrome_user_data');
    const cookiesPath = path.join(__dirname, 'replit_cookies.json');
    let browser = null;

    try {
        const chromePath = findChrome();
        browser = await puppeteer.launch({
            headless: "new",
            executablePath: chromePath,
            userDataDir: userDataDir,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-web-security']
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`));

        if (fs.existsSync(cookiesPath)) {
            const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
            await page.setCookie(...cookies);
            console.log(`✓ Cookies loaded`);
        }

        console.log('⏳ Navigating to Workspace...');
        // Increased timeout to 3 minutes because Replit is slow on Koyeb
        await page.goto('https://replit.com/@HUDV1/mb#main.py', { waitUntil: 'networkidle2', timeout: 180000 });

        console.log('⏳ Waiting 60s for full load...');
        await sleep(60000);

        await page.addScriptTag({
            content: `
            (function() {
                console.log('🚀 Keeper v2.2 Active');
                const RUN_SELECTOR = 'button[data-cy="ws-run-btn"]';
                const PLAY_PATH = 'M20.593 10.91a1.25 1.25 0 0 1 0 2.18';

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
                    if (btn && btn.innerHTML.includes(PLAY_PATH)) {
                        console.log('▶️ Clicking Run');
                        ['mousedown', 'mouseup', 'click'].forEach(t => 
                            btn.dispatchEvent(new MouseEvent(t, {bubbles: true, view: window})));
                    } else if (btn) {
                        console.log('✅ Running...');
                    } else {
                        console.log('🔍 Searching...');
                    }
                }, 10000);
            })();`
        });

        console.log('✓ Script injected. Monitoring...');

        // Just stay alive - let the browser handle its own persistence
        await new Promise(() => {});

    } catch (err) {
        console.error("❌ Error:", err.message);
        if (browser) await browser.close();
        setTimeout(startBrowser, 10000);
    }
}

startBrowser();