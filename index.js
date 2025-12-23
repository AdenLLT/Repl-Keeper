const puppeteer = require('puppeteer-core');
const express = require('express');
const fs = require('fs');
const app = express();

app.get('/', (req, res) => res.send('Keeper is Active'));
app.listen(8080);

// Function to find Chrome executable
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

async function clickRunButton(page) {
    try {
        console.log("Searching for run button...");

        // Try to find the run button with multiple selectors
        const selectors = [
            'button[data-cy="ws-run-btn"]',
            'button[aria-label*="Run"]',
            'button[aria-label*="run"]'
        ];

        let runButton = null;
        let usedSelector = null;

        for (const selector of selectors) {
            try {
                await page.waitForSelector(selector, { timeout: 5000 });
                runButton = await page.$(selector);
                if (runButton) {
                    usedSelector = selector;
                    console.log(`✓ Found run button with selector: ${selector}`);
                    break;
                }
            } catch (e) {
                // Try next selector
            }
        }

        if (!runButton) {
            console.log("✗ Run button not found");
            return;
        }

        // Check the icon state
        const buttonStatus = await page.evaluate((selector) => {
            const button = document.querySelector(selector);
            if (!button) return { found: false };

            const svg = button.querySelector('svg');
            if (!svg) return { found: true, hasIcon: false };

            // Check for play icon (triangle - means stopped, needs to run)
            const playPath = svg.querySelector('path[d*="20.593"]');

            // Check for stop icon (square - means running)
            const stopPath = svg.querySelector('path[d*="3.25 6"]');

            return {
                found: true,
                hasIcon: true,
                isPlayIcon: !!playPath,
                isStopIcon: !!stopPath,
                svgFill: svg.getAttribute('fill')
            };
        }, usedSelector);

        console.log("Button status:", JSON.stringify(buttonStatus, null, 2));

        if (buttonStatus.isPlayIcon) {
            console.log("✓ Replit is STOPPED (Play icon showing). Clicking RUN button...");
            await page.click(usedSelector);
            console.log("✓ Run button clicked!");
            await page.waitForTimeout(3000);
        } else if (buttonStatus.isStopIcon) {
            console.log("→ Replit is RUNNING (Stop icon showing). No action needed.");
        } else {
            console.log("? Cannot determine button state");
        }

    } catch (error) {
        console.log("Error in clickRunButton:", error.message);
    }
}

async function startBrowser() {
    console.log("Starting browser with explicit path...");
    try {
        const chromePath = findChrome();

        const browser = await puppeteer.launch({
            headless: "new",
            executablePath: chromePath,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--single-process',
                '--no-zygote',
                '--disable-blink-features=AutomationControlled'
            ]
        });

        console.log("Browser launched successfully!");

        const page = await browser.newPage();

        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });
        });

        // STEP 1: Go to replit.com first to establish the domain
        console.log("STEP 1: Visiting replit.com to establish domain...");
        await page.goto('https://replit.com', { 
            waitUntil: 'domcontentloaded',
            timeout: 60000 
        });
        console.log("✓ Domain established");

        // STEP 2: Now set the cookies
        console.log("STEP 2: Setting authentication cookies...");
        await page.setCookie({
            name: 'connect.sid',
            value: 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImM0MTZJUSJ9.eyJpc3MiOiJodHRwczovL3Nlc3Npb24uZmlyZWJhc2UuZ29vZ2xlLmNvbS9yZXBsaXQtd2ViIiwicm9sZXMiOltdLCJhdWQiOiJyZXBsaXQtd2ViIiwiYXV0aF90aW1lIjoxNzY2MjI5MzE4LCJ1c2VyX2lkIjoiNmpLSXNXVjBLdmhNT2Z5OE53VmlHMXJOaDVCMyIsInN1YiI6IjZqS0lzV1YwS3ZoTU9meThOd1ZpRzFyTmg1QjMiLCJpYXQiOjE3NjYzMDc2NTAsImV4cCI6MTc2NjkxMjQ1MCwiZW1haWwiOiJhZGVuZ3JlZW4xMTFAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZ29vZ2xlLmNvbSI6WyIxMDExNzQ4Nzk3NjkxOTEyMDU2NzIiXSwiZW1haWwiOlsiYWRlbmdyZWVuMTExQGdtYWlsLmNvbSJdfSwic2lnbl9pbl9wcm92aWRlciI6Imdvb2dsZS5jb20ifX0.nXS6PDeDR7neFaIVVRjuPJSN2Aa8mXY-7vGVNx0lQsfXgZ_AhzWfuh4xinn-QV9W0SOXJrOc4HBRU08-ubHSv4AwMMMJ2ERpQCNDnVwL99DsbB8jFznWVPYgAADzb5ZHM3FFXPzOe0JoxQ33eSa2EA85-o0q7wOmOZjvfo2FunPiNU95EvzezVbAHL_WPN4TBmcuUZtCsnn-mZkeMOkc6wUUXsJkruACQXlZ-MmIzf9Alq_7B70ilCQX9T8j19yysC0NMIGbjNRHw01bW0ThLnemN89meaOJ_zqfv3FentiXFuQ7SKlpofcQC66sm4C2IPL1j--ByAQPxyJy_JwhaA',
            domain: 'replit.com',
            path: '/',
            httpOnly: true,
            secure: true
        });
        console.log("✓ Cookies set");

        // STEP 3: Now navigate to your specific Replit project WITH the cookies
        console.log("STEP 3: Navigating to your Replit project with authentication...");
        await page.goto('https://replit.com/@HUDV1/mb#main.py', { 
            waitUntil: 'domcontentloaded',
            timeout: 90000 
        });
        console.log("✓ Project page loaded with authentication");

        // Wait for the page to fully load and render
        console.log("Waiting for page to fully render...");
        await page.waitForTimeout(10000);

        // Log page info to verify we're logged in
        const pageInfo = await page.evaluate(() => {
            return {
                url: window.location.href,
                title: document.title,
                buttonCount: document.querySelectorAll('button').length
            };
        });
        console.log("Page Info:", JSON.stringify(pageInfo, null, 2));

        // Check and click run button
        await clickRunButton(page);

        // Refresh every 5 minutes
        setInterval(async () => {
            try {
                console.log("\n=== " + new Date().toLocaleTimeString() + " - Refreshing ===");
                await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
                console.log("✓ Page refreshed");

                await page.waitForTimeout(10000);
                await clickRunButton(page);
            } catch (e) {
                console.log("✗ Refresh failed:", e.message);
            }
        }, 5 * 60 * 1000);

    } catch (err) {
        console.error("LAUNCH ERROR:", err.message);
        console.log("Full Error Stack:", err.stack);
        console.log("\nRetrying in 30 seconds...");

        setTimeout(() => {
            console.log("=== RETRYING BROWSER STARTUP ===");
            startBrowser();
        }, 30000);
    }
}

startBrowser();