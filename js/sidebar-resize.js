/**
 * Sidebar resize functionality
 * Allows users to drag the sidebar resize handle to adjust sidebar width
 */
(function() {
    // Wait for DOM to be fully loaded
    document.addEventListener('DOMContentLoaded', function() {
        console.log('Initializing sidebar resize functionality');

        // Check if we're on a mobile device
        function isMobileDevice() {
            return (window.innerWidth <= 768) ||
                   /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        }

        // Skip normal sidebar resize behavior if on mobile
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

        // Try different possible selectors for main content
        const mainContent = document.querySelector('.main-content') ||
                          document.querySelector('main') ||
                          document.querySelector('.content') ||
                          document.querySelector('#book-content');

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

        // Handle window resize for responsiveness
        window.addEventListener('resize', function() {
            // If switched to mobile view, apply mobile behavior
            if (isMobileDevice()) {
                setupMobileSidebar();
            }
        });
    });

    // Mobile sidebar setup function
    function setupMobileSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const showNavToggle = document.querySelector('.show-nav-toggle');
        const sidebarClose = document.querySelector('.sidebar-close');
        const mainContent = document.querySelector('.main-content') || document.querySelector('#book-content');

        // Reset sidebar styling for mobile
        if (sidebar) {
            sidebar.style.width = '';
            sidebar.classList.remove('mini-collapsed');
            sidebar.classList.remove('collapsed');
        }

        if (mainContent) {
            mainContent.style.marginLeft = '0';
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