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
                        allButtons: Array.from(document.querySelectorAll('button')).length,
                        bodyTextStart: document.body.innerText.substring(0, 1000),
                        htmlSnippet: document.body.innerHTML.substring(0, 2000)
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

                console.log('\n📄 Body text (first 500 chars):');
                console.log(pageInfo.bodyTextStart.substring(0, 500));

                console.log('\n🔍 HTML snippet (first 1000 chars):');
                console.log(pageInfo.htmlSnippet.substring(0, 1000));
                console.log('='.repeat(80) + '\n');

                if (!pageInfo.hasRunButton) {
                    console.log('\n⚠️  RUN BUTTON NOT FOUND!');
                    console.log('Possible reasons:');
                    console.log('   1. ❌ Not logged in - cookies expired or invalid');
                    console.log('   2. ❌ Page showing login/signup screen');
                    console.log('   3. ❌ Workspace requires authentication');
                    console.log('   4. ❌ Page structure changed');
                    console.log('   5. ❌ JavaScript not fully loaded\n');
                }

                // Try clicking only if button exists
                if (pageInfo.hasRunButton) {
                    for (let i = 1; i <= 3; i++) {
                        console.log(`\n🎯 Attempt ${i}/3 - Clicking run button...`);

                        const result = await page.evaluate(() => {
                            const button = document.querySelector('button[data-cy="ws-run-btn"]');

                            if (!button) {
                                return { success: false, reason: 'Button not found' };
                            }

                            const path = button.querySelector('svg path');
                            if (!path) {
                                return { success: false, reason: 'No SVG path found' };
                            }

                            const pathD = path.getAttribute('d');
                            const runIconPath = 'M20.593 10.91a1.25 1.25 0 0 1 0 2.18l-14.48 8.145a1.25 1.25 0 0 1-1.863-1.09V3.855a1.25 1.25 0 0 1 1.863-1.09l14.48 8.146Z';

                            if (pathD !== runIconPath) {
                                return { 
                                    success: false, 
                                    reason: 'Button is not in RUN state',
                                    pathPreview: pathD ? pathD.substring(0, 40) + '...' : 'null'
                                };
                            }

                            const events = [
                                new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1 }),
                                new MouseEvent('mousedown', { bubbles: true, cancelable: true }),
                                new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1 }),
                                new MouseEvent('mouseup', { bubbles: true, cancelable: true }),
                                new MouseEvent('click', { bubbles: true, cancelable: true }),
                            ];

                            events.forEach(event => button.dispatchEvent(event));
                            button.click();

                            return { success: true, reason: 'Clicked RUN button' };
                        });

                        if (result.success) {
                            console.log(`✅ Click ${i}/3 successful!`);
                        } else {
                            console.log(`⚠️  Click ${i}/3 failed: ${result.reason}`);
                            if (result.pathPreview) {
                                console.log(`   Path: ${result.pathPreview}`);
                            }
                        }

                        if (i < 3) {
                            console.log(`⏱️  Waiting 10 seconds...`);
                            await sleep(10000);
                        }
                    }

                    console.log(`\n✅ Completed all 3 click attempts`);
                } else {
                    console.log('⏭️  Skipping clicks - button not found\n');
                }

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