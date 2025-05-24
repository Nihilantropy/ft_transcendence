/**
 * @brief Main TypeScript entry point for ft_transcendence frontend
 * 
 * @description Initializes the Single Page Application with Tailwind CSS
 */

import './styles.css';

console.log('ft_transcendence - Frontend initialized with Tailwind CSS');

/**
 * @brief Initialize the application
 * 
 * @description Sets up event listeners and initializes the SPA router
 * 
 * @return void
 */
function initApp(): void {
    // Initialize SPA router
    window.addEventListener('popstate', handleRoute);
    document.addEventListener('DOMContentLoaded', () => {
        handleRoute();
        initializeUI();
        checkBackendHealth();
    });
}

/**
 * @brief Handle SPA routing
 * 
 * @description Manages client-side routing for the single page application
 * 
 * @return void
 */
function handleRoute(): void {
    const path = window.location.pathname;
    console.log('Current route:', path);
    
    // Update active navigation
    updateActiveNavigation(path);
    
    // Route handling will be implemented here
    // For now, just log the route
}

/**
 * @brief Update active navigation link
 * 
 * @param currentPath Current URL path
 * 
 * @return void
 */
function updateActiveNavigation(currentPath: string): void {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.classList.remove('nav-link-active');
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('nav-link-active');
        }
    });
}

/**
 * @brief Initialize UI interactions
 * 
 * @description Sets up event listeners for UI elements
 * 
 * @return void
 */
function initializeUI(): void {
    // Handle navigation clicks
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const href = link.getAttribute('href');
            if (href) {
                window.history.pushState({}, '', href);
                handleRoute();
            }
        });
    });
    
    // Handle button clicks
    const quickMatchBtn = document.querySelector('.btn-primary');
    const tournamentBtn = document.querySelector('.btn-secondary');
    
    quickMatchBtn?.addEventListener('click', () => {
        console.log('Quick match clicked');
        // TODO: Implement quick match logic
    });
    
    tournamentBtn?.addEventListener('click', () => {
        console.log('Create tournament clicked');
        // TODO: Implement tournament creation
    });
}

/**
 * @brief Check backend health status
 * 
 * @description Verifies connection to backend API
 * 
 * @return void
 */
async function checkBackendHealth(): Promise<void> {
    try {
        const response = await fetch('/api/health');
        const data = await response.json();
        console.log('Backend health:', data);
    } catch (error) {
        console.error('Backend connection error:', error);
    }
}

// Initialize the application
initApp();