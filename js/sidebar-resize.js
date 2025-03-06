/**
 * Sidebar resize functionality
 * Allows users to drag the sidebar resize handle to adjust sidebar width
 */
(function() {
    // Define utility functions at the top level so they're available throughout the script
    // Check if we're on a mobile device
    function isMobileDevice() {
        return (window.innerWidth <= 480) ||
               /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    // Check if we're on a tablet device
    function isTabletDevice() {
        return (window.innerWidth > 480 && window.innerWidth <= 768) ||
               /iPad/i.test(navigator.userAgent);
    }

    // Wait for DOM to be fully loaded
    document.addEventListener('DOMContentLoaded', function() {
        console.log('Initializing sidebar resize functionality');

        // Skip normal sidebar resize behavior if on mobile (but not tablet)
        if (isMobileDevice()) {
            console.log('Mobile device detected - using mobile sidebar behavior');
            setupMobileSidebar();
            return;
        }

        // Force reset sidebar state if URL contains reset parameter
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('reset_sidebar')) {
            console.log('Resetting sidebar state based on URL parameter');
            localStorage.removeItem('sidebarWidth');
        }

        // Get necessary elements with flexible selectors
        const sidebar = document.querySelector('.sidebar');

        // Try different possible selectors for main content - prioritize book-content ID
        const mainContent = document.getElementById('book-content') ||
                          document.querySelector('.main-content') ||
                          document.querySelector('main') ||
                          document.querySelector('.content');

        // Try different possible selectors for resize handle
        const resizeHandle = document.getElementById('sidebarResizeHandle') ||
                           document.querySelector('.sidebar-resize-handle');

        // Try different possible selectors for search container and search icon
        const searchContainer = document.querySelector('.sidebar .search-container');
        const searchIcon = document.querySelector('.sidebar .search-container i');

        // Log what was found
        console.log('Elements found:', {
            sidebar: !!sidebar,
            mainContent: !!mainContent,
            resizeHandle: !!resizeHandle,
            searchContainer: !!searchContainer,
            searchIcon: !!searchIcon
        });

        // Exit if any required element is missing
        if (!sidebar || !mainContent || !resizeHandle) {
            console.error('Required elements not found for sidebar resize');

            // Log more specific errors to help debugging
            if (!sidebar) console.error('Sidebar element not found. Make sure element with class "sidebar" exists');
            if (!mainContent) console.error('Main content element not found. Add class "main-content" to your content container');
            if (!resizeHandle) console.error('Resize handle not found. Make sure element with class "sidebar-resize-handle" exists');
            if (!searchContainer) console.error('Search container not found. Make sure element with class "search-container" exists');
            if (!searchIcon) console.error('Search icon not found. Make sure element with class "search-container i" exists');

            return;
        }

        // Variables for resize functionality
        let isResizing = false;
        let startX = 0;
        let startWidth = 0;
        const minWidth = 10; // Much smaller minimum width (nearly collapsed)
        const maxWidth = 400; // Maximum sidebar width
        const fadeStartWidth = 200; // Width at which search icon begins to fade
        const fadeEndWidth = 100; // Width at which search icon is completely invisible
        const miniCollapsedThreshold = 80; // Width threshold for mini-collapsed state
        const chapterNavThreshold = 60; // Width at which chapter nav icons start getting cut off

        // Get stored width or use default
        let sidebarWidth = parseInt(localStorage.getItem('sidebarWidth')) || 260;
        console.log('Initial sidebar width:', sidebarWidth);

        // Function to update search icon opacity based on sidebar width
        function updateSearchIconOpacity(width) {
            if (width <= fadeEndWidth) {
                sidebar.style.setProperty('--search-icon-opacity', '0');
            } else if (width >= fadeStartWidth) {
                sidebar.style.setProperty('--search-icon-opacity', '1');
            } else {
                // Calculate opacity between 0 and 1
                const opacity = (width - fadeEndWidth) / (fadeStartWidth - fadeEndWidth);
                sidebar.style.setProperty('--search-icon-opacity', opacity.toFixed(2));
            }
        }

        // Function to check collapsed state based on width
        function checkCollapsedState(width) {
            if (width <= minWidth) {
                sidebar.classList.add('collapsed');
                sidebar.classList.remove('mini-collapsed');
            } else if (width <= miniCollapsedThreshold) {
                sidebar.classList.remove('collapsed');
                sidebar.classList.add('mini-collapsed');
            } else {
                sidebar.classList.remove('collapsed');
                sidebar.classList.remove('mini-collapsed');
            }

            // Also update any sidebar panels like color legend based on state
            updateSidebarPanels();
        }

        // Function to show/hide sidebar panels based on sidebar state
        function updateSidebarPanels() {
            const colorLegend = document.querySelector('.color-legend');
            if (colorLegend) {
                if (sidebar.classList.contains('collapsed') || sidebar.classList.contains('mini-collapsed')) {
                    colorLegend.style.display = 'none';
                } else {
                    colorLegend.style.display = 'block';
                }
            }
        }

        // Function to apply width to elements
        function applyWidth(width) {
            console.log('Applying width:', width);
            sidebar.style.width = `${width}px`;
            mainContent.style.marginLeft = `${width}px`;
            checkCollapsedState(width);
            updateSearchIconOpacity(width);
        }

        // Apply initial width
        applyWidth(sidebarWidth);

        // Function to start resizing
        function startResize(e) {
            console.log('Resize started at:', e.clientX);
            e.preventDefault();
            isResizing = true;
            document.body.classList.add('resizing');

            // Capture the start position and width
            startX = e.clientX;
            startWidth = parseInt(document.defaultView.getComputedStyle(sidebar).width, 10);

            // Use document events to catch mouse movement outside the sidebar
            document.addEventListener('mousemove', handleResize);
            document.addEventListener('mouseup', stopResize);
        }

        // Function to handle resizing
        function handleResize(e) {
            if (!isResizing) return;

            const newWidth = startWidth + (e.clientX - startX);

            // Limit within min/max range
            const limitedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

            // Snap to thresholds for better UX
            if (limitedWidth < chapterNavThreshold && limitedWidth > minWidth) {
                // If below chapter nav threshold but not fully collapsed, snap to mini-collapsed
                applyWidth(chapterNavThreshold);
                sidebarWidth = chapterNavThreshold;
            } else {
                applyWidth(limitedWidth);
                sidebarWidth = limitedWidth;
            }
        }

        // Function to stop resizing
        function stopResize() {
            if (!isResizing) return;

            console.log('Resize stopped, final width:', sidebarWidth);
            isResizing = false;
            document.body.classList.remove('resizing');

            // Remove the event listeners
            document.removeEventListener('mousemove', handleResize);
            document.removeEventListener('mouseup', stopResize);

            // Save the final width
            localStorage.setItem('sidebarWidth', sidebarWidth);
        }

        // Attach the mousedown event to the resize handle
        console.log('Attaching resize event listener');
        resizeHandle.addEventListener('mousedown', startResize);

        // Add touch support for mobile devices
        resizeHandle.addEventListener('touchstart', function(e) {
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            startResize(mouseEvent);
        }, { passive: false });

        // Add double-click handler for the resize handle
        resizeHandle.addEventListener('dblclick', function(e) {
            console.log('Double-click on resize handle');
            e.preventDefault();

            if (sidebar.classList.contains('collapsed')) {
                // Expand to default width
                sidebarWidth = 260;
            } else if (sidebar.classList.contains('mini-collapsed')) {
                // Expand from mini-collapsed to full width
                sidebarWidth = 260;
            } else {
                // Collapse to mini view (not fully collapsed)
                sidebarWidth = miniCollapsedThreshold;
            }

            applyWidth(sidebarWidth);
            localStorage.setItem('sidebarWidth', sidebarWidth);
        });

        // Setup interactions for mini-collapsed state
        function setupMiniCollapsedInteractions() {
            console.log('Setting up mini-collapsed interactions');

            // Find interactive elements in mini-collapsed mode
            const miniCollapsedInteractives = [
                sidebar.querySelector('.logo'),
                sidebar.querySelector('.chapter-number'),
                ...Array.from(sidebar.querySelectorAll('.nav-chapter')),
                sidebar.querySelector('.sidebar-actions')
            ];

            // Add click handlers to each element
            miniCollapsedInteractives.forEach(element => {
                if (element) {
                    element.addEventListener('click', function(e) {
                        // Only handle click if sidebar is in mini-collapsed state
                        if (sidebar.classList.contains('mini-collapsed')) {
                            console.log('Mini-collapsed element clicked:', element);

                            // Prevent default action (like navigation)
                            e.preventDefault();
                            e.stopPropagation();

                            // Expand to default width
                            sidebarWidth = 260;
                            applyWidth(sidebarWidth);
                            localStorage.setItem('sidebarWidth', sidebarWidth);
                        }
                    });
                }
            });

            // Special handling for search icon in mini-collapsed mode
            if (searchIcon) {
                searchIcon.addEventListener('click', function(e) {
                    if (sidebar.classList.contains('mini-collapsed')) {
                        console.log('Search icon clicked in mini-collapsed mode');

                        // Prevent default action
                        e.preventDefault();
                        e.stopPropagation();

                        // Expand to default width
                        sidebarWidth = 260;
                        applyWidth(sidebarWidth);
                        localStorage.setItem('sidebarWidth', sidebarWidth);

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
        }

        // Invoke setup for mini-collapsed interactions
        setupMiniCollapsedInteractions();

        // Apply resize behavior
        window.addEventListener('resize', function() {
            // Get current window width
            const windowWidth = window.innerWidth;

            // Check current device type
            const isMobile = isMobileDevice();
            const isTablet = isTabletDevice();
            const isDesktop = !isMobile && !isTablet;

            console.log('Window resized. Width:', windowWidth, 'Device type:', isMobile ? 'Mobile' : isTablet ? 'Tablet' : 'Desktop');

            // Handle transitions between device types
            if (isMobile) {
                // If switched to mobile view, apply mobile behavior
                console.log('Applying mobile behavior');
                setupMobileSidebar();
            } else if (isTablet) {
                // For tablets, we need specific handling
                console.log('Applying tablet behavior');
                setupTabletSidebar();
            } else if (isDesktop) {
                // For desktop, restore normal resize behavior
                console.log('Applying desktop behavior');
                restoreDesktopBehavior();
            }
        });
    });

    // Tablet-specific setup
    function setupTabletSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const mainContent = document.getElementById('book-content');

        if (sidebar) {
            // Clear any inline width to let CSS media queries take effect
            sidebar.style.width = '';
            sidebar.classList.remove('mini-collapsed');
            sidebar.classList.remove('collapsed');

            // Ensure glassmorphic styling is applied
            sidebar.style.backgroundColor = 'rgba(255, 255, 255, 0.75)';
            sidebar.style.backdropFilter = 'blur(12px)';
            sidebar.style.webkitBackdropFilter = 'blur(12px)';

            // Make sure sidebar overlay is properly positioned
            sidebar.style.left = sidebar.classList.contains('active') ? '0' : '-350px';
        }

        // Setup resize handle to be visible but not functional for tablets
        const resizeHandle = document.querySelector('.sidebar-resize-handle');
        if (resizeHandle) {
            resizeHandle.style.display = 'none';
        }
    }

    // Restore desktop behavior
    function restoreDesktopBehavior() {
        const sidebar = document.querySelector('.sidebar');
        const mainContent = document.getElementById('book-content');
        const resizeHandle = document.querySelector('.sidebar-resize-handle');

        if (sidebar) {
            // Get stored width or use default
            const storedWidth = localStorage.getItem('sidebarWidth');
            if (storedWidth) {
                sidebar.style.width = `${storedWidth}px`;
            } else {
                sidebar.style.width = '260px';
            }
        }

        if (resizeHandle) {
            resizeHandle.style.display = 'block';
        }
    }

    // Mobile sidebar setup function
    function setupMobileSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const showNavToggle = document.querySelector('.show-nav-toggle');
        const sidebarClose = document.querySelector('.sidebar-close');
        const mainContent = document.getElementById('book-content') || document.querySelector('.main-content');

        console.log('Setting up mobile/tablet sidebar...');

        // Check if we're on a tablet
        const isTablet = isTabletDevice();
        if (isTablet) {
            console.log('Tablet device detected - applying tablet-specific behavior');
        }

        // Reset sidebar styling for mobile
        if (sidebar) {
            sidebar.style.width = '';
            sidebar.classList.remove('mini-collapsed');
            sidebar.classList.remove('collapsed');

            if (isTablet) {
                // For tablets, we want to ensure the glassmorphic styles are applied
                sidebar.style.backgroundColor = 'rgba(255, 255, 255, 0.75)';
                sidebar.style.backdropFilter = 'blur(12px)';
                sidebar.style.webkitBackdropFilter = 'blur(12px)';
            }
        }

        if (mainContent) {
            if (!isTablet) {
                // Only apply this on phones, not tablets
                mainContent.style.marginLeft = '0';
            }
        }

        // Improved toggle for mobile - handle both click and touch events
        if (showNavToggle && sidebar) {
            // Remove any existing event listeners
            const newShowNavToggle = showNavToggle.cloneNode(true);
            showNavToggle.parentNode.replaceChild(newShowNavToggle, showNavToggle);

            // Add better event handling
            ['click', 'touchend'].forEach(eventType => {
                newShowNavToggle.addEventListener(eventType, function(e) {
                    e.preventDefault();
                    sidebar.classList.add('active');
                    // Add a subtle animation effect
                    this.style.transform = 'scale(0.95)';
                    setTimeout(() => {
                        this.style.transform = '';
                    }, 200);
                });
            });
        }

        // Improve close button behavior too
        if (sidebarClose && sidebar) {
            // Remove any existing event listeners
            const newSidebarClose = sidebarClose.cloneNode(true);
            sidebarClose.parentNode.replaceChild(newSidebarClose, sidebarClose);

            // Add better event handling
            ['click', 'touchend'].forEach(eventType => {
                newSidebarClose.addEventListener(eventType, function(e) {
                    e.preventDefault();
                    sidebar.classList.remove('active');
                });
            });
        }

        // Close sidebar when tapping outside of it (but not on the toggle)
        document.addEventListener('touchend', function(e) {
            if (sidebar &&
                sidebar.classList.contains('active') &&
                !sidebar.contains(e.target) &&
                e.target !== showNavToggle) {
                sidebar.classList.remove('active');
            }
        });
    }
})();