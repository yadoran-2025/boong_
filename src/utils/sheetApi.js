// This I will ask permission to user to configure in App later
// But for now we define the interface

/**
 * Sends a request to Google Apps Script
 * @param {Object} data - The schedule data {name, date, start, end, reason}
 * @param {string} apiUrl - The Web App URL
 * @param {string} action - 'create' | 'edit' | 'delete'
 * @param {Object} originalData - (Optional) The original data for identifying the row to update/delete
 */
export const saveScheduleToSheet = async (data, apiUrl, action = 'create', originalData = null) => {
    if (!apiUrl) {
        throw new Error('API URL is not configured');
    }

    let body = {};

    if (action === 'create') {
        body = { action: 'create', data: data };
    } else if (action === 'edit') {
        body = { action: 'edit', original: originalData, new: data };
    } else if (action === 'delete') {
        body = { action: 'delete', original: data };
    }

    const payload = {
        method: 'POST',
        mode: 'no-cors', // Important for GAS web apps
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
    };

    // With no-cors, we can actually read the response, so we assume success if no network error
    // If we want real feedback, we need to use 'cors' but GAS setups are tricky with that.
    // For 'no-cors', the browser will just send it transparently.

    await fetch(apiUrl, payload);
    // Simulate delay because GAS is slow
    await new Promise(r => setTimeout(r, 1000));
    return true;
};
