/**
 * VistaKine Sidebar Module
 * Handles all sidebar-related functionality
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
            VistaKine.utils.log('Sidebar already initialized', 'warn');
            return;
        }

        VistaKine.utils.log('Initializing sidebar module');

        // Get necessary elements
        const sidebar = VistaKine.dom.getSidebar();
        const mainContent = VistaKine.dom.getMainContent();
        const resizeHandle = VistaKine.dom.getResizeHandle();

        // Exit if any required element is missing
        if (!sidebar || !mainContent || !resizeHandle) {
            VistaKine.utils.log('Required sidebar elements not found', 'error');

            // Log specific errors
            if (!sidebar) VistaKine.utils.log('Sidebar element not found', 'error');
            if (!mainContent) VistaKine.utils.log('Main content element not found', 'error');
            if (!resizeHandle) VistaKine.utils.log('Resize handle not found', 'error');

            return;
        }

        // Check if we're on mobile and apply appropriate setup
        if (VistaKine.utils.isMobileDevice()) {
            VistaKine.utils.log('Mobile device detected - using mobile sidebar behavior');
            VistaKine.sidebar.setupMobileSidebar();
        } else if (VistaKine.utils.isTabletDevice()) {
            VistaKine.utils.log('Tablet device detected - using tablet sidebar behavior');
            VistaKine.sidebar.setupTabletSidebar();
        } else {
            VistaKine.utils.log('Desktop device detected - using desktop sidebar behavior');
            VistaKine.sidebar.setupDesktopSidebar();
        }

        // Setup resize behavior for window size changes
        window.addEventListener('resize', VistaKine.sidebar.handleWindowResize);

        // Mark as initialized
        VistaKine.sidebar.state.sidebarInitialized = true;
        VistaKine.state.initialized.sidebar = true;

        VistaKine.utils.log('Sidebar initialized successfully', 'success');
    },

    /**
     * Set up desktop sidebar behavior
     */
    setupDesktopSidebar: function() {
        const sidebar = VistaKine.dom.getSidebar();
        const mainContent = VistaKine.dom.getMainContent();
        const resizeHandle = VistaKine.dom.getResizeHandle();
        const toggleButton = VistaKine.dom.getToggleButton();

        // Get stored width or use default
        let sidebarWidth = parseInt(localStorage.getItem('sidebarWidth')) || VistaKine.config.defaultSidebarWidth;
        VistaKine.utils.log(`Initial sidebar width: ${sidebarWidth}`);

        // Apply initial width
        VistaKine.sidebar.applyWidth(sidebarWidth);

        // Setup resize handle events
        resizeHandle.addEventListener('mousedown', VistaKine.sidebar.startResize);
        resizeHandle.addEventListener('touchstart', function(e) {
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            VistaKine.sidebar.startResize(mouseEvent);
        }, { passive: false });

        // Setup double-click behavior on resize handle
        resizeHandle.addEventListener('dblclick', function(e) {
            e.preventDefault();
            VistaKine.utils.log('Double-click on resize handle');

            const sidebar = VistaKine.dom.getSidebar();

            if (sidebar.classList.contains('mini-collapsed')) {
                // Expand from mini-collapsed to full width
                VistaKine.sidebar.applyWidth(VistaKine.config.defaultSidebarWidth);
                localStorage.setItem('sidebarWidth', VistaKine.config.defaultSidebarWidth);
            } else {
                // Collapse to mini view
                VistaKine.sidebar.applyWidth(VistaKine.config.miniCollapsedWidth);
                localStorage.setItem('sidebarWidth', VistaKine.config.miniCollapsedWidth);
            }
        });

        // Setup toggle button behavior
        if (toggleButton) {
            toggleButton.addEventListener('click', function() {
                VistaKine.utils.log('Toggle button clicked');

                const sidebar = VistaKine.dom.getSidebar();

                if (sidebar.classList.contains('mini-collapsed')) {
                    // Expand to full width
                    VistaKine.sidebar.applyWidth(VistaKine.config.defaultSidebarWidth);
                    localStorage.setItem('sidebarWidth', VistaKine.config.defaultSidebarWidth);
                } else {
                    // Collapse to mini-collapsed state
                    VistaKine.sidebar.applyWidth(VistaKine.config.miniCollapsedWidth);
                    localStorage.setItem('sidebarWidth', VistaKine.config.miniCollapsedWidth);
                }
            });
        }

        // Setup interactions for mini-collapsed state
        VistaKine.sidebar.setupMiniCollapsedInteractions();
    },

    /**
     * Apply width to the sidebar and update state
     */
    applyWidth: function(width) {
        const sidebar = VistaKine.dom.getSidebar();
        const mainContent = VistaKine.dom.getMainContent();

        if (!sidebar || !mainContent) return;

        VistaKine.utils.log(`Applying sidebar width: ${width}px`);

        // Apply width to elements
        sidebar.style.width = `${width}px`;
        mainContent.style.marginLeft = `${width}px`;

        // Update collapsed state
        VistaKine.sidebar.updateCollapsedState(width);

        // Update state
        VistaKine.state.sidebar.width = width;
    },

    /**
     * Update collapsed state based on width
     */
    updateCollapsedState: function(width) {
        const sidebar = VistaKine.dom.getSidebar();
        if (!sidebar) return;

        const miniCollapsedWidth = VistaKine.config.miniCollapsedWidth;

        // On desktop, we now only have mini-collapsed or expanded states
        // The fully collapsed state is only used on mobile
        if (width <= miniCollapsedWidth) {
            sidebar.classList.remove('collapsed'); // Remove fully collapsed class
            sidebar.classList.add('mini-collapsed');
            VistaKine.state.sidebar.isCollapsed = false;
            VistaKine.state.sidebar.isMiniCollapsed = true;
        } else {
            sidebar.classList.remove('collapsed');
            sidebar.classList.remove('mini-collapsed');
            VistaKine.state.sidebar.isCollapsed = false;
            VistaKine.state.sidebar.isMiniCollapsed = false;
        }

        // Mobile-specific behavior can be handled elsewhere with device detection
    },

    /**
     * Start resizing the sidebar
     */
    startResize: function(e) {
        e.preventDefault();

        VistaKine.utils.log('Resize started');
        VistaKine.sidebar.state.isResizing = true;
        document.body.classList.add('resizing');

        // Get sidebar
        const sidebar = VistaKine.dom.getSidebar();

        // Capture the start position and width
        VistaKine.sidebar.state.startX = e.clientX;
        VistaKine.sidebar.state.startWidth = parseInt(document.defaultView.getComputedStyle(sidebar).width, 10);

        // Add document-level event listeners
        document.addEventListener('mousemove', VistaKine.sidebar.handleResize);
        document.addEventListener('mouseup', VistaKine.sidebar.stopResize);
        document.addEventListener('touchmove', VistaKine.sidebar.handleTouchResize, { passive: false });
        document.addEventListener('touchend', VistaKine.sidebar.stopResize);
    },

    /**
     * Handle resizing during mouse move
     */
    handleResize: function(e) {
        if (!VistaKine.sidebar.state.isResizing) return;

        const newWidth = VistaKine.sidebar.state.startWidth + (e.clientX - VistaKine.sidebar.state.startX);

        // Limit within min/max range
        const minWidth = VistaKine.config.minSidebarWidth;
        const maxWidth = VistaKine.config.maxSidebarWidth;
        const limitedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

        // Apply the new width
        VistaKine.sidebar.applyWidth(limitedWidth);
    },

    /**
     * Handle resizing during touch move
     */
    handleTouchResize: function(e) {
        if (!VistaKine.sidebar.state.isResizing) return;

        e.preventDefault(); // Prevent scrolling while resizing

        const touch = e.touches[0];
        const newWidth = VistaKine.sidebar.state.startWidth + (touch.clientX - VistaKine.sidebar.state.startX);

        // Limit within min/max range
        const minWidth = VistaKine.config.minSidebarWidth;
        const maxWidth = VistaKine.config.maxSidebarWidth;
        const limitedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

        // Apply the new width
        VistaKine.sidebar.applyWidth(limitedWidth);
    },

    /**
     * Stop resizing
     */
    stopResize: function() {
        if (!VistaKine.sidebar.state.isResizing) return;

        VistaKine.utils.log('Resize stopped');
        VistaKine.sidebar.state.isResizing = false;
        document.body.classList.remove('resizing');

        // Save the final width
        const sidebar = VistaKine.dom.getSidebar();
        const finalWidth = parseInt(document.defaultView.getComputedStyle(sidebar).width, 10);
        localStorage.setItem('sidebarWidth', finalWidth);

        // Remove the event listeners
        document.removeEventListener('mousemove', VistaKine.sidebar.handleResize);
        document.removeEventListener('mouseup', VistaKine.sidebar.stopResize);
        document.removeEventListener('touchmove', VistaKine.sidebar.handleTouchResize);
        document.removeEventListener('touchend', VistaKine.sidebar.stopResize);
    },

    /**
     * Set up interactions for mini-collapsed state
     */
    setupMiniCollapsedInteractions: function() {
        const sidebar = VistaKine.dom.getSidebar();

        if (!sidebar) {
            VistaKine.utils.log('Sidebar element not found for mini-collapsed interactions', 'error');
            return;
        }

        VistaKine.utils.log('Setting up mini-collapsed interactions');

        // Find interactive elements in mini-collapsed mode
        const miniCollapsedInteractives = [
            sidebar.querySelector('.logo'),
            sidebar.querySelector('.chapter-number'),
            ...Array.from(sidebar.querySelectorAll('.nav-chapter')),
            sidebar.querySelector('.sidebar-actions')
        ].filter(Boolean); // Remove null entries

        // Add click handlers to each element
        miniCollapsedInteractives.forEach(element => {
            // Remove any existing handlers
            const newElement = element.cloneNode(true);
            if (element.parentNode) {
                element.parentNode.replaceChild(newElement, element);
            }

            // Add new handler
            newElement.addEventListener('click', function(e) {
                // Only handle click if sidebar is in mini-collapsed state
                if (sidebar.classList.contains('mini-collapsed')) {
                    // If this is a navigation link, don't prevent default - let it navigate
                    if (!this.classList.contains('nav-chapter') && !this.classList.contains('nav-subchapter')) {
                        e.preventDefault();
                        e.stopPropagation();
                    }

                    VistaKine.utils.log('Mini-collapsed element clicked, expanding sidebar');

                    // Expand to default width
                    VistaKine.sidebar.applyWidth(VistaKine.config.defaultSidebarWidth);
                    localStorage.setItem('sidebarWidth', VistaKine.config.defaultSidebarWidth);
                }
            });
        });

        // Special handling for search icon
        const searchContainer = sidebar.querySelector('.search-container');
        const searchIcon = searchContainer ? searchContainer.querySelector('i') : null;

        if (searchIcon) {
            searchIcon.addEventListener('click', function(e) {
                if (sidebar.classList.contains('mini-collapsed')) {
                    VistaKine.utils.log('Search icon clicked in mini-collapsed mode');

                    // Prevent default action
                    e.preventDefault();
                    e.stopPropagation();

                    // Expand to default width
                    VistaKine.sidebar.applyWidth(VistaKine.config.defaultSidebarWidth);
                    localStorage.setItem('sidebarWidth', VistaKine.config.defaultSidebarWidth);

                    // Focus search input
                    const searchInput = searchContainer.querySelector('input');
                    if (searchInput) {
                        setTimeout(() => {
                            searchInput.focus();
                        }, 300); // Wait for transition to complete
                    }
                }
            });
        }
    },

    /**
     * Set up tablet sidebar behavior
     */
    setupTabletSidebar: function() {
        const sidebar = VistaKine.dom.getSidebar();
        const mainContent = VistaKine.dom.getMainContent();
        const resizeHandle = VistaKine.dom.getResizeHandle();
        const showNavToggle = document.getElementById('show-nav-toggle');
        const sidebarClose = document.querySelector('.sidebar-close');

        if (!sidebar) {
            VistaKine.utils.log('Sidebar element not found for tablet setup', 'error');
            return;
        }

        VistaKine.utils.log('Setting up tablet sidebar');

        // Clear any inline width to let CSS media queries take effect
        sidebar.style.width = '';
        sidebar.classList.remove('mini-collapsed');
        sidebar.classList.remove('collapsed');

        // Ensure glassmorphic styling is applied
        sidebar.style.backgroundColor = 'rgba(255, 255, 255, 0.75)';
        sidebar.style.backdropFilter = 'blur(12px)';
        sidebar.style.webkitBackdropFilter = 'blur(12px)';

        // Position sidebar based on state
        sidebar.style.left = sidebar.classList.contains('active') ? '0' : '-350px';

        // Hide resize handle on tablets
        if (resizeHandle) {
            resizeHandle.style.display = 'none';
        }

        // Setup toggle button behavior
        if (showNavToggle) {
            // Remove existing event listeners
            const newToggle = showNavToggle.cloneNode(true);
            if (showNavToggle.parentNode) {
                showNavToggle.parentNode.replaceChild(newToggle, showNavToggle);
            }

            // Add new event listener
            newToggle.addEventListener('click', function(e) {
                e.preventDefault();
                sidebar.classList.add('active');
            });
        }

        // Setup close button behavior
        if (sidebarClose) {
            // Remove existing event listeners
            const newClose = sidebarClose.cloneNode(true);
            if (sidebarClose.parentNode) {
                sidebarClose.parentNode.replaceChild(newClose, sidebarClose);
            }

            // Add new event listener
            newClose.addEventListener('click', function(e) {
                e.preventDefault();
                sidebar.classList.remove('active');
            });
        }

        // Setup click outside to close
        document.addEventListener('click', function(e) {
            if (sidebar.classList.contains('active') &&
                !sidebar.contains(e.target) &&
                e.target !== showNavToggle &&
                !showNavToggle.contains(e.target)) {

                sidebar.classList.remove('active');
            }
        });
    },

    /**
     * Set up mobile sidebar behavior
     */
    setupMobileSidebar: function() {
        const sidebar = VistaKine.dom.getSidebar();
        const mainContent = VistaKine.dom.getMainContent();
        const showNavToggle = document.getElementById('show-nav-toggle');
        const sidebarClose = document.querySelector('.sidebar-close');

        if (!sidebar) {
            VistaKine.utils.log('Sidebar element not found for mobile setup', 'error');
            return;
        }

        VistaKine.utils.log('Setting up mobile sidebar');

        // Reset sidebar styling for mobile
        sidebar.style.width = '';
        sidebar.classList.remove('mini-collapsed');
        sidebar.classList.remove('collapsed');

        // Make sure main content doesn't have a margin on mobile
        if (mainContent) {
            mainContent.style.marginLeft = '0';
        }

        // Setup toggle button behavior
        if (showNavToggle) {
            // Remove existing event listeners
            const newToggle = showNavToggle.cloneNode(true);
            if (showNavToggle.parentNode) {
                showNavToggle.parentNode.replaceChild(newToggle, showNavToggle);
            }

            // Add new event listener for both click and touch
            ['click', 'touchend'].forEach(eventType => {
                newToggle.addEventListener(eventType, function(e) {
                    e.preventDefault();
                    e.stopPropagation();

                    VistaKine.utils.log('Nav toggle clicked on mobile');

                    sidebar.classList.add('active');
                    this.style.display = 'none';
                });
            });
        }

        // Setup close button behavior
        if (sidebarClose) {
            // Remove existing event listeners
            const newClose = sidebarClose.cloneNode(true);
            if (sidebarClose.parentNode) {
                sidebarClose.parentNode.replaceChild(newClose, sidebarClose);
            }

            // Add new event listener for both click and touch
            ['click', 'touchend'].forEach(eventType => {
                newClose.addEventListener(eventType, function(e) {
                    e.preventDefault();

                    VistaKine.utils.log('Close button clicked on mobile');

                    sidebar.classList.remove('active');

                    // Show the toggle button again after a slight delay
                    if (showNavToggle) {
                        setTimeout(() => {
                            showNavToggle.style.display = 'flex';
                        }, 50);
                    }
                });
            });
        }

        // Setup touch outside to close
        document.addEventListener('touchend', function(e) {
            if (sidebar &&
                sidebar.classList.contains('active') &&
                !sidebar.contains(e.target) &&
                e.target !== showNavToggle) {

                VistaKine.utils.log('Touch outside sidebar detected, closing sidebar');

                sidebar.classList.remove('active');

                // Show the toggle button again
                if (showNavToggle) {
                    setTimeout(() => {
                        showNavToggle.style.display = 'flex';
                    }, 50);
                }
            }
        });
    },

    /**
     * Handle window resize events
     */
    handleWindowResize: function() {
        // Get current window width and device type
        const windowWidth = window.innerWidth;
        const isMobile = VistaKine.utils.isMobileDevice();
        const isTablet = VistaKine.utils.isTabletDevice();

        VistaKine.utils.log(`Window resized. Width: ${windowWidth}, Device: ${isMobile ? 'Mobile' : isTablet ? 'Tablet' : 'Desktop'}`);

        // Apply appropriate behavior based on device type
        if (isMobile) {
            VistaKine.sidebar.setupMobileSidebar();
        } else if (isTablet) {
            VistaKine.sidebar.setupTabletSidebar();
        } else {
            // Restore desktop behavior
            const storedWidth = localStorage.getItem('sidebarWidth') || VistaKine.config.defaultSidebarWidth;
            VistaKine.sidebar.applyWidth(parseInt(storedWidth));

            // Make sure resize handle is visible
            const resizeHandle = VistaKine.dom.getResizeHandle();
            if (resizeHandle) {
                resizeHandle.style.display = 'block';
            }
        }
    }
};

// Initialize when core is ready
document.addEventListener('DOMContentLoaded', function() {
    // Check if core is initialized before proceeding
    const initInterval = setInterval(function() {
        if (window.VistaKine && VistaKine.state && VistaKine.state.initialized.core) {
            clearInterval(initInterval);
            VistaKine.sidebar.init();
        }
    }, 50);
});