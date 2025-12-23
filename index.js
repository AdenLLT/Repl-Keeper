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

        // Search for the button by finding the SVG with the play icon path
        const buttonFound = await page.evaluate(() => {
            // Find all buttons on the page
            const allButtons = document.querySelectorAll('button');

            for (let button of allButtons) {
                // Look for the play icon SVG path inside the button
                const playPath = button.querySelector('path[d="M20.593 10.91a1.25 1.25 0 0 1 0 2.18l-14.48 8.145a1.25 1.25 0 0 1-1.863-1.09V3.855a1.25 1.25 0 0 1 1.863-1.09l14.48 8.146Z"]');

                if (playPath) {
                    // Found the play button (Replit is stopped)
                    button.setAttribute('data-found', 'play-button');
                    return { found: true, type: 'play', dataCy: button.getAttribute('data-cy') };
                }

                // Look for the stop icon SVG path inside the button
                const stopPath = button.querySelector('path[d="M3.25 6A2.75 2.75 0 0 1 6 3.25h12A2.75 2.75 0 0 1 20.75 6v12A2.75 2.75 0 0 1 18 20.75H6A2.75 2.75 0 0 1 3.25 18V6Z"]');

                if (stopPath) {
                    // Found the stop button (Replit is running)
                    button.setAttribute('data-found', 'stop-button');
                    return { found: true, type: 'stop', dataCy: button.getAttribute('data-cy') };
                }
            }

            return { found: false };
        });

        console.log("Button search result:", JSON.stringify(buttonFound, null, 2));

        if (!buttonFound.found) {
            console.log("✗ Run/Stop button not found on page");
            return;
        }

        if (buttonFound.type === 'play') {
            console.log("✓ PLAY button found - Replit is STOPPED. Clicking to START...");

            // Click the button we marked
            await page.click('button[data-found="play-button"]');

            console.log("✓ Run button clicked successfully!");
            await page.waitForTimeout(3000);

        } else if (buttonFound.type === 'stop') {
            console.log("→ STOP button found - Replit is already RUNNING. No action needed.");
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