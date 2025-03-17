/**
 * VistaKine Sidebar Module
 *
 * Manages the interactive sidebar navigation panel with the following capabilities:
 *
 * 1. RESIZING: Custom resizing functionality with persistence across sessions
 * 2. COLLAPSE STATES: Full collapse, mini-collapse, and expanded states
 * 3. RESPONSIVE DESIGN: Device-specific behaviors for mobile, tablet, and desktop
 * 4. TOUCH SUPPORT: Touch-friendly interactions for mobile and tablet devices
 * 5. STATE SYNCING: Integrates with the central state management system
 * 6. COLLAPSIBLE SECTIONS: Chapters can be expanded/collapsed for better navigation
 * 7. SETTINGS PANEL: Access to application settings from the sidebar footer
 *
 * The sidebar is a critical UI component that:
 * - Provides primary navigation between sections
 * - Adjusts its behavior based on screen size automatically
 * - Remembers user preferences through localStorage
 * - Supports keyboard navigation for accessibility
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
     *
     * Sets up the sidebar with appropriate behaviors based on device type:
     * - Desktop: Resizable with persistent width settings
     * - Tablet: Collapsible with mini view option
     * - Mobile: Full-width overlay with show/hide functionality
     *
     * This method configures all event listeners and initializes
     * the sidebar state from stored preferences when available.
     */
    init: function() {
        if (VistaKine.state.isInitialized('sidebar')) {
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

        // Initialize collapsible chapters
        this.initCollapsibleChapters();

        // Add settings button
        this.addSettingsButton(sidebar);

        // Get current window width
        const windowWidth = window.innerWidth;

        // Check device type and set up appropriate behavior
        if (VistaKine.device.isMobile()) {
            // Mobile
            this.setupMobileSidebar(sidebar, navToggle, closeButton);
        } else if (VistaKine.device.isTablet()) {
            // Tablet
            this.setupTabletSidebar(sidebar, navToggle, closeButton);
        } else {
            // Desktop
            this.setupDesktopSidebar(sidebar, resizeHandle);
        }

        // Set up window resize handler
        window.addEventListener('resize', this.handleWindowResize.bind(this));

        // Subscribe to sidebar state changes
        VistaKine.state.subscribe('ui.sidebar', this.handleSidebarStateChange.bind(this));

        // Mark as initialized
        VistaKine.state.setInitialized('sidebar');
        console.log('Sidebar initialized successfully');
    },

    /**
     * Initialize collapsible chapter functionality
     */
    initCollapsibleChapters: function() {
        // Get all chapter links and subchapter lists
        const chapters = document.querySelectorAll('.nav-chapter');
        const subchapterLists = document.querySelectorAll('.subchapter-list');

        // Add collapsed class to all numbered chapters but not special sections
        chapters.forEach(chapter => {
            // Only add collapsed class to numbered chapters (not home, about, chapters)
            // Special sections have ph icons in them
            if (!chapter.querySelector('.ph')) {
                chapter.classList.add('collapsed');
            }
        });

        // Set up click handlers for chapters
        chapters.forEach(chapter => {
            chapter.addEventListener('click', (e) => {
                // Skip toggle for special sections with icons
                if (chapter.querySelector('.ph')) {
                    return; // Don't interfere with navigation for special sections
                }

                // Only toggle if clicking on the chapter itself, not child elements
                if (e.target === chapter ||
                    e.target === chapter.querySelector('.chapter-number') ||
                    e.target === chapter.querySelector('span') ||
                    e.target === chapter) {

                    e.preventDefault();

                    // Toggle collapsed state
                    chapter.classList.toggle('collapsed');

                    // Find associated subchapter list (next sibling)
                    const subchapterList = chapter.nextElementSibling;
                    if (subchapterList && subchapterList.classList.contains('subchapter-list')) {
                        subchapterList.classList.toggle('expanded');
                    }
                }
            });
        });

        // Expand the currently active section's parent chapter
        this.expandActiveSection();
    },

    /**
     * Expand the currently active section in the sidebar
     */
    expandActiveSection: function() {
        // Get current hash from URL or use default
        const currentHash = window.location.hash || '#cover';

        // Find the active navigation link
        const activeLink = document.querySelector(`a[href="${currentHash}"]`);

        if (activeLink) {
            // Add active class
            activeLink.classList.add('active');

            // If it's a subchapter, expand its parent chapter
            if (activeLink.classList.contains('nav-subchapter')) {
                const subchapterList = activeLink.parentElement;
                if (subchapterList && subchapterList.classList.contains('subchapter-list')) {
                    // Expand the subchapter list
                    subchapterList.classList.add('expanded');

                    // Find and expand the parent chapter
                    const parentChapter = subchapterList.previousElementSibling;
                    if (parentChapter && parentChapter.classList.contains('nav-chapter')) {
                        parentChapter.classList.remove('collapsed');
                    }
                }
            }
        }
    },

    /**
     * Add settings button to the sidebar
     */
    addSettingsButton: function(sidebar) {
        // Create footer element if it doesn't exist
        let footer = sidebar.querySelector('.sidebar-footer');
        if (!footer) {
            footer = document.createElement('div');
            footer.className = 'sidebar-footer';
            sidebar.appendChild(footer);
        }

        // Create settings button
        const settingsButton = document.createElement('button');
        settingsButton.className = 'settings-button';
        settingsButton.innerHTML = '<i class="ph ph-gear"></i><span>Settings</span>';
        settingsButton.setAttribute('aria-label', 'Open settings');

        // Add click handler
        settingsButton.addEventListener('click', this.openSettings.bind(this));

        // Add to footer
        footer.appendChild(settingsButton);
    },

    /**
     * Open settings panel
     */
    openSettings: function(e) {
        e.preventDefault();
        console.log('Opening settings panel');

        // Dispatch event for settings panel
        const event = new CustomEvent('vistakine:openSettings', {
            bubbles: true,
            cancelable: true,
            detail: { source: 'sidebar' }
        });

        document.dispatchEvent(event);

        // If state system is available, update state
        if (VistaKine.state && typeof VistaKine.state.set === 'function') {
            VistaKine.state.set('ui.settings.isOpen', true);
        }
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
        if (VistaKine.device.isMobile()) {
            // Mobile
            this.setupMobileSidebar(sidebar, navToggle, closeButton);
        } else if (VistaKine.device.isTablet()) {
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

        // Get current state from central state
        const isMiniCollapsed = VistaKine.state.get('ui.sidebar.isMiniCollapsed', false);

        if (isMiniCollapsed) {
            // Expand
            VistaKine.state.set('ui.sidebar.isMiniCollapsed', false);
        } else {
            // Collapse to mini
            VistaKine.state.set('ui.sidebar.isMiniCollapsed', true);
        }
    },

    /**
     * Handle sidebar state changes from the central state
     */
    handleSidebarStateChange: function(path, newValue, oldValue) {
        const sidebar = document.querySelector('.sidebar');
        const appLayout = document.querySelector('.app-layout');

        if (!sidebar || !appLayout) return;

        // Handle specific state changes
        if (path === 'ui.sidebar.isMiniCollapsed') {
            if (newValue === true) {
                // Apply mini-collapsed state
                sidebar.classList.add('mini-collapsed');
                appLayout.classList.add('sidebar-mini-collapsed');
                console.log('Sidebar mini-collapsed');
            } else {
                // Apply expanded state
                sidebar.classList.remove('mini-collapsed');
                appLayout.classList.remove('sidebar-mini-collapsed');
                console.log('Sidebar expanded');
            }
        } else if (path === 'ui.sidebar.isFullyCollapsed') {
            if (newValue === true) {
                // Apply fully collapsed state (mobile/tablet)
                sidebar.classList.add('collapsed');
                sidebar.classList.remove('active');
            } else {
                // Remove collapsed state
                sidebar.classList.remove('collapsed');
            }
        } else if (path === 'ui.sidebar.isVisible') {
            if (newValue === true) {
                // Show sidebar
                sidebar.classList.add('active');
            } else {
                // Hide sidebar
                sidebar.classList.remove('active');
            }
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