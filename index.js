const puppeteer = require('puppeteer-core');
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

// --- Configuration ---
const WORKSPACE_URL = 'https://replit.com/@HUDV1/mb#main.py'; // <<< VERIFY THIS URL IS CORRECT
const INITIAL_WAIT_SECONDS = 7; // NEW: Wait 7 seconds after loading the workspace
const CHECK_INTERVAL_MINUTES = 1; 
const CHECK_DURATION_SECONDS = 10;
const CHECK_FREQUENCY_MS = 2000; // Check every 2 seconds during the 10-second window
const RUN_BUTTON_SELECTOR = 'button[data-cy="ws-run-btn"]';
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

/**
 * Checks for the presence of the Run button and force-clicks it regardless of disabled state.
 */
async function checkAndClickRunButton(page) {
    try {
        const result = await page.evaluate((selector) => {
            const button = document.querySelector(selector);

            if (button) {
                // If the button element is found, we FORCE the click simulation.
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

                return { status: 'FORCED_CLICK' };
            } else {
                return { status: 'NOT_FOUND' };
            }
        }, RUN_BUTTON_SELECTOR); // Pass the selector into the browser context

        if (result.status === 'FORCED_CLICK') {
            // NOTE: The button may still be disabled, but we forced the click interaction.
            console.log('✅ FORCED CLICK ATTEMPTED.');
        } else if (result.status === 'NOT_FOUND') {
            console.log('⚠️ Run button element not found.');
        }

        return result.status;
    } catch (error) {
        console.log('❌ Puppeteer Error during check:', error.message);
        return 'ERROR';
    }
}


/**
 * Sets up the timed routine to check the button status.
 */
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

        // If we click it, stop the current loop immediately since the state has changed.
        if (status === 'FORCED_CLICK') {
            // Give Replit a few seconds to process the click before restarting the full interval
            clearInterval(interval);
            console.log('✨ Force click dispatched. Restarting check routine after 5 seconds.');
            setTimeout(() => runCheckRoutine(page), 5000); 
        }
    };

    // Start the immediate loop and store the interval ID
    interval = setInterval(checkLoop, CHECK_FREQUENCY_MS);
}


/**
 * Launches the browser, navigates, and waits the required time before starting checks.
 */
async function startBrowser() {
    console.log("Starting browser...");
    try {
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

        // --- NEW TIMED WAIT STEP ---
        console.log(`Waiting ${INITIAL_WAIT_SECONDS} seconds to allow Replit UI to stabilize...`);
        await page.waitForTimeout(INITIAL_WAIT_SECONDS * 1000); 
        // --- END TIMED WAIT STEP ---

        // Save cookies after initial load
        const cookies = await page.cookies();
        fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));

        // Start the scheduled checking routine (it will run the check and click immediately after the wait)
        await runCheckRoutine(page); 

        // Keep the browser running indefinitely
        await new Promise(() => {}); 

    } catch (err) {
        console.error("❌ Fatal Error in startBrowser:", err.message);
        setTimeout(() => startBrowser(), 30000);
    }
}

startBrowser();