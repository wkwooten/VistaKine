/**
 * Sidebar resize functionality
 * Allows users to drag the sidebar resize handle to adjust sidebar width
 */
(function() {
    // Wait for DOM to be fully loaded
    document.addEventListener('DOMContentLoaded', function() {
        console.log('Initializing sidebar resize functionality');

        // Get necessary elements with flexible selectors
        const sidebar = document.querySelector('.sidebar');

        // Try different possible selectors for main content
        const mainContent = document.querySelector('.main-content') ||
                            document.querySelector('main') ||
                            document.querySelector('.content') ||
                            document.querySelector('.book-content');

        // Try different possible selectors for resize handle
        const resizeHandle = document.getElementById('sidebarResizeHandle') ||
                             document.querySelector('.sidebar-resize-handle');

        // Log what was found
        console.log('Elements found:', {
            sidebar: !!sidebar,
            mainContent: !!mainContent,
            resizeHandle: !!resizeHandle
        });

        // Exit if any required element is missing
        if (!sidebar || !mainContent || !resizeHandle) {
            console.error('Required elements not found for sidebar resize');

            // Find what's missing and provide guidance
            if (!sidebar) console.error('Sidebar element with class ".sidebar" not found');
            if (!mainContent) console.error('Main content element not found. Add class "main-content" to your content container');
            if (!resizeHandle) console.error('Resize handle not found. Make sure element with class "sidebar-resize-handle" exists');

            return;
        }

        // Variables for resize functionality
        let isResizing = false;
        const minWidth = 10; // Much smaller minimum width (nearly collapsed)
        const maxWidth = 450; // Maximum sidebar width
        const fadeStartWidth = 200; // Width at which search icon starts to fade
        const fadeEndWidth = 100; // Width at which search icon is completely invisible

        // Get stored width or use default
        let sidebarWidth = parseInt(localStorage.getItem('sidebarWidth')) || 260;

        // Function to update search icon opacity based on sidebar width
        function updateSearchIconOpacity(width) {
            if (width >= fadeStartWidth) {
                sidebar.style.setProperty('--search-icon-opacity', '1');
            } else if (width <= fadeEndWidth) {
                sidebar.style.setProperty('--search-icon-opacity', '0');
            } else {
                // Calculate opacity between 0 and 1 based on width
                const opacity = (width - fadeEndWidth) / (fadeStartWidth - fadeEndWidth);
                sidebar.style.setProperty('--search-icon-opacity', opacity.toFixed(2));
            }
        }

        // Add a function to check for collapsed state
        function checkCollapsedState(width) {
            if (width <= minWidth) {
                sidebar.classList.add('collapsed');
            } else {
                sidebar.classList.remove('collapsed');
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

            // Use document events to catch mouse movement outside the sidebar
            document.addEventListener('mousemove', handleResize);
            document.addEventListener('mouseup', stopResize);
        }

        // Function to handle resizing
        function handleResize(e) {
            if (!isResizing) return;

            // Calculate new width
            const newWidth = Math.max(minWidth, Math.min(maxWidth, e.clientX));
            console.log('Resizing to:', newWidth);

            // Apply the new width
            applyWidth(newWidth);
            sidebarWidth = newWidth;
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

            // Check for collapsed state
            checkCollapsedState(sidebarWidth);

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

        // Handle mobile navigation toggle
        const mobileToggle = document.querySelector('.mobile-toggle');
        if (mobileToggle) {
            mobileToggle.addEventListener('click', function() {
                sidebar.classList.toggle('active');
            });
        }

        // Add after the other resize handle event listeners
        resizeHandle.addEventListener('dblclick', function() {
            if (sidebar.classList.contains('collapsed')) {
                // Expand to default width
                sidebarWidth = 260;
            } else {
                // Collapse
                sidebarWidth = minWidth;
            }

            applyWidth(sidebarWidth);
            localStorage.setItem('sidebarWidth', sidebarWidth);
        });

        // Add a click handler for collapsed state
        resizeHandle.addEventListener('click', function() {
            if (sidebar.classList.contains('collapsed')) {
                // Expand to default width when clicking the pull tab
                sidebarWidth = 260;
                applyWidth(sidebarWidth);
                localStorage.setItem('sidebarWidth', sidebarWidth);
            }
        });

        console.log('Sidebar resize initialization complete');
    });
})();