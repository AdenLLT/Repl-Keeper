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
        console.log("Checking run button status...");

        // Wait longer for the button to appear
        await page.waitForSelector('button[data-cy="ws-run-btn"]', { timeout: 30000 });

        // Add a small delay to ensure button is fully interactive
        await page.waitForTimeout(3000);

        // Check if the play icon (run) exists inside the button
        const buttonStatus = await page.evaluate(() => {
            const button = document.querySelector('button[data-cy="ws-run-btn"]');
            if (!button) return { found: false };

            const svg = button.querySelector('svg');
            if (!svg) return { found: true, isPlayIcon: false };

            // Check for the EXACT play icon path with the specific d attribute
            const playPath = svg.querySelector('path[fill-rule="evenodd"][d="M20.593 10.91a1.25 1.25 0 0 1 0 2.18l-14.48 8.145a1.25 1.25 0 0 1-1.863-1.09V3.855a1.25 1.25 0 0 1 1.863-1.09l14.48 8.146Z"]');

            // Check for the stop icon path (square shape)  
            const stopPath = svg.querySelector('path[fill-rule="evenodd"][d="M3.25 6A2.75 2.75 0 0 1 6 3.25h12A2.75 2.75 0 0 1 20.75 6v12A2.75 2.75 0 0 1 18 20.75H6A2.75 2.75 0 0 1 3.25 18V6Z"]');

            return {
                found: true,
                isPlayIcon: !!playPath,
                isStopIcon: !!stopPath,
                svgFill: svg.getAttribute('fill')
            };
        });

        if (!buttonStatus.found) {
            console.log("✗ Run button not found on page");
            return;
        }

        if (buttonStatus.isPlayIcon) {
            console.log("✓ Replit is STOPPED (Play icon detected with fill:", buttonStatus.svgFill + "). Clicking RUN button...");
            await page.click('button[data-cy="ws-run-btn"]');
            console.log("✓ Run button clicked successfully!");
            await page.waitForTimeout(2000);
        } else if (buttonStatus.isStopIcon) {
            console.log("→ Replit is RUNNING (Stop icon detected with fill:", buttonStatus.svgFill + "). No action needed.");
        } else {
            console.log("? Unknown button state. SVG fill:", buttonStatus.svgFill);
        }
    } catch (error) {
        console.log("Could not check/click run button:", error.message);
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
                '--no-zygote'
            ]
        });

        console.log("Browser launched successfully!");

        const page = await browser.newPage();

        // Set a realistic viewport
        await page.setViewport({ width: 1920, height: 1080 });

        // Set user agent to look more like a real browser
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        await page.setCookie({
            name: 'connect.sid',
            value: 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImM0MTZJUSJ9.eyJpc3MiOiJodHRwczovL3Nlc3Npb24uZmlyZWJhc2UuZ29vZ2xlLmNvbS9yZXBsaXQtd2ViIiwicm9sZXMiOltdLCJhdWQiOiJyZXBsaXQtd2ViIiwiYXV0aF90aW1lIjoxNzY2MjI5MzE4LCJ1c2VyX2lkIjoiNmpLSXNXVjBLdmhNT2Z5OE53VmlHMXJOaDVCMyIsInN1YiI6IjZqS0lzV1YwS3ZoTU9meThOd1ZpRzFyTmg1QjMiLCJpYXQiOjE3NjYzMDc2NTAsImV4cCI6MTc2NjkxMjQ1MCwiZW1haWwiOiJhZGVuZ3JlZW4xMTFAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZ29vZ2xlLmNvbSI6WyIxMDExNzQ4Nzk3NjkxOTEyMDU2NzIiXSwiZW1haWwiOlsiYWRlbmdyZWVuMTExQGdtYWlsLmNvbSJdfSwic2lnbl9pbl9wcm92aWRlciI6Imdvb2dsZS5jb20ifX0.nXS6PDeDR7neFaIVVRjuPJSN2Aa8mXY-7vGVNx0lQsfXgZ_AhzWfuh4xinn-QV9W0SOXJrOc4HBRU08-ubHSv4AwMMMJ2ERpQCNDnVwL99DsbB8jFznWVPYgAADzb5ZHM3FFXPzOe0JoxQ33eSa2EA85-o0q7wOmOZjvfo2FunPiNU95EvzezVbAHL_WPN4TBmcuUZtCsnn-mZkeMOkc6wUUXsJkruACQXlZ-MmIzf9Alq_7B70ilCQX9T8j19yysC0NMIGbjNRHw01bW0ThLnemN89meaOJ_zqfv3FentiXFuQ7SKlpofcQC66sm4C2IPL1j--ByAQPxyJy_JwhaA',
            domain: 'replit.com'
        });

        console.log("Navigating to Replit...");
        await page.goto('https://replit.com/@HUDV1/mb#main.py', { 
            waitUntil: 'networkidle2',
            timeout: 60000 
        });

        console.log("SUCCESS: Replit project loaded.");

        // Wait a bit more for dynamic content to load
        await page.waitForTimeout(5000);

        // Check and click run button if needed after page loads
        await clickRunButton(page);

        // Refresh every 5 minutes and check/click run button if needed
        setInterval(async () => {
            try {
                console.log("Refreshing page...");
                await page.reload({ waitUntil: 'networkidle2' });
                console.log("Refresh successful: " + new Date().toLocaleTimeString());

                // Wait for dynamic content after refresh
                await page.waitForTimeout(5000);

                // Check and click run button if needed after refresh
                await clickRunButton(page);
            } catch (e) {
                console.log("Refresh failed, retrying in 5 mins:", e.message);
            }
        }, 5 * 60 * 1000);

    } catch (err) {
        console.error("LAUNCH ERROR:", err.message);
        console.log("Full Error Stack:", err.stack);
    }
}

startBrowser();