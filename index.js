const puppeteer = require('puppeteer-core');
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.get('/', (req, res) => res.send('Keeper is Active'));
app.listen(8080);

function findChrome() {
    const paths = [
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome-stable',
        process.env.CHROME_PATH,
    ].filter(Boolean);

    for (const p of paths) {
        if (fs.existsSync(p)) {
            console.log(`Found Chrome at: ${p}`);
            return p;
        }
    }

    throw new Error('Chrome executable not found');
}

// COMPREHENSIVE DEBUG AND CLICK FUNCTION
async function debugAndClickRunButton(page) {
    try {
        console.log('🔍 Running debug and click function...');
        const result = await page.evaluate(() => {
            const log = [];
            const RUN_ICON_PATH = 'M20.593 10.91a1.25 1.25 0 0 1 0 2.18l-14.48 8.145a1.25 1.25 0 0 1-1.863-1.09V3.855a1.25 1.25 0 0 1 1.863-1.09l14.48 8.146Z';

            // METHOD 1: Try data-cy selector
            log.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            log.push('METHOD 1: Using data-cy selector');
            const btnByCy = document.querySelector('button[data-cy="ws-run-btn"]');
            log.push(`Button found by data-cy: ${!!btnByCy}`);

            if (btnByCy) {
                const svgPath = btnByCy.querySelector('svg path');
                log.push(`SVG path found: ${!!svgPath}`);
                if (svgPath) {
                    const pathD = svgPath.getAttribute('d');
                    log.push(`Path d attribute: ${pathD?.substring(0, 50)}...`);
                    log.push(`Matches RUN icon: ${pathD === RUN_ICON_PATH}`);
                }
                log.push(`Button aria-label: ${btnByCy.getAttribute('aria-label')}`);
                log.push(`Button classes: ${btnByCy.className.substring(0, 100)}...`);
            }

            // METHOD 2: Try XPath
            log.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            log.push('METHOD 2: Using XPath');
            const xpathResult = document.evaluate(
                '/html/body/div[1]/div[1]/div[1]/div/div/div[1]/div/div[3]/div[1]',
                document,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null
            );
            const divByXPath = xpathResult.singleNodeValue;
            log.push(`Div found by XPath: ${!!divByXPath}`);

            let btnByXPath = null;
            if (divByXPath) {
                log.push(`XPath div classes: ${divByXPath.className.substring(0, 100)}...`);
                btnByXPath = divByXPath.querySelector('button');
                log.push(`Button inside XPath div: ${!!btnByXPath}`);
                if (btnByXPath) {
                    log.push(`XPath button data-cy: ${btnByXPath.getAttribute('data-cy')}`);
                    log.push(`XPath button aria-label: ${btnByXPath.getAttribute('aria-label')}`);
                }
            }

            // METHOD 3: Search by aria-label
            log.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            log.push('METHOD 3: Using aria-label');
            const btnByAria = document.querySelector('button[aria-label="Run or stop the app"]');
            log.push(`Button found by aria-label: ${!!btnByAria}`);

            // METHOD 4: Find by class pattern
            log.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            log.push('METHOD 4: Using class pattern');
            const btnByClass = document.querySelector('button.IconButton-module__B3jpBG__root');
            log.push(`Button found by class: ${!!btnByClass}`);

            // METHOD 5: Find all buttons and search
            log.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            log.push('METHOD 5: Scanning all buttons');
            const allButtons = document.querySelectorAll('button');
            log.push(`Total buttons on page: ${allButtons.length}`);

            let targetButton = null;
            allButtons.forEach((btn, idx) => {
                const cy = btn.getAttribute('data-cy');
                const label = btn.getAttribute('aria-label');
                if (cy === 'ws-run-btn' || label === 'Run or stop the app') {
                    log.push(`FOUND TARGET at index ${idx}:`);
                    log.push(`  - data-cy: ${cy}`);
                    log.push(`  - aria-label: ${label}`);
                    log.push(`  - has SVG: ${!!btn.querySelector('svg')}`);
                    targetButton = btn;
                }
            });

            // TRY TO CLICK THE BUTTON
            log.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            log.push('ATTEMPTING TO CLICK...');

            const button = btnByCy || btnByXPath || btnByAria || btnByClass || targetButton;

            if (!button) {
                log.push('❌ NO BUTTON FOUND BY ANY METHOD');
                return { success: false, log: log.join('\n') };
            }

            // Check if it's the RUN icon (not STOP)
            const svgPath = button.querySelector('svg path');
            if (svgPath) {
                const pathD = svgPath.getAttribute('d');
                if (pathD !== RUN_ICON_PATH) {
                    log.push('⏸️  Button found but showing STOP icon (app is running)');
                    log.push(`Current path: ${pathD?.substring(0, 50)}...`);
                    return { success: false, reason: 'NOT_RUN_STATE', log: log.join('\n') };
                }
            }

            // Try multiple click methods
            log.push('Attempting click method 1: Direct click()');
            try {
                button.click();
                log.push('✅ Click method 1 SUCCESS');
            } catch (e) {
                log.push(`❌ Click method 1 FAILED: ${e.message}`);
            }

            log.push('Attempting click method 2: MouseEvent simulation');
            try {
                ['mousedown', 'mouseup', 'click'].forEach(eventType => {
                    const event = new MouseEvent(eventType, {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        button: 0
                    });
                    button.dispatchEvent(event);
                });
                log.push('✅ Click method 2 SUCCESS');
            } catch (e) {
                log.push(`❌ Click method 2 FAILED: ${e.message}`);
            }

            log.push('Attempting click method 3: PointerEvent simulation');
            try {
                ['pointerdown', 'pointerup'].forEach(eventType => {
                    const event = new PointerEvent(eventType, {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        button: 0,
                        buttons: 1
                    });
                    button.dispatchEvent(event);
                });
                button.click();
                log.push('✅ Click method 3 SUCCESS');
            } catch (e) {
                log.push(`❌ Click method 3 FAILED: ${e.message}`);
            }

            return { success: true, log: log.join('\n') };
        });

        console.log('\n' + '═'.repeat(60));
        console.log(`[${new Date().toLocaleTimeString()}] DEBUG REPORT`);
        console.log('═'.repeat(60));
        console.log(result.log);
        console.log('═'.repeat(60) + '\n');

        return result;

    } catch (error) {
        console.log(`\n❌ CRITICAL ERROR: ${error.message}\n`);
        console.log(`Stack: ${error.stack}\n`);
        return { success: false, error: error.message };
    }
}

// Alternative: Use Puppeteer's built-in click
async function puppeteerClick(page) {
    try {
        console.log('🔧 Attempting Puppeteer native click...');

        // Try multiple selectors
        const selectors = [
            'button[data-cy="ws-run-btn"]',
            'button[aria-label="Run or stop the app"]',
            'button.IconButton-module__B3jpBG__root'
        ];

        for (const selector of selectors) {
            try {
                await page.waitForSelector(selector, { timeout: 2000 });
                await page.click(selector);
                console.log(`✅ Puppeteer click SUCCESS with selector: ${selector}\n`);
                return true;
            } catch (e) {
                console.log(`❌ Selector "${selector}" failed: ${e.message}`);
            }
        }

        console.log('❌ All Puppeteer click methods failed\n');
        return false;
    } catch (error) {
        console.log(`❌ Puppeteer click error: ${error.message}\n`);
        return false;
    }
}

async function startBrowser() {
    console.log("Starting browser...");
    try {
        const chromePath = findChrome();
        const userDataDir = path.join(__dirname, 'chrome_user_data');
        const cookiesPath = path.join(__dirname, 'replit_cookies.json');

        if (!fs.existsSync(userDataDir)) {
            fs.mkdirSync(userDataDir, { recursive: true });
        }

        console.log("Launching browser with aggressive settings...");
        const browser = await puppeteer.launch({
            headless: "new",
            executablePath: chromePath,
            userDataDir: userDataDir,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--disable-extensions',
                '--disable-background-networking',
                '--disable-sync',
                '--disable-translate',
                '--disable-features=site-per-process',
                '--metrics-recording-only',
                '--mute-audio',
                '--no-first-run',
                '--safebrowsing-disable-auto-update',
                '--single-process',
                '--no-zygote',
                '--js-flags=--max-old-space-size=256'
            ]
        });

        console.log("✓ Browser launched!");

        const page = await browser.newPage();

        console.log("Setting up page...");
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Set default timeout
        page.setDefaultNavigationTimeout(120000); // 2 minutes
        page.setDefaultTimeout(30000); // 30 seconds for other operations

        // Load cookies if they exist
        if (fs.existsSync(cookiesPath)) {
            const cookiesString = fs.readFileSync(cookiesPath, 'utf8');
            const cookies = JSON.parse(cookiesString);
            await page.setCookie(...cookies);
            console.log(`✓ Loaded ${cookies.length} cookies`);
        }

        const WORKSPACE_URL = 'https://replit.com/@HUDV1/mb#main.py';

        console.log("Navigating to Replit workspace...");
        console.log("⏳ This may take up to 2 minutes...");

        // Try navigation with different strategies
        try {
            await page.goto(WORKSPACE_URL, { 
                waitUntil: 'domcontentloaded', // Less strict than networkidle2
                timeout: 120000 
            });
            console.log("✓ Page loaded (domcontentloaded)!");
        } catch (navError) {
            console.log(`⚠️  Navigation warning: ${navError.message}`);
            console.log("Trying to continue anyway...");
        }

        // Wait for page to stabilize
        console.log("Waiting for page to stabilize (15 seconds)...");
        await new Promise(resolve => setTimeout(resolve, 15000));

        console.log("✓ Wait complete!");

        // Save cookies after first load
        try {
            const cookies = await page.cookies();
            fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
            console.log(`✓ Saved ${cookies.length} cookies`);
        } catch (e) {
            console.log(`⚠️  Cookie save warning: ${e.message}`);
        }

        console.log("\n" + "🚀".repeat(30));
        console.log("STARTING MONITOR LOOP WITH FULL DEBUGGING");
        console.log("🚀".repeat(30) + "\n");

        // Run initial debug
        console.log("Running initial check...");
        await debugAndClickRunButton(page);

        // Then try puppeteer click
        await puppeteerClick(page);

        // Monitor every 5 seconds
        let checkCount = 0;
        console.log("\n⏰ Setting up 5-second interval monitor...");
        const monitorInterval = setInterval(async () => {
            checkCount++;
            console.log(`\n${'═'.repeat(60)}`);
            console.log(`🔍 Check #${checkCount} at ${new Date().toLocaleTimeString()}`);
            console.log('═'.repeat(60));

            try {
                // Every 5th check, do full debug. Otherwise just try click
                if (checkCount % 5 === 0) {
                    await debugAndClickRunButton(page);
                } else {
                    const clicked = await puppeteerClick(page);
                    if (!clicked) {
                        // If puppeteer fails, try evaluate click
                        await debugAndClickRunButton(page);
                    }
                }
            } catch (err) {
                console.log(`❌ Monitor error: ${err.message}`);
            }
        }, 5000);

        console.log("✓ Monitor interval started!");

        // Refresh every 6 minutes
        console.log("⏰ Setting up 6-minute refresh interval...");
        const refreshInterval = setInterval(async () => {
            try {
                console.log(`\n${'🔄'.repeat(30)}`);
                console.log(`REFRESHING PAGE at ${new Date().toLocaleTimeString()}`);
                console.log('🔄'.repeat(30));

                await page.goto(WORKSPACE_URL, { 
                    waitUntil: 'domcontentloaded', 
                    timeout: 120000 
                }).catch(e => {
                    console.log(`⚠️  Refresh navigation warning: ${e.message}`);
                });

                console.log('✓ Page reloaded, waiting 15 seconds...');
                await new Promise(resolve => setTimeout(resolve, 15000));

                const cookies = await page.cookies();
                fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));

                console.log('✓ Running post-refresh debug...');
                await debugAndClickRunButton(page);

                checkCount = 0; // Reset counter after refresh
            } catch (e) {
                console.log('✗ Refresh failed:', e.message);
            }
        }, 6 * 60 * 1000);

        console.log("✓ Refresh interval started!");
        console.log("\n✅ ALL SYSTEMS OPERATIONAL!\n");

        // Keep process alive
        await new Promise(() => {});

    } catch (err) {
        console.error("\n❌ FATAL ERROR:", err.message);
        console.error("Stack trace:", err.stack);
        console.log("\n🔄 Restarting in 30 seconds...\n");
        setTimeout(() => startBrowser(), 30000);
    }
}

console.log("🎬 SCRIPT STARTING...\n");
startBrowser();