/**
 * VistaKine Sidebar Module
 * Handles all sidebar-related functionality with simplified state management
 */

// Ensure VistaKine namespace exists
window.VistaKine = window.VistaKine || {};

// Sidebar module
VistaKine.sidebar = {
    // State
    state: {
        sidebarInitialized: false
    },

    /**
     * Initialize sidebar functionality
     */
    init: function() {
        if (VistaKine.sidebar.state.sidebarInitialized) {
            console.warn('Sidebar already initialized');
            return;
        }

        console.log('Initializing sidebar module');

        // Get necessary elements
        const sidebar = document.querySelector('.sidebar');
        const mainContent = document.querySelector('.main-content');
        const resizeHandle = document.querySelector('.sidebar-resize-handle');
        const navToggle = document.querySelector('.show-nav-toggle');
        const closeButton = document.querySelector('.sidebar-close');

        // Exit if any required element is missing
        if (!sidebar || !mainContent) {
            console.error('Required sidebar elements not found');
            return;
        }

        // Get current window width
        const windowWidth = window.innerWidth;

        // Check device type and set up appropriate behavior
        if (windowWidth <= 767) {
            // Mobile
            this.setupMobileSidebar(sidebar, navToggle, closeButton);
        } else if (windowWidth <= 991) {
            // Tablet
            this.setupTabletSidebar(sidebar, navToggle, closeButton);
        } else {
            // Desktop
            this.setupDesktopSidebar(sidebar, resizeHandle);
        }

        // Set up window resize handler
        window.addEventListener('resize', this.handleWindowResize.bind(this));

        // Mark as initialized
        this.state.sidebarInitialized = true;
        console.log('Sidebar initialized successfully');
    },

    /**
     * Set up sidebar for mobile devices
     */
    setupMobileSidebar: function(sidebar, navToggle, closeButton) {
        console.log('Setting up mobile sidebar');

        // Clear any desktop classes
        sidebar.classList.remove('mini-collapsed');
        document.querySelector('.app-layout').classList.remove('sidebar-mini-collapsed');

        // Add mobile class
        sidebar.classList.add('collapsed');

        // Set up toggle button click
        if (navToggle) {
            navToggle.addEventListener('click', function() {
                sidebar.classList.add('active');
            });
        }

        // Set up close button click
        if (closeButton) {
            closeButton.addEventListener('click', function() {
                sidebar.classList.remove('active');
            });
        }

        // Add click outside to close
        document.addEventListener('click', function(e) {
            if (sidebar.classList.contains('active') &&
                !sidebar.contains(e.target) &&
                e.target !== navToggle) {
                sidebar.classList.remove('active');
            }
        });
    },

    /**
     * Set up sidebar for tablet devices
     */
    setupTabletSidebar: function(sidebar, navToggle, closeButton) {
        console.log('Setting up tablet sidebar');

        // Use same mobile behavior but different styling
        this.setupMobileSidebar(sidebar, navToggle, closeButton);
    },

    /**
     * Set up sidebar for desktop devices
     */
    setupDesktopSidebar: function(sidebar, resizeHandle) {
        console.log('Setting up desktop sidebar');

        // Clear any mobile/tablet classes
        sidebar.classList.remove('collapsed', 'active');

        // Add simple toggle for resize handle
        if (resizeHandle) {
            // Double-click to toggle between expanded and minified
            resizeHandle.addEventListener('dblclick', this.toggleMinified.bind(this));

            // Single click also toggles
            resizeHandle.addEventListener('click', this.toggleMinified.bind(this));
        }
    },

    /**
     * Handle window resize event
     */
    handleWindowResize: function() {
        const windowWidth = window.innerWidth;
        const sidebar = document.querySelector('.sidebar');
        const navToggle = document.querySelector('.show-nav-toggle');
        const closeButton = document.querySelector('.sidebar-close');
        const resizeHandle = document.querySelector('.sidebar-resize-handle');

        if (!sidebar) return;

        // Reconfigure based on new window size
        if (windowWidth <= 767) {
            // Mobile
            this.setupMobileSidebar(sidebar, navToggle, closeButton);
        } else if (windowWidth <= 991) {
            // Tablet
            this.setupTabletSidebar(sidebar, navToggle, closeButton);
        } else {
            // Desktop
            this.setupDesktopSidebar(sidebar, resizeHandle);
        }
    },

    /**
     * Toggle between expanded and minified states
     */
    toggleMinified: function() {
        const sidebar = document.querySelector('.sidebar');
        const appLayout = document.querySelector('.app-layout');

        if (!sidebar || !appLayout) return;

        if (sidebar.classList.contains('mini-collapsed')) {
            // Expand
            sidebar.classList.remove('mini-collapsed');
            appLayout.classList.remove('sidebar-mini-collapsed');
            console.log('Sidebar expanded');
        } else {
            // Collapse to mini
            sidebar.classList.add('mini-collapsed');
            appLayout.classList.add('sidebar-mini-collapsed');
            console.log('Sidebar mini-collapsed');
        }
    }
};

// Initialize sidebar when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Check if we need to initialize now or wait for the loader
    if (window.VistaKine && window.VistaKine.loader) {
        console.log('Sidebar module loaded, waiting for loader');
    } else {
        console.log('Initializing sidebar directly');
        VistaKine.sidebar.init();
    }
});