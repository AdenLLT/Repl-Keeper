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
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        if (fs.existsSync(cookiesPath)) {
            const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
            await page.setCookie(...cookies);
            console.log(`✓ Cookies loaded (${cookies.length} cookies)`);
        } else {
            console.log('⚠️  No cookies found - you may need to log in first!');
        }

        const WORKSPACE_URL = 'https://replit.com/@HUDV1/mb#main.py';

        const runLogic = async () => {
            console.log(`\n🔄 [${new Date().toLocaleTimeString()}] Refreshing/Checking Workspace...`);

            try {
                await page.goto(WORKSPACE_URL, { waitUntil: 'domcontentloaded', timeout: 180000 });

                console.log('⏳ Waiting for Replit interface to fully load (30 seconds)...');
                await sleep(30000);

                // Debug: Check what's actually on the page
                const pageInfo = await page.evaluate(() => {
                    return {
                        title: document.title,
                        url: window.location.href,
                        hasRunButton: !!document.querySelector('button[data-cy="ws-run-btn"]'),
                        allDataCyButtons: Array.from(document.querySelectorAll('button[data-cy]')).map(b => ({
                            dataCy: b.getAttribute('data-cy'),
                            ariaLabel: b.getAttribute('aria-label'),
                            visible: b.offsetParent !== null
                        })),
                        allButtons: Array.from(document.querySelectorAll('button')).length
                    };
                });

                console.log('\n' + '='.repeat(80));
                console.log('📊 PAGE DEBUG INFO');
                console.log('='.repeat(80));
                console.log('Title:', pageInfo.title);
                console.log('URL:', pageInfo.url);
                console.log('Total buttons:', pageInfo.allButtons);
                console.log('Run button found:', pageInfo.hasRunButton);

                console.log('\n🔘 All buttons with data-cy attribute:');
                if (pageInfo.allDataCyButtons.length === 0) {
                    console.log('   ⚠️  NO BUTTONS WITH data-cy FOUND!');
                } else {
                    pageInfo.allDataCyButtons.forEach((btn, i) => {
                        console.log(`   ${i + 1}. data-cy="${btn.dataCy}" aria-label="${btn.ariaLabel}" visible=${btn.visible}`);
                    });
                }
                console.log('='.repeat(80) + '\n');

                // Click at exact coordinates (150, 17) - 3 attempts
                for (let i = 1; i <= 3; i++) {
                    console.log(`\n🎯 Attempt ${i}/3 - Clicking at coordinates (150, 17)...`);

                    try {
                        await page.mouse.click(150, 17);
                        console.log(`✅ Click ${i}/3 completed at X:940, Y:353`);
                    } catch (err) {
                        console.log(`⚠️  Click ${i}/3 failed: ${err.message}`);
                    }

                    if (i < 3) {
                        console.log(`⏱️  Waiting 10 seconds...`);
                        await sleep(10000);
                    }
                }

                console.log(`\n✅ Completed all 3 click attempts`);

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