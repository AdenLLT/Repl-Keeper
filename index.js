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

        // First, let's see what buttons exist on the page
        const pageInfo = await page.evaluate(() => {
            const allButtons = document.querySelectorAll('button');
            const buttonInfo = [];

            allButtons.forEach((btn, index) => {
                const dataCy = btn.getAttribute('data-cy');
                const ariaLabel = btn.getAttribute('aria-label');
                const textContent = btn.textContent?.trim().substring(0, 50);

                if (dataCy || ariaLabel || textContent) {
                    buttonInfo.push({
                        index,
                        dataCy,
                        ariaLabel,
                        textContent
                    });
                }
            });

            return {
                url: window.location.href,
                buttonCount: allButtons.length,
                buttons: buttonInfo.slice(0, 20) // First 20 buttons
            };
        });

        console.log("Page URL:", pageInfo.url);
        console.log("Total buttons found:", pageInfo.buttonCount);
        console.log("Button samples:", JSON.stringify(pageInfo.buttons, null, 2));

        // Try to find the run button with multiple selectors
        const selectors = [
            'button[data-cy="ws-run-btn"]',
            'button[aria-label*="Run"]',
            'button[aria-label*="run"]',
            'button[aria-label*="Start"]',
            'button[aria-label*="start"]'
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
            console.log("✗ Run button not found with any selector");
            return;
        }

        // Check the icon state
        const buttonStatus = await page.evaluate((selector) => {
            const button = document.querySelector(selector);
            if (!button) return { found: false };

            const svg = button.querySelector('svg');
            if (!svg) return { found: true, hasIcon: false };

            const allPaths = button.querySelectorAll('path');
            const pathData = [];

            allPaths.forEach(path => {
                const d = path.getAttribute('d');
                if (d) {
                    pathData.push(d.substring(0, 50)); // First 50 chars
                }
            });

            // Check for play icon
            const playPath = svg.querySelector('path[d*="20.593"]');

            // Check for stop icon
            const stopPath = svg.querySelector('path[d*="3.25 6"]');

            return {
                found: true,
                hasIcon: true,
                isPlayIcon: !!playPath,
                isStopIcon: !!stopPath,
                svgFill: svg.getAttribute('fill'),
                pathCount: allPaths.length,
                pathData: pathData
            };
        }, usedSelector);

        console.log("Button status:", JSON.stringify(buttonStatus, null, 2));

        if (buttonStatus.isPlayIcon) {
            console.log("✓ Replit is STOPPED. Clicking RUN button...");
            await page.click(usedSelector);
            console.log("✓ Run button clicked!");
            await page.waitForTimeout(3000);
        } else if (buttonStatus.isStopIcon) {
            console.log("→ Replit is RUNNING. No action needed.");
        } else {
            console.log("? Cannot determine button state from icon");
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

        await page.setCookie({
            name: 'connect.sid',
            value: 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImM0MTZJUSJ9.eyJpc3MiOiJodHRwczovL3Nlc3Npb24uZmlyZWJhc2UuZ29vZ2xlLmNvbS9yZXBsaXQtd2ViIiwicm9sZXMiOltdLCJhdWQiOiJyZXBsaXQtd2ViIiwiYXV0aF90aW1lIjoxNzY2MjI5MzE4LCJ1c2VyX2lkIjoiNmpLSXNXVjBLdmhNT2Z5OE53VmlHMXJOaDVCMyIsInN1YiI6IjZqS0lzV1YwS3ZoTU9meThOd1ZpRzFyTmg1QjMiLCJpYXQiOjE3NjYzMDc2NTAsImV4cCI6MTc2NjkxMjQ1MCwiZW1haWwiOiJhZGVuZ3JlZW4xMTFAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZ29vZ2xlLmNvbSI6WyIxMDExNzQ4Nzk3NjkxOTEyMDU2NzIiXSwiZW1haWwiOlsiYWRlbmdyZWVuMTExQGdtYWlsLmNvbSJdfSwic2lnbl9pbl9wcm92aWRlciI6Imdvb2dsZS5jb20ifX0.nXS6PDeDR7neFaIVVRjuPJSN2Aa8mXY-7vGVNx0lQsfXgZ_AhzWfuh4xinn-QV9W0SOXJrOc4HBRU08-ubHSv4AwMMMJ2ERpQCNDnVwL99DsbB8jFznWVPYgAADzb5ZHM3FFXPzOe0JoxQ33eSa2EA85-o0q7wOmOZjvfo2FunPiNU95EvzezVbAHL_WPN4TBmcuUZtCsnn-mZkeMOkc6wUUXsJkruACQXlZ-MmIzf9Alq_7B70ilCQX9T8j19yysC0NMIGbjNRHw01bW0ThLnemN89meaOJ_zqfv3FentiXFuQ7SKlpofcQC66sm4C2IPL1j--ByAQPxyJy_JwhaA',
            domain: 'replit.com',
            path: '/',
            httpOnly: true,
            secure: true
        });

        console.log("Navigating to Replit...");

        let navigationSuccess = false;
        let attempts = 0;
        const maxAttempts = 3;

        while (!navigationSuccess && attempts < maxAttempts) {
            try {
                attempts++;
                console.log(`Navigation attempt ${attempts}/${maxAttempts}...`);

                await page.goto('https://replit.com/@HUDV1/mb#main.py', { 
                    waitUntil: 'domcontentloaded',
                    timeout: 90000 
                });

                navigationSuccess = true;
                console.log("SUCCESS: Replit project loaded.");

            } catch (navError) {
                console.log(`Navigation attempt ${attempts} failed:`, navError.message);
                if (attempts < maxAttempts) {
                    console.log("Retrying in 5 seconds...");
                    await page.waitForTimeout(5000);
                }
            }
        }

        if (!navigationSuccess) {
            throw new Error("Failed to load page after all attempts");
        }

        // Wait for page to settle
        await page.waitForTimeout(10000);

        // Check and click run button
        await clickRunButton(page);

        // Refresh every 5 minutes
        setInterval(async () => {
            try {
                console.log("\n--- Refreshing page ---");
                await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
                console.log("Refresh successful: " + new Date().toLocaleTimeString());

                await page.waitForTimeout(10000);
                await clickRunButton(page);
            } catch (e) {
                console.log("Refresh failed:", e.message);
            }
        }, 5 * 60 * 1000);

    } catch (err) {
        console.error("LAUNCH ERROR:", err.message);
        console.log("Full Error Stack:", err.stack);
        console.log("Will retry in 30 seconds...");

        setTimeout(() => {
            console.log("Retrying browser startup...");
            startBrowser();
        }, 30000);
    }
}

startBrowser();