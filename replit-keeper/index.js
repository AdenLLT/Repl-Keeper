const puppeteer = require('puppeteer');
const express = require('express');

// 1. Tiny web server so Koyeb knows the service is 'Healthy'
const app = express();
app.get('/', (req, res) => res.send('Browser is running 24/7!'));
app.listen(8080);

async function startBrowser() {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // IMPORTANT: Use your session cookie so you don't have to deal with 2FA/Captchas
    // Replace 'YOUR_COOKIE_VALUE' with the 'connect.sid' from your browser's DevTools
    await page.setCookie({
        name: 'connect.sid',
        value: 'YOUR_COOKIE_VALUE_HERE',
        domain: 'replit.com'
    });

    console.log("Navigating to Replit...");
    await page.goto('https://replit.com/~', { waitUntil: 'networkidle2' });

    // Keep the loop running forever
    setInterval(async () => {
        try {
            await page.reload({ waitUntil: 'networkidle2' });
            console.log("Refreshed Replit at " + new Date().toLocaleTimeString());
        } catch (e) {
            console.log("Refresh failed, attempting to restart...");
        }
    }, 10 * 60 * 1000); // Refreshes every 10 minutes
}

startBrowser();