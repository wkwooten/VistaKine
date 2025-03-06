/**
 * VistaKine Core - Central configuration and functionality
 * This module provides a single source of truth for shared functionality
 */

// Namespace for all VistaKine functionality
window.VistaKine = window.VistaKine || {};

// Core configuration and state
VistaKine.config = {
    // Default sidebar width in pixels
    defaultSidebarWidth: 260,

    // Minimum sidebar width (now equals mini-collapsed width to prevent full collapse on desktop)
    minSidebarWidth: 80,

    // Width for mini-collapsed state
    miniCollapsedWidth: 80,

    // Maximum sidebar width
    maxSidebarWidth: 400,

    // Debug mode
    debug: true,

    // Device breakpoints
    breakpoints: {
        mobile: 480,
        tablet: 768
    },

    // Feature flags
    features: {
        animations: true,
        lazyLoading: true,
        progressIndicator: true
    }
};

// Central state management
VistaKine.state = {
    // Loaded sections
    loadedSections: new Set(),

    // Active section
    activeSection: null,

    // Initialization state
    initialized: {
        core: false,
        sidebar: false,
        navigation: false,
        content: false
    },

    // Sidebar state
    sidebar: {
        width: null,
        isCollapsed: false,
        isMiniCollapsed: false
    },

    // 3D scenes
    threeJsScenes: new Map()
};

// Utility functions
VistaKine.utils = {
    /**
     * Check if we're on a mobile device
     */
    isMobileDevice: function() {
        return (window.innerWidth <= VistaKine.config.breakpoints.mobile) ||
               /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },

    /**
     * Check if we're on a tablet device
     */
    isTabletDevice: function() {
        return (window.innerWidth > VistaKine.config.breakpoints.mobile &&
                window.innerWidth <= VistaKine.config.breakpoints.tablet) ||
               /iPad/i.test(navigator.userAgent);
    },

    /**
     * Log debug messages if debug mode is enabled
     */
    log: function(message, level = 'info') {
        if (!VistaKine.config.debug) return;

        const timestamp = new Date().toISOString().slice(11, 19);
        const prefix = `[VistaKine ${timestamp}]`;

        switch(level) {
            case 'error':
                console.error(`${prefix} ❌ ${message}`);
                break;
            case 'warn':
                console.warn(`${prefix} ⚠️ ${message}`);
                break;
            case 'success':
                console.log(`${prefix} ✅ ${message}`);
                break;
            default:
                console.log(`${prefix} ${message}`);
        }
    },

    /**
     * Generate a resource path based on environment
     */
    getResourcePath: function(path) {
        if (!path) return '';

        // Strip leading slashes for consistency
        const cleanPath = path.replace(/^\/+/, '');

        // GitHub Pages handling
        if (window.vistaKineConfig && window.vistaKineConfig.isGitHubPages && window.vistaKineConfig.repoName) {
            const repoName = window.vistaKineConfig.repoName;

            // Ensure path doesn't already contain the repo name
            if (cleanPath.startsWith(repoName + '/')) {
                return '/' + cleanPath;
            }
            return `/${repoName}/${cleanPath}`;
        }

        // Local development
        return '/' + cleanPath;
    },

    /**
     * Check if an element is in the viewport
     */
    isElementInViewport: function(element) {
        if (!element) return false;

        const rect = element.getBoundingClientRect();

        return (
            rect.top >= -100 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight + 100) &&
            rect.right <= window.innerWidth
        );
    },

    /**
     * Find the DOM element that best matches a selector from multiple options
     */
    findBestMatch: function(selectors) {
        if (!selectors || !Array.isArray(selectors)) return null;

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) return element;
        }

        return null;
    }
};

// DOM query utilities (centralized selectors)
VistaKine.dom = {
    // Get the sidebar element
    getSidebar: function() {
        return document.querySelector('.sidebar');
    },

    // Get the main content element
    getMainContent: function() {
        return document.getElementById('book-content') ||
               document.querySelector('.main-content') ||
               document.querySelector('main');
    },

    // Get the resize handle
    getResizeHandle: function() {
        return document.querySelector('.sidebar-resize-handle');
    },

    // Get the sidebar toggle button
    getToggleButton: function() {
        return document.querySelector('.sidebar-resize-toggle');
    },

    // Get all navigation links
    getNavLinks: function() {
        return document.querySelectorAll('.sidebar-nav a');
    },

    // Get all section containers
    getSections: function() {
        return document.querySelectorAll('.section-container');
    },

    // Get a specific section by ID
    getSection: function(sectionId) {
        return document.getElementById(sectionId);
    }
};

// Initialize the core
VistaKine.init = function() {
    VistaKine.utils.log('Initializing VistaKine Core');

    // Set initial sidebar width from localStorage or default
    const storedWidth = localStorage.getItem('sidebarWidth');
    VistaKine.state.sidebar.width = storedWidth ? parseInt(storedWidth) : VistaKine.config.defaultSidebarWidth;

    // Check if we're on GitHub Pages and store that info
    if (window.vistaKineConfig) {
        VistaKine.state.isGitHubPages = window.vistaKineConfig.isGitHubPages;
        VistaKine.state.repoName = window.vistaKineConfig.repoName;
    }

    // Mark core as initialized
    VistaKine.state.initialized.core = true;
    VistaKine.utils.log('Core initialized successfully', 'success');

    return VistaKine;
};

/**
 * Register a module with the core
 * @param {string} moduleName - The name of the module
 * @param {object} moduleObj - The module object
 */
VistaKine.registerModule = function(moduleName, moduleObj) {
    if (!moduleName || !moduleObj) {
        VistaKine.utils.log(`Failed to register module: invalid parameters`, 'error');
        return false;
    }

    VistaKine.utils.log(`Registering module: ${moduleName}`);

    // Update initialization state tracking
    if (!VistaKine.state.initialized[moduleName]) {
        VistaKine.state.initialized[moduleName] = false;
    }

    // If module has an init method, add it to the callback queue
    if (typeof moduleObj.init === 'function' && !moduleObj.initialized) {
        VistaKine.utils.log(`Module ${moduleName} has init method, will initialize when dependencies are ready`);
    }

    return true;
};

// Initialize as soon as DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    VistaKine.init();
});

// Make VistaKine globally available
window.VistaKine = VistaKine;