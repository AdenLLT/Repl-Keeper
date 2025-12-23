const puppeteer = require('puppeteer'); // Changed to full puppeteer
const express = require('express');

const app = express();

// Basic route to provide a health check for Koyeb
app.get('/', (req, res) => {
    res.status(200).send('Keeper is Active and Healthy');
});

app.listen(8080, () => {
    console.log('Server is running on port 8080');
});

async function startBrowser() {
    console.log("Launching browser via internal cache...");

    try {
        const browser = await puppeteer.launch({
            headless: "new",
            // We removed executablePath so Puppeteer uses its own detected binary
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--single-process'
            ]
        });

        console.log("Browser launched successfully!");
        const page = await browser.newPage();

        // Setting the session cookie
        await page.setCookie({
            name: 'connect.sid',
            value: 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImM0MTZJUSJ9.eyJpc3MiOiJodHRwczovL3Nlc3Npb24uZmlyZWJhc2UuZ29vZ2xlLmNvbS9yZXBsaXQtd2ViIiwicm9sZXMiOltdLCJhdWQiOiJyZXBsaXQtd2ViIiwiYXV0aF90aW1lIjoxNzY2MjI5MzE4LCJ1c2VyX2lkIjoiNmpLSXNXVjBLdmhNT2Z5OE53VmlHMXJOaDVCMyIsInN1YiI6IjZqS0lzV1YwS3ZoTU9meThOd1ZpRzFyTmg1QjMiLCJpYXQiOjE3NjYzMDc2NTAsImV4cCI6MTc2NjkxMjQ1MCwiZW1haWwiOiJhZGVuZ3JlZW4xMTFAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZ29vZ2xlLmNvbSI6WyIxMDExNzQ4Nzk3NjkxOTEyMDU2NzIiXSwiZW1haWwiOlsiYWRlbmdyZWVuMTExQGdtYWlsLmNvbSJdfSwic2lnbl9pbl9wcm92aWRlciI6Imdvb2dsZS5jb20ifX0.nXS6PDeDR7neFaIVVRjuPJSN2Aa8mXY-7vGVNx0lQsfXgZ_AhzWfuh4xinn-QV9W0SOXJrOc4HBRU08-ubHSv4AwMMMJ2ERpQCNDnVwL99DsbB8jFznWVPYgAADzb5ZHM3FFXPzOe0JoxQ33eSa2EA85-o0q7wOmOZjvfo2FunPiNU95EvzezVbAHL_WPN4TBmcuUZtCsnn-mZkeMOkc6wUUXsJkruACQXlZ-MmIzf9Alq_7B70ilCQX9T8j19yysC0NMIGbjNRHw01bW0ThLnemN89meaOJ_zqfv3FentiXFuQ7SKlpofcQC66sm4C2IPL1j--ByAQPxyJy_JwhaA',
            domain: 'replit.com'
        });

        console.log("Navigating to Replit project...");
        await page.goto('https://replit.com/@HUDV1/mb#main.py', { 
            waitUntil: 'networkidle2',
            timeout: 90000 
        });

        console.log("SUCCESS: Replit project loaded and keeping session alive.");

        // Periodic refresh every 5 minutes
        setInterval(async () => {
            try {
                await page.reload({ waitUntil: 'networkidle2' });
                console.log("Heartbeat: Session refreshed at " + new Date().toLocaleTimeString());
            } catch (e) {
                console.log("Refresh failed, will retry in 5 minutes...");
            }
        }, 5 * 60 * 1000);

    } catch (err) {
        console.error("LAUNCH ERROR:", err.message);
        console.error("Stack trace:", err.stack);
    }
}

// Start the sequence
startBrowser();