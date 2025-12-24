const puppeteer = require('puppeteer-core');
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

// --- Configuration ---
const WORKSPACE_URL = 'https://replit.com/@HUDV1/mb#main.py';
const CHECK_INTERVAL_MINUTES = 1; 
const CHECK_DURATION_SECONDS = 10;
const CHECK_FREQUENCY_MS = 2000; // Check every 2 seconds during the 10-second window
// ---------------------

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

    for (const path of paths) {
        if (fs.existsSync(path)) {
            console.log(`Found Chrome at: ${path}`);
            return path;
        }
    }

    throw new Error('Chrome executable not found');
}

async function checkAndClickRunButton(page) {
    try {
        const result = await page.evaluate(() => {
            const BUTTON_SELECTOR = 'button[data-cy="ws-run-btn"]';
            // We are commenting out the strict icon path check to bypass the SVG path discrepancy
            // const RUN_ICON_PATH_DATA = 'M20.593 10.91a1.25 1.25 0 0 1 0 2.18l-14.48 8.145a1.25 1.25 0 0 1-1.863-1.09V3.855a1.25 1.25 0 0 1 1.863-1.09l14.48 8.146Z';

            const button = document.querySelector(BUTTON_SELECTOR);

            if (button) {
                // Check if the button is ready to be clicked (i.e., not disabled and visible)
                // The 'Stop' button is usually enabled, but the 'Run' button often has a specific state when ready.
                // We assume if the button is visible and not disabled, it's the RUN button in a stopped state.
                const isReadyToRun = !button.disabled; 

                // If button is ready OR if the text is 'Run' (a backup check)
                if (isReadyToRun || button.textContent.trim().toLowerCase() === 'run') { 

                    // Click it!
                    const dispatchEvent = (type) => {
                        const event = new MouseEvent(type, {
                            bubbles: true,
                            cancelable: true,
                            view: window
                        });
                        button.dispatchEvent(event);
                    };
                    dispatchEvent('mousedown');
                    dispatchEvent('mouseup');
                    dispatchEvent('click');

                    return { status: 'CLICKED' };
                } else {
                    return { status: 'RUNNING_OR_LOADING' };
                }
            } else {
                return { status: 'NO_BUTTON' };
            }
        });

        if (result.status === 'CLICKED') {
            console.log('✅ CLICKED RUN BUTTON! (Bypassing icon check)');
        } else if (result.status === 'RUNNING_OR_LOADING') {
            console.log('✓ App is running or loading (Skipped click)');
        } else if (result.status === 'NO_BUTTON') {
            console.log('⚠️ Button not found');
        }

        return result.status;
    } catch (error) {
        console.log('❌ Puppeteer Error during check:', error.message);
        return 'ERROR';
    }
}

// --- NEW SCHEDULING LOGIC ---
async function runCheckRoutine(page) {
    console.log(`\n🔄 Starting check routine: ${CHECK_DURATION_SECONDS}s every ${CHECK_INTERVAL_MINUTES}m...`);
    const startTime = Date.now();
    let interval;

    // Function to run the check repeatedly during the 10-second window
    const checkLoop = async () => {
        const elapsedTime = Date.now() - startTime;

        if (elapsedTime >= CHECK_DURATION_SECONDS * 1000) {
            clearInterval(interval);
            console.log(`\n⏳ Check routine complete. Resuming in ${CHECK_INTERVAL_MINUTES} minute(s).`);

            // Schedule the next check routine
            setTimeout(() => runCheckRoutine(page), CHECK_INTERVAL_MINUTES * 60 * 1000);
            return;
        }

        console.log(`  [${new Date().toLocaleTimeString()}] Checking...`);
        const status = await checkAndClickRunButton(page);

        // OPTIONAL: If we click it, we can stop the check loop immediately since the button state will change.
        if (status === 'CLICKED') {
            clearInterval(interval);
            console.log('✨ Successful click detected. Restarting check routine after a short delay.');
            // Give Replit a few seconds to start the script before restarting the full interval
            setTimeout(() => runCheckRoutine(page), 5000); 
        }
    };

    // Start the immediate loop and store the interval ID
    interval = setInterval(checkLoop, CHECK_FREQUENCY_MS);
}
// -----------------------------


async function startBrowser() {
    console.log("Starting browser...");
    try {
        // ... (findChrome, userDataDir, cookiesPath, browser launch is unchanged)
        const chromePath = findChrome();
        const userDataDir = path.join(__dirname, 'chrome_user_data');
        const cookiesPath = path.join(__dirname, 'replit_cookies.json');

        if (!fs.existsSync(userDataDir)) {
            fs.mkdirSync(userDataDir, { recursive: true });
        }

        const browser = await puppeteer.launch({
            headless: "new",
            executablePath: chromePath,
            userDataDir: userDataDir,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--single-process',
                '--no-zygote'
            ]
        });

        console.log("✓ Browser launched!");

        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        if (fs.existsSync(cookiesPath)) {
            const cookiesString = fs.readFileSync(cookiesPath, 'utf8');
            const cookies = JSON.parse(cookiesString);
            await page.setCookie(...cookies);
            console.log(`✓ Loaded ${cookies.length} cookies`);
        }

        console.log("Navigating to Replit workspace...");
        await page.goto(WORKSPACE_URL, { 
            waitUntil: 'domcontentloaded', 
            timeout: 90000 
        });
        console.log("✓ Workspace loaded!");

        // Initial delay for Replit to fully render the workspace
        await page.waitForTimeout(5000); 

        // Save cookies after initial load (for login sessions)
        const cookies = await page.cookies();
        fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));

        // Start the scheduled checking routine
        await runCheckRoutine(page); 

        // Keep the browser running indefinitely
        await new Promise(() => {}); 

    } catch (err) {
        console.error("Error in startBrowser:", err.message);
        // Attempt to restart browser after a delay if a fatal error occurs
        setTimeout(() => startBrowser(), 30000);
    }
}

startBrowser();