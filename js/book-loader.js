/**
 * VistaKine Book Loader
 * Handles lazy loading of content sections and Three.js initialization
 */

// Track loaded sections and active section
const state = {
    loadedSections: new Set(),
    activeSection: null,
    threeJsScenes: new Map(),
    observer: null,
    scrollObserver: null,
    sectionPositions: [],
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    setupLazyLoading();
    setupScrollObserver();
    setupProgressIndicator();
    handleInitialHash();
});

/**
 * Set up navigation functionality
 */
function setupNavigation() {
    // Handle navigation click events
    document.querySelectorAll('#chapter-nav a').forEach(link => {
        link.addEventListener('click', (e) => {
            const targetId = link.getAttribute('href').substring(1); // Remove the #

            if (targetId) {
                e.preventDefault();

                // Scroll to the section smoothly
                const targetSection = document.getElementById(targetId);
                if (targetSection) {
                    targetSection.scrollIntoView({ behavior: 'smooth' });
                }

                // Update URL hash without scrolling
                history.pushState(null, null, `#${targetId}`);

                // Mobile: close navigation if open
                const nav = document.getElementById('chapter-nav');
                if (nav.classList.contains('active')) {
                    nav.classList.remove('active');
                }
            }
        });
    });

    // Mobile navigation toggle
    const navToggle = document.getElementById('show-nav-toggle');
    navToggle.addEventListener('click', () => {
        const nav = document.getElementById('chapter-nav');
        nav.classList.toggle('active');
    });

    // Set active link in navigation based on current section
    window.addEventListener('hashchange', () => {
        handleInitialHash();
    });
}

/**
 * Handle the initial hash in URL when page loads
 */
function handleInitialHash() {
    let targetId = window.location.hash.substring(1); // Remove the #

    // Default to 'cover' if no hash
    if (!targetId) {
        targetId = 'cover';
    }

    // Scroll to the section
    const targetSection = document.getElementById(targetId);
    if (targetSection) {
        targetSection.scrollIntoView({ behavior: 'auto' });
        updateActiveSection(targetId);
    }
}

/**
 * Update the active section and navigation links
 */
function updateActiveSection(sectionId) {
    // Update state
    state.activeSection = sectionId;

    // Update active class on sections
    document.querySelectorAll('.section-container').forEach(section => {
        section.classList.remove('active');
    });

    const activeSection = document.getElementById(sectionId);
    if (activeSection) {
        activeSection.classList.add('active');
    }

    // Update navigation
    updateActiveNavLink(sectionId);

    // Handle Three.js scenes
    manageScenesVisibility();

    // Dispatch section-loaded event to notify other components (like sidebar)
    const sectionLoadedEvent = new CustomEvent('section-loaded', {
        detail: {
            sectionId: sectionId,
            timestamp: Date.now()
        }
    });
    console.log('Dispatching section-loaded event for:', sectionId);
    document.dispatchEvent(sectionLoadedEvent);
}

/**
 * Update the active navigation link based on current section
 */
function updateActiveNavLink(sectionId) {
    // Remove active class from all links
    document.querySelectorAll('#chapter-nav a').forEach(link => {
        link.classList.remove('active');
    });

    // Add active class to current section link
    const currentLink = document.querySelector(`#chapter-nav a[href="#${sectionId}"]`);
    if (currentLink) {
        currentLink.classList.add('active');

        // If in a nested section, also highlight parent chapter
        const parentChapterItem = currentLink.closest('.section-item')?.closest('.chapter-item');
        if (parentChapterItem) {
            const chapterLink = parentChapterItem.querySelector('.chapter-link');
            if (chapterLink) {
                chapterLink.classList.add('active');
            }
        }
    }
}

/**
 * Set up Intersection Observer for lazy loading
 */
function setupLazyLoading() {
    // Create an Intersection Observer
    state.observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const section = entry.target;
                loadSectionContent(section);
            }
        });
    }, {
        rootMargin: '200px 0px', // Load when within 200px of viewport
        threshold: 0.1 // Trigger when at least 10% visible
    });

    // Start observing all section containers
    document.querySelectorAll('.section-container').forEach(section => {
        state.observer.observe(section);
    });
}

/**
 * Set up the scroll observer to detect active section
 */
function setupScrollObserver() {
    console.log('Setting up scroll observer');

    // Get all section containers
    const sectionContainers = document.querySelectorAll('.section-container');

    // Update to use IntersectionObserver for better performance
    state.scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
                const sectionId = entry.target.id;
                console.log('Section scrolled into view:', sectionId);

                if (state.activeSection !== sectionId) {
                    updateActiveSection(sectionId);
                }
            }
        });
    }, {
        root: document.getElementById('book-content'),
        rootMargin: '0px',
        threshold: 0.5 // Element is considered visible when 50% visible
    });

    // Observe all section containers
    sectionContainers.forEach(section => {
        state.scrollObserver.observe(section);
    });

    // Also handle manual scroll events as a fallback
    document.getElementById('book-content').addEventListener('scroll', () => {
        // Throttle the function to improve performance
        if (!state.scrollThrottle) {
            state.scrollThrottle = setTimeout(() => {
                const visibleSections = Array.from(sectionContainers).filter(section => {
                    const rect = section.getBoundingClientRect();
                    const contentTop = document.getElementById('book-content').getBoundingClientRect().top;
                    return rect.top < window.innerHeight / 2 && rect.bottom > contentTop;
                });

                if (visibleSections.length > 0) {
                    // Sort by which section is most visible
                    visibleSections.sort((a, b) => {
                        const aRect = a.getBoundingClientRect();
                        const bRect = b.getBoundingClientRect();
                        const aVisible = Math.min(aRect.bottom, window.innerHeight) - Math.max(aRect.top, 0);
                        const bVisible = Math.min(bRect.bottom, window.innerHeight) - Math.max(bRect.top, 0);
                        return bVisible - aVisible;
                    });

                    const mostVisibleSection = visibleSections[0].id;
                    if (state.activeSection !== mostVisibleSection) {
                        console.log('Detected new active section via scroll:', mostVisibleSection);
                        updateActiveSection(mostVisibleSection);
                    }
                }

                state.scrollThrottle = null;
            }, 200);
        }
    });
}

/**
 * Set up the reading progress indicator
 */
function setupProgressIndicator() {
    const progressBar = document.getElementById('reading-progress');
    const content = document.getElementById('book-content');

    // Calculate and update progress on scroll
    content.addEventListener('scroll', () => {
        const scrollTop = content.scrollTop;
        const scrollHeight = content.scrollHeight - content.clientHeight;
        const progress = (scrollTop / scrollHeight) * 100;
        progressBar.style.width = `${progress}%`;
    });
}

/**
 * Load content for a section
 */
async function loadSectionContent(section) {
    const sectionId = section.id;
    const contentElement = section.querySelector('.section-content');

    if (!contentElement || state.loadedSections.has(sectionId)) {
        return; // Already loaded or no content element
    }

    const contentPath = contentElement.getAttribute('data-src');
    if (!contentPath) {
        console.error(`Section ${sectionId} has no data-src attribute`);
        return;
    }

    try {
        // Show loading state
        contentElement.classList.add('loading');

        // Fetch the content
        const response = await fetch(contentPath);

        if (!response.ok) {
            throw new Error(`Failed to load content: ${response.status} ${response.statusText}`);
        }

        const htmlContent = await response.text();

        // Insert the content
        contentElement.innerHTML = htmlContent;
        state.loadedSections.add(sectionId);

        // Initialize Three.js if needed
        initializeThreeJs(section);

        // Remove loading state
        contentElement.classList.remove('loading');

        console.log(`Loaded content for section: ${sectionId}`);

        // Dispatch section-loaded event after content is fully loaded
        const sectionLoadedEvent = new CustomEvent('section-loaded', {
            detail: {
                sectionId: sectionId,
                timestamp: Date.now(),
                loaded: true
            }
        });
        console.log('Dispatching section-loaded event after content loaded for:', sectionId);
        document.dispatchEvent(sectionLoadedEvent);
    } catch (error) {
        console.error(`Error loading section ${sectionId}:`, error);

        // Show error message
        contentElement.innerHTML = `
            <div class="error-message">
                <i class="ph ph-warning"></i>
                <h3>Failed to load content</h3>
                <p>${error.message}</p>
                <button class="retry-button" onclick="loadSectionContent(document.getElementById('${sectionId}'))">
                    Try Again
                </button>
            </div>
        `;
        contentElement.classList.remove('loading');
        contentElement.classList.add('error');
    }
}

/**
 * Initialize Three.js scenes in a section
 */
function initializeThreeJs(section) {
    // Find all elements marked for Three.js initialization
    const threejsContainers = section.querySelectorAll('[data-threejs]');

    threejsContainers.forEach(container => {
        const sceneId = container.getAttribute('data-threejs');

        if (!sceneId || state.threeJsScenes.has(sceneId)) {
            return; // No scene ID or already initialized
        }

        // Use the visualization engine to initialize the scene
        console.log(`Initializing Three.js scene: ${sceneId}`);

        try {
            // Create a global visualization engine instance if not already created
            if (!window.visualizationEngine) {
                window.visualizationEngine = new VisualizationEngine();
                window.visualizationEngine.init();
            }

            // Get the engine to handle this container
            const vizEngine = window.visualizationEngine;

            // Use the engine's initializeContainer method which adds the expand button
            // and creates the appropriate visualization
            vizEngine.initializeContainer(container, sceneId);

            // Add this scene to our tracked scenes
            state.threeJsScenes.set(sceneId, {
                id: sceneId,
                container,
                isVisible: true,
                // Store a reference to get scene data from the engine if needed
                getSceneData: () => vizEngine.scenes.get(sceneId)
            });

            // Add resize event handler
            window.addEventListener('resize', () => {
                vizEngine.handleResize();
            });

            // Dispatch event that visualization is ready
            const event = new CustomEvent('visualization-ready', {
                detail: {
                    id: sceneId,
                    container
                }
            });
            document.dispatchEvent(event);

        } catch (error) {
            console.error(`Error initializing Three.js scene ${sceneId}:`, error);

            // Add an error message to the container
            container.innerHTML = `
                <div class="viz-message">
                    <p>Unable to load 3D visualization. Please ensure WebGL is enabled in your browser.</p>
                </div>
            `;
        }
    });

    // Call manageScenesVisibility to ensure proper scene rendering
    manageScenesVisibility();
}

/**
 * Check if an element is in the viewport
 */
function isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
    return (
        rect.top >= -rect.height &&
        rect.left >= -rect.width &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) + rect.height &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth) + rect.width
    );
}

/**
 * Manage which Three.js scenes are visible and being rendered
 */
function manageScenesVisibility() {
    // Skip if visualization engine isn't initialized
    if (!window.visualizationEngine) return;

    state.threeJsScenes.forEach(scene => {
        const container = scene.container;
        const sceneData = scene.getSceneData();

        // If no scene data yet, skip
        if (!sceneData) return;

        // Check if container is visible in the viewport
        const isVisible = isElementInViewport(container);

        // Update visibility status
        scene.isVisible = isVisible;

        // The actual rendering is handled by the visualization engine's animate loops
        // We don't need to manually start/stop animations as they're all managed by the engine
    });
}

/**
 * Handle window resize to update Three.js renderers
 */
window.addEventListener('resize', () => {
    // Let the visualization engine handle resizing of all scenes
    if (window.visualizationEngine) {
        window.visualizationEngine.handleResize();
    }
});

/**
 * Clean up resources when page is unloaded
 */
window.addEventListener('beforeunload', () => {
    // Let the visualization engine clean up all scenes
    if (window.visualizationEngine) {
        window.visualizationEngine.scenes.forEach((sceneData, id) => {
            if (sceneData.renderer) {
                sceneData.renderer.dispose();
            }
            // Remove any event listeners
            if (sceneData.controls) {
                sceneData.controls.dispose();
            }
        });
    }
});