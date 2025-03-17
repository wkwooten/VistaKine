/**
 * VistaKine Core - Central System Architecture
 *
 * This module serves as the foundation of the VistaKine framework, providing:
 * 1. Configuration settings for the entire application
 * 2. A centralized state management system that enforces data integrity
 * 3. Core utility functions that are used across multiple modules
 * 4. Initialization and lifecycle management for the application
 *
 * Architecture Design:
 * - Uses a module pattern to prevent global namespace pollution
 * - Provides a publish/subscribe mechanism for state changes
 * - Centralizes configuration to simplify maintenance and extensibility
 */

// Namespace for all VistaKine functionality
window.VistaKine = window.VistaKine || {};

// Core configuration and state
VistaKine.config = {
    // Default sidebar width in pixels
    defaultSidebarWidth: 350,

    // Minimum sidebar width (now equals mini-collapsed width)
    minSidebarWidth: 100,

    // Width for mini-collapsed state
    miniCollapsedWidth: 100,

    // Maximum sidebar width
    maxSidebarWidth: 450,

    // Debug mode
    debug: true,

    // Device breakpoints
    breakpoints: {
        mobile: 479,  // Mobile devices up to 479px
        tablet: 991   // Tablets from 480px to 991px
    },

    // Feature flags
    features: {
        animations: true,
        lazyLoading: true,
        progressIndicator: true
    }
};

/**
 * Centralized State Management System
 *
 * This system provides a single source of truth for the application state using
 * a clean API with get/set methods and a subscription system. Key benefits:
 *
 * - Prevents direct manipulation of state properties
 * - Enables reactivity through the subscription mechanism
 * - Creates a predictable state flow throughout the application
 * - Supports deeply nested state properties through dot notation
 * - Facilitates debugging by logging all state changes when in debug mode
 */
VistaKine.state = (function() {
    // Private internal state store
    const _state = {
        // UI State
        ui: {
            sidebar: {
                width: VistaKine.config.defaultSidebarWidth,
                isExpanded: true,
                isMiniCollapsed: false,
                isFullyCollapsed: false,
                isVisible: true,
            },
            bottomNav: {
                isVisible: false,
                isPrevEnabled: false,
                isNextEnabled: true
            }
        },

        // Navigation State
        navigation: {
            currentSection: null,
            visibleSections: [],
            isTransitioning: false,
            isDirectNavigation: false,
            history: []
        },

        // Content State
        content: {
    loadedSections: new Set(),
            currentProgress: 0,
            pendingRequests: new Map()
        },

        // Module Initialization State
        system: {
    initialized: {
        core: false,
        sidebar: false,
        navigation: false,
                content: false,
                visualization: false
            },
            startTime: Date.now(),
            observers: {
                navigation: null,
                content: null
            }
        }
    };

    // Subscribers for state changes
    const _subscribers = new Map();

    // Private methods
    function _notify(path, newValue, oldValue) {
        if (VistaKine.config.debug) {
            console.log(`[VistaKine State] Change: ${path}`, {
                old: oldValue,
                new: newValue
            });
        }

        // Notify all subscribers that match this path
        _subscribers.forEach((callback, pattern) => {
            if (path.startsWith(pattern)) {
                try {
                    callback(path, newValue, oldValue);
                } catch (err) {
                    console.error(`[VistaKine State] Error in subscriber callback for ${pattern}:`, err);
                }
            }
        });
    }

    function _getNestedProperty(obj, path) {
        return path.split('.').reduce((prev, curr) => {
            return prev ? prev[curr] : undefined;
        }, obj);
    }

    function _setNestedProperty(obj, path, value) {
        const parts = path.split('.');
        const lastProp = parts.pop();
        const target = parts.reduce((prev, curr) => {
            if (!prev[curr]) prev[curr] = {};
            return prev[curr];
        }, obj);

        const oldValue = target[lastProp];
        target[lastProp] = value;

        return oldValue;
    }

    // Public API
    return {
        /**
         * Get a value from the state store
         * @param {string} path - Dot notation path to the state property
         * @param {any} defaultValue - Default value if property doesn't exist
         * @returns {any} The state value or defaultValue
         */
        get: function(path, defaultValue) {
            const value = _getNestedProperty(_state, path);
            return value !== undefined ? value : defaultValue;
        },

        /**
         * Set a value in the state store, triggering subscribers
         * @param {string} path - Dot notation path to the state property
         * @param {any} value - New value to set
         * @returns {boolean} Success of the operation
         */
        set: function(path, value) {
            try {
                const oldValue = _setNestedProperty(_state, path, value);
                _notify(path, value, oldValue);
                return true;
            } catch (err) {
                console.error(`[VistaKine State] Error setting ${path}:`, err);
                return false;
            }
        },

        /**
         * Add a new loaded section to the set
         * @param {string} sectionId - ID of the section that was loaded
         */
        addLoadedSection: function(sectionId) {
            const sections = this.get('content.loadedSections');
            sections.add(sectionId);
            _notify('content.loadedSections', sections, sections);
            return true;
        },

        /**
         * Remove a section from the loaded sections set
         * @param {string} sectionId - ID of the section to unload
         * @returns {boolean} Whether the section was successfully unloaded
         */
        removeLoadedSection: function(sectionId) {
            const sections = this.get('content.loadedSections');
            const wasLoaded = sections.has(sectionId);
            if (wasLoaded) {
                sections.delete(sectionId);
                _notify('content.loadedSections', sections, sections);
                return true;
            }
            return false;
        },

        /**
         * Get all loaded section IDs as an array
         * @returns {string[]} Array of loaded section IDs
         */
        getLoadedSections: function() {
            const sections = this.get('content.loadedSections');
            return Array.from(sections);
        },

        /**
         * Check if a section is loaded
         * @param {string} sectionId - ID of the section to check
         * @returns {boolean} Whether the section is loaded
         */
        isSectionLoaded: function(sectionId) {
            return this.get('content.loadedSections').has(sectionId);
        },

        /**
         * Subscribe to changes on a specific state path
         * @param {string} pathPattern - Path prefix to listen for changes
         * @param {Function} callback - Callback function(path, newValue, oldValue)
         * @returns {string} Subscription ID for unsubscribing
         */
        subscribe: function(pathPattern, callback) {
            const id = Date.now().toString(36) + Math.random().toString(36).substring(2);
            _subscribers.set(pathPattern, callback);
            return id;
        },

        /**
         * Unsubscribe from state changes
         * @param {string} id - Subscription ID to remove
         */
        unsubscribe: function(id) {
            return _subscribers.delete(id);
        },

        /**
         * Mark a module as initialized
         * @param {string} moduleName - Name of the module (core, sidebar, etc.)
         */
        setInitialized: function(moduleName) {
            this.set(`system.initialized.${moduleName}`, true);
        },

        /**
         * Check if a module is initialized
         * @param {string} moduleName - Name of the module
         * @returns {boolean} Whether the module is initialized
         */
        isInitialized: function(moduleName) {
            return this.get(`system.initialized.${moduleName}`, false);
        },

        /**
         * Get the current section ID
         * @returns {string|null} The current section ID or null
         */
        getCurrentSection: function() {
            return this.get('navigation.currentSection', null);
        },

        /**
         * Set the current active section
         * @param {string} sectionId - ID of the section to set as current
         */
        setCurrentSection: function(sectionId) {
            const oldSection = this.get('navigation.currentSection');
            if (sectionId !== oldSection) {
                this.set('navigation.currentSection', sectionId);
                // Add to history if it's a new section
                const history = this.get('navigation.history', []);
                if (!history.includes(sectionId)) {
                    history.push(sectionId);
                    this.set('navigation.history', history);
                }
            }
        }
    };
})();

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

        // Use the base path helper if available
        if (window.getPath) {
            return window.getPath(cleanPath);
        }

        // GitHub Pages handling (fallback)
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

    // Migrate any existing state from old system to new
    VistaKine.migrateState();

    // Set initial sidebar width from localStorage or default
    const storedWidth = localStorage.getItem('sidebarWidth');
    VistaKine.state.set('ui.sidebar.width', storedWidth ? parseInt(storedWidth) : VistaKine.config.defaultSidebarWidth);

    // Check if we're on GitHub Pages and store that info
    if (window.location.hostname.endsWith('github.io') ||
        window.location.hostname.endsWith('githubusercontent.com')) {
        VistaKine.state.set('system.isGitHubPages', true);
    }

    // Mark core as initialized
    VistaKine.state.setInitialized('core');
    VistaKine.utils.log('Core initialized successfully', 'success');
};

/**
 * State Migration System
 *
 * Critical compatibility layer that ensures smooth transitions between different
 * versions of the state management system. This method is responsible for:
 *
 * 1. VERSION COMPATIBILITY: Migrates data from older state formats to the new centralized format
 * 2. DATA PRESERVATION: Ensures no user data or application state is lost during upgrades
 * 3. MODULE COORDINATION: Handles state dependencies between different modules
 * 4. GRACEFUL DEGRADATION: Fails safely if old state format is incompatible
 *
 * The migration system provides backward compatibility for:
 * - Previously loaded sections to prevent unnecessary reloading
 * - Active section state to maintain user's position
 * - UI preferences such as sidebar width and collapse state
 *
 * This is automatically called during initialization to ensure a seamless
 * user experience even when upgrading to new versions.
 */
VistaKine.migrateState = function() {
    VistaKine.utils.log('Migrating existing state to new state system');

    // Migrate loadedSections
    if (window.VistaKine && VistaKine.state && VistaKine.state.loadedSections) {
        const oldLoadedSections = VistaKine.state.loadedSections;
        if (oldLoadedSections instanceof Set && oldLoadedSections.size > 0) {
            VistaKine.utils.log(`Migrating ${oldLoadedSections.size} loaded sections`);
            oldLoadedSections.forEach(sectionId => {
                VistaKine.state.addLoadedSection(sectionId);
                VistaKine.utils.log(`Migrated section: ${sectionId}`);
            });
        }
    }

    // Migrate active section
    if (window.VistaKine && VistaKine.state && VistaKine.state.activeSection) {
        const oldActiveSection = VistaKine.state.activeSection;
        if (oldActiveSection) {
            VistaKine.utils.log(`Migrating active section: ${oldActiveSection}`);
            VistaKine.state.setCurrentSection(oldActiveSection);
        }
    }

    // Migrate sidebar state if it exists
    if (window.VistaKine && VistaKine.state && VistaKine.state.sidebar) {
        const oldSidebarState = VistaKine.state.sidebar;
        if (oldSidebarState) {
            if ('width' in oldSidebarState && oldSidebarState.width) {
                VistaKine.state.set('ui.sidebar.width', oldSidebarState.width);
            }
            if ('isCollapsed' in oldSidebarState) {
                VistaKine.state.set('ui.sidebar.isFullyCollapsed', oldSidebarState.isCollapsed);
            }
            if ('isMiniCollapsed' in oldSidebarState) {
                VistaKine.state.set('ui.sidebar.isMiniCollapsed', oldSidebarState.isMiniCollapsed);
            }
        }
    }
};

/**
 * Setup the grid layout based on device width
 */
VistaKine.setupGridLayout = function() {
    const windowWidth = window.innerWidth;
    const appLayout = document.querySelector('.app-layout');

    if (!appLayout) {
        VistaKine.utils.log('No app layout container found!', 'error');
        return;
    }

    // Remove all device-specific classes
    appLayout.classList.remove('mobile-mode', 'tablet-mode', 'desktop-mode');

    // Set the appropriate device mode class
    if (windowWidth <= VistaKine.config.breakpoints.mobile) {
        appLayout.classList.add('mobile-mode');
        VistaKine.utils.log('Setting up grid layout for mobile', 'info');
    } else if (windowWidth <= VistaKine.config.breakpoints.tablet) {
        appLayout.classList.add('tablet-mode');
        appLayout.classList.add('sidebar-mini-collapsed');
        VistaKine.utils.log('Setting up grid layout for tablet (mini-collapsed by default)', 'info');
    } else {
        appLayout.classList.add('desktop-mode');
        VistaKine.utils.log('Setting up grid layout for desktop', 'info');
    }
};

/**
 * Handle window resize for the grid layout
 */
VistaKine.handleWindowResize = function() {
    // Avoid expensive operations during rapid resizing
    if (VistaKine.resizeTimeout) {
        clearTimeout(VistaKine.resizeTimeout);
    }

    VistaKine.resizeTimeout = setTimeout(function() {
        VistaKine.setupGridLayout();
    }, 100);
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
    if (!VistaKine.state.system.initialized[moduleName]) {
        VistaKine.state.system.initialized[moduleName] = false;
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

/**
 * Utility functions for device and media query detection
 */
VistaKine.device = {
    /**
     * Check if the current device is a mobile device
     */
    isMobile: function() {
        return window.matchMedia(`(max-width: ${VistaKine.config.breakpoints.mobile}px)`).matches ||
            ('ontouchstart' in window && navigator.userAgent.match(/Mobi/));
    },

    /**
     * Check if the current device is a tablet
     */
    isTablet: function() {
        return (window.matchMedia(`(min-width: ${VistaKine.config.breakpoints.mobile + 1}px) and (max-width: ${VistaKine.config.breakpoints.tablet}px)`).matches) ||
            ('ontouchstart' in window && !this.isMobile() && window.innerWidth <= VistaKine.config.breakpoints.tablet);
    },

    /**
     * Check if the current device is a desktop
     */
    isDesktop: function() {
        return window.matchMedia(`(min-width: ${VistaKine.config.breakpoints.tablet + 1}px)`).matches;
    },

    /**
     * Check if the device has touch capability
     */
    hasTouch: function() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    },

    /**
     * Match a custom media query
     * @param {string} query - CSS media query
     * @returns {boolean} - Whether the query matches
     */
    matchMedia: function(query) {
        return window.matchMedia(query).matches;
    }
};