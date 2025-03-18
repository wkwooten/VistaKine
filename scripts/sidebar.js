// Handle toggling the sidebar between full, mini-collapsed, and collapsed states
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');

    if (sidebar.classList.contains('mini-collapsed')) {
        // If already mini-collapsed, expand to full
        sidebar.classList.remove('mini-collapsed');
    } else {
        // If full, mini-collapse
        sidebar.classList.add('mini-collapsed');

        // Update chapter progress when toggling to mini-collapsed
        if (typeof updateChapterProgress === 'function') {
            setTimeout(updateChapterProgress, 300); // Wait for transition to complete
        }
    }
}

// Initialize sidebar functionality
document.addEventListener('DOMContentLoaded', function() {
    // Set up resize handle click
    const resizeHandle = document.querySelector('.sidebar-resize-handle');
    if (resizeHandle) {
        resizeHandle.addEventListener('click', function(e) {
            e.preventDefault();
            toggleSidebar();
        });
    }

    // Set up close button click (mobile)
    const closeButton = document.querySelector('.sidebar-close');
    if (closeButton) {
        closeButton.addEventListener('click', function() {
            document.querySelector('.sidebar').classList.remove('active');
        });
    }

    // Set up mobile nav toggle
    const navToggle = document.querySelector('.show-nav-toggle');
    if (navToggle) {
        navToggle.addEventListener('click', function() {
            document.querySelector('.sidebar').classList.add('active');
        });
    }

    // Handle chapter expansion
    document.querySelectorAll('.nav-chapter').forEach(function(chapter) {
        // Skip if it's a leaf node (no subchapters)
        if (!chapter.nextElementSibling || !chapter.nextElementSibling.classList.contains('subchapter-list')) {
            return;
        }

        chapter.addEventListener('click', function(e) {
            // Only handle the click if it's not a direct link navigation
            if (e.target === chapter || e.target.parentNode === chapter) {
                e.preventDefault();

                const subchapterList = chapter.nextElementSibling;
                if (subchapterList && subchapterList.classList.contains('subchapter-list')) {
                    subchapterList.classList.toggle('expanded');
                    chapter.classList.toggle('collapsed');
                }
            }
        });
    });

    // Update active state based on current URL
    updateActiveState();
});

// Update active state in navigation based on current URL or scroll position
function updateActiveState() {
    const currentPath = window.location.pathname;
    const hash = window.location.hash;

    // Remove all active classes
    document.querySelectorAll('.nav-chapter, .nav-subchapter').forEach(function(item) {
        item.classList.remove('active', 'parent-active');
    });

    // If there's a hash, use it to find the active item
    if (hash) {
        const activeItem = document.querySelector(`.nav-chapter[href="${hash}"], .nav-subchapter[href="${hash}"]`);
        if (activeItem) {
            activeItem.classList.add('active');

            // If it's a subchapter, mark its parent as parent-active
            if (activeItem.classList.contains('nav-subchapter')) {
                const parentList = activeItem.closest('.subchapter-list');
                if (parentList && parentList.previousElementSibling) {
                    parentList.previousElementSibling.classList.add('parent-active');
                    parentList.classList.add('expanded');
                }
            }
        }
    }

    // Also update chapter progress if function exists
    if (typeof updateChapterProgress === 'function') {
        updateChapterProgress();
    }
}