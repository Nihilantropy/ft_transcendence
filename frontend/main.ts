/**
 * @brief Main TypeScript entry point for ft_transcendence frontend
 * 
 * @description Initializes the Single Page Application and game logic
 */

console.log('ft_transcendence - Frontend initialized');

// Check backend health
fetch('/api/health')
    .then(response => response.json())
    .then(data => {
        console.log('Backend health:', data);
    })
    .catch(error => {
        console.error('Backend connection error:', error);
    });

// Initialize SPA router
window.addEventListener('popstate', handleRoute);
document.addEventListener('DOMContentLoaded', handleRoute);

/**
 * @brief Handle SPA routing
 */
function handleRoute(): void {
    const path = window.location.pathname;
    console.log('Current route:', path);
    
    // Route handling will be implemented here
}
