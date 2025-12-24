// ==UserScript==
// @name         Replit Auto-Run (State-Aware)
// @namespace    http://tampermonkey.net/
// @version      1.7
// @description  Only clicks the button if the visual icon inside is the "Run" (Play triangle) symbol.
// @author       Gemini
// @match        https://replit.com/@*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Set the interval to check for the Run button every 5 seconds (5000ms)
    const CHECK_INTERVAL_MS = 5000; 

    // The definitive selector for the button component
    const BUTTON_SELECTOR = 'button[data-cy="ws-run-btn"]';

    // The 'd' attribute path data for the Play/Run triangle icon
    // This path is constant for the play icon you provided earlier: 
    const RUN_ICON_PATH_DATA = 'M20.593 10.91a1.25 1.25 0 0 1 0 2.18l-14.48 8.145a1.25 1.25 0 0 1-1.863-1.09V3.855a1.25 1.25 0 0 1 1.863-1.09l14.48 8.146Z';

    // Function to simulate a full click sequence
    const simulateMouseClick = (element) => {
        const dispatchEvent = (type) => {
            const event = new MouseEvent(type, {
                bubbles: true,
                cancelable: true,
                view: window
            });
            element.dispatchEvent(event);
        };

        dispatchEvent('mousedown');
        dispatchEvent('mouseup');
        dispatchEvent('click');
    };

    function monitorAndClickRunButton() {
        const button = document.querySelector(BUTTON_SELECTOR);

        // 1. Check if the button element exists
        if (button) {
            // 2. Look for the SVG path element inside the button
            const iconPath = button.querySelector('svg path');

            // 3. Check if the SVG path exists and if its 'd' attribute matches the RUN icon
            if (iconPath && iconPath.getAttribute('d') === RUN_ICON_PATH_DATA) {

                // It's the RUN button icon! Execute the click.
                simulateMouseClick(button);

                console.log('Replit Auto-Run (v1.7): Found RUN icon (Play). Restarting service.');
            } else {
                // If it's not the RUN icon (it's likely the Stop square or loading spinner), do nothing.
                console.log('Replit Auto-Run (v1.7): Button found, but icon is NOT the RUN (Play) triangle. App is running or stopping.');
            }
        } else {
            console.log('Replit Auto-Run (v1.7): Button component not found. Retrying in 5 seconds.');
        }
    }

    // Start the continuous monitoring loop
    console.log('Replit Auto-Run (v1.7): Starting state-aware monitor. Checking every 5 seconds.');
    setInterval(monitorAndClickRunButton, CHECK_INTERVAL_MS);

})();