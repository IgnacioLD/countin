/**
 * init.js
 * Entry point for the People Counting System
 * Handles initialization and global configuration
 */

// Set up global variables
window.useSyntheticDetections = false;

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check for required libraries
    if (typeof cocoSsd === 'undefined') {
        showErrorMessage('TensorFlow.js libraries not found',
            `This application requires TensorFlow.js and COCO-SSD model to work properly. 
            Please make sure they are properly included in your HTML file.`);
        return;
    }

    // Start the application
    const app = new PeopleCounter();

    // Expose to window for debugging
    window.peopleCounter = app;

    console.log('People Counting System initialized');
});

/**
 * Display an error message to the user
 * @param {string} title - Error title
 * @param {string} message - Error message
 */
function showErrorMessage(title, message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.backgroundColor = '#f8d7da';
    errorDiv.style.color = '#721c24';
    errorDiv.style.padding = '20px';
    errorDiv.style.margin = '20px 0';
    errorDiv.style.borderRadius = '4px';
    errorDiv.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.1)';

    errorDiv.innerHTML = `
        <h3 style="margin-top:0">${title}</h3>
        <p>${message}</p>
    `;

    // Add to page
    document.body.insertBefore(errorDiv, document.body.firstChild);

    console.error(title, message);
}