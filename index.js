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
        const runButtonSelector = 'button[aria-label="Run"]';

        const runLogic = async () => {
            console.log(`\n🔄 [${new Date().toLocaleTimeString()}] Starting button clicking cycle...`);

            try {
                await page.goto(WORKSPACE_URL, {
                    waitUntil: 'domcontentloaded',
                    timeout: 180000
                });

                console.log('⏳ Waiting for Replit interface to fully load (30 seconds)...');
                await sleep(30000);

                // ✅ WAIT FOR RUN BUTTON
                await page.waitForSelector(runButtonSelector, { timeout: 60000 });

                // ✅ FORCE FOCUS
                await page.bringToFront();
                await page.focus('body');

                // ✅ REAL MOUSE CLICK
                try {
                    const runBtn = await page.$(runButtonSelector);
                    const box = await runBtn.boundingBox();

                    await page.mouse.move(
                        box.x + box.width / 2,
                        box.y + box.height / 2,
                        { steps: 20 }
                    );

                    await page.mouse.down();
                    await page.waitForTimeout(50);
                    await page.mouse.up();

                    // ✅ KEYBOARD SHORTCUT
                    await page.keyboard.down('Control');
                    await page.keyboard.press('Enter');
                    await page.keyboard.up('Control');
                } catch (err) {}

                const buttons = await page.evaluate(() => {
                    const btns = Array.from(document.querySelectorAll('button[type="button"]'));
                    return btns.map((btn, index) => ({
                        index,
                        text: btn.innerText.trim().substring(0, 50) || 'No text',
                        ariaLabel: btn.getAttribute('aria-label') || 'No aria-label',
                        dataCy: btn.getAttribute('data-cy') || 'No data-cy',
                        className: btn.className.substring(0, 100) || 'No class',
                        visible: btn.offsetParent !== null
                    }));
                });

                console.log(`\n📊 Found ${buttons.length} buttons with type="button"`);
                console.log('='.repeat(80));

                console.log('\n⌨️  Typing "HI" in input field...');
                try {
                    await page.type('#:rn:-input', 'HI');
                    console.log('✅ Successfully typed "HI"');
                } catch (err) {
                    console.log(`⚠️  Failed to type in input: ${err.message}`);
                }
                console.log('');

                for (let i = 0; i < buttons.length; i++) {
                    const btnInfo = buttons[i];

                    console.log(`\n🎯 Button ${i + 1}/${buttons.length}:`);
                    console.log(`   Text: "${btnInfo.text}"`);
                    console.log(`   Aria-label: "${btnInfo.ariaLabel}"`);
                    console.log(`   Data-cy: "${btnInfo.dataCy}"`);
                    console.log(`   Visible: ${btnInfo.visible}`);
                    console.log(`   Class: ${btnInfo.className}`);

                    try {
                        await page.evaluate((index) => {
                            const buttons = document.querySelectorAll('button[type="button"]');
                            if (buttons[index]) buttons[index].click();
                        }, i);
                        console.log(`   ✅ Clicked successfully!`);
                    } catch (err) {
                        console.log(`   ⚠️  Click failed: ${err.message}`);
                    }

                    if (i < buttons.length - 1) {
                        console.log(`   ⏱️  Waiting 1 minute before next button...`);
                        await sleep(60000);
                    }
                }

                console.log('\n' + '='.repeat(80));
                console.log(`✅ Completed clicking all ${buttons.length} buttons`);

                const cookies = await page.cookies();
                fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));

            } catch (err) {
                console.log(`⚠️  Error in runLogic: ${err.message}`);
            }
        };

        await runLogic();
        setInterval(runLogic, 5 * 60 * 1000);

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