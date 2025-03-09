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
        isResizing: false,
        startX: 0,
        startWidth: 0,
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

        // Add resize functionality
        if (resizeHandle) {
            resizeHandle.addEventListener('mousedown', this.startResize.bind(this));
            resizeHandle.addEventListener('touchstart', this.startTouchResize.bind(this));

            // Double-click to toggle between expanded and minified
            resizeHandle.addEventListener('dblclick', this.toggleMinified.bind(this));
        }
    },

    /**
     * Handle window resize event
     */
    handleWindowResize: function() {
        // Don't respond during active resize
        if (this.state.isResizing) return;

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
    },

    /**
     * Start resizing the sidebar
     */
    startResize: function(e) {
        e.preventDefault();

        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) return;

        this.state.isResizing = true;
        document.body.classList.add('resizing');

        // Capture start position and width
        this.state.startX = e.clientX;
        this.state.startWidth = parseInt(getComputedStyle(sidebar).width, 10);

        // Add document-level event handlers
        document.addEventListener('mousemove', this.handleResize.bind(this));
        document.addEventListener('mouseup', this.stopResize.bind(this));
    },

    /**
     * Start resizing for touch devices
     */
    startTouchResize: function(e) {
        if (e.touches.length !== 1) return;

        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) return;

        this.state.isResizing = true;
        document.body.classList.add('resizing');

        // Capture start position and width
        this.state.startX = e.touches[0].clientX;
        this.state.startWidth = parseInt(getComputedStyle(sidebar).width, 10);

        // Add document-level event handlers
        document.addEventListener('touchmove', this.handleTouchResize.bind(this), { passive: false });
        document.addEventListener('touchend', this.stopResize.bind(this));
    },

    /**
     * Handle resizing during mouse move
     */
    handleResize: function(e) {
        if (!this.state.isResizing) return;

        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) return;

        // Calculate delta movement
        const deltaX = e.clientX - this.state.startX;
        const newWidth = this.state.startWidth + deltaX;

        // Apply limits
        const minWidth = 100; // Minified width
        const maxWidth = 400; // Maximum width
        const limitedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

        // Apply width directly for immediate feedback
        sidebar.style.width = `${limitedWidth}px`;
    },

    /**
     * Handle touch resizing
     */
    handleTouchResize: function(e) {
        if (!this.state.isResizing) return;

        // Prevent scrolling while resizing
        e.preventDefault();

        const touch = e.touches[0];
        if (!touch) return;

        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) return;

        // Calculate delta movement
        const deltaX = touch.clientX - this.state.startX;
        const newWidth = this.state.startWidth + deltaX;

        // Apply limits
        const minWidth = 100; // Minified width
        const maxWidth = 400; // Maximum width
        const limitedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

        // Apply width directly for immediate feedback
        sidebar.style.width = `${limitedWidth}px`;
    },

    /**
     * End resize operation
     */
    stopResize: function() {
        if (!this.state.isResizing) return;

        // Remove event listeners
        document.removeEventListener('mousemove', this.handleResize.bind(this));
        document.removeEventListener('mouseup', this.stopResize.bind(this));
        document.removeEventListener('touchmove', this.handleTouchResize.bind(this));
        document.removeEventListener('touchend', this.stopResize.bind(this));

        const sidebar = document.querySelector('.sidebar');
        const appLayout = document.querySelector('.app-layout');

        if (!sidebar || !appLayout) {
            this.state.isResizing = false;
            document.body.classList.remove('resizing');
            return;
        }

        // Get current width
        const currentWidth = parseInt(getComputedStyle(sidebar).width, 10);

        // Threshold for snapping
        const threshold = 200; // Threshold between mini and full

        // Reset resizing state
        this.state.isResizing = false;
        document.body.classList.remove('resizing');

        // Remove inline styles
        sidebar.style.width = '';

        // Small delay to ensure transitions work
        setTimeout(() => {
            // Snap to appropriate width
            if (currentWidth < threshold) {
                // Snap to mini
                sidebar.classList.add('mini-collapsed');
                appLayout.classList.add('sidebar-mini-collapsed');
                console.log('Snapped to mini-collapsed state');
            } else {
                // Snap to expanded
                sidebar.classList.remove('mini-collapsed');
                appLayout.classList.remove('sidebar-mini-collapsed');
                console.log('Snapped to expanded state');
            }
        }, 10);
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