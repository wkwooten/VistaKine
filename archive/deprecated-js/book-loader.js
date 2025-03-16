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
    initialized: false,
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded event triggered - initializing book loader");
    initializeBookLoader();
});

// Allow manual initialization (as a fallback)
function initializeBookLoader() {
    if (state.initialized) {
        console.log("Book loader already initialized, skipping");
        return;
    }

    console.log("Initializing book loader...");
    try {
        setupNavigation();
        setupLazyLoading();
        setupScrollObserver();
        setupProgressIndicator();
        handleInitialHash();
        state.initialized = true;
        console.log("Book loader initialization complete");
    } catch (error) {
        console.error("Error during book loader initialization:", error);
        // Try again in 500ms as a fallback
        setTimeout(initializeBookLoader, 500);
    }
}

// Make initializeBookLoader globally available
window.initializeBookLoader = initializeBookLoader;

// Make loadSectionContent globally available
window.loadSectionContent = async function(section) {
    // If module is initialized, use its version
    if (state.initialized) {
        return loadSectionContent(section);
    }

    // Otherwise, a minimal version
    const sectionId = section.id;
    const contentElement = section.querySelector('.section-content');

    if (!contentElement) {
        console.error(`Section ${sectionId} has no content element`);
        return;
    }

    const contentPath = contentElement.getAttribute('data-src');
    if (!contentPath) {
        console.error(`Section ${sectionId} has no data-src attribute`);
        return;
    }

    console.log(`Global loadSectionContent: Loading section ${sectionId} from ${contentPath}`);

    try {
        let finalPath = contentPath;
        if (window.vistaKineConfig && window.vistaKineConfig.isGitHubPages) {
            finalPath = window.vistaKineConfig.getResourcePath(contentPath);
        }

        const response = await fetch(finalPath);

        if (!response.ok) {
            throw new Error(`Failed to load: ${response.status}`);
        }

        const html = await response.text();
        contentElement.innerHTML = html;
        console.log(`Successfully loaded content for ${sectionId}`);
        return true;
    } catch (error) {
        console.error(`Error loading ${sectionId}:`, error);
        contentElement.innerHTML = `
            <div class="error-message">
                <h2>Error Loading Content</h2>
                <p>${error.message}</p>
                <button onclick="window.location.reload()">Reload</button>
            </div>
        `;
        return false;
    }
};

/**
 * Set up navigation functionality
 */
function setupNavigation() {
    console.log("Setting up navigation...");

    // Get the navigation elements - try different selectors to handle various structures
    const navLinks = document.querySelectorAll('.sidebar-nav a, #chapter-nav a, nav a');

    if (navLinks.length === 0) {
        console.warn("No navigation links found!");
    } else {
        console.log(`Found ${navLinks.length} navigation links`);
    }

    // Handle navigation click events
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');

            if (!href) {
                console.warn("Navigation link has no href attribute:", link);
                return;
            }

            // Only handle internal links
            if (href.startsWith('#')) {
                const targetId = href.substring(1); // Remove the #

                if (targetId) {
                    e.preventDefault();
                    console.log(`Navigation clicked: ${targetId}`);

                    // Scroll to the section smoothly
                    const targetSection = document.getElementById(targetId);
                    if (targetSection) {
                        targetSection.scrollIntoView({ behavior: 'smooth' });

                        // Force load the section content (in case intersection observer missed it)
                        loadSectionContent(targetSection);
                    } else {
                        console.warn(`Target section #${targetId} not found`);
                    }

                    // Update URL hash without scrolling
                    history.pushState(null, null, `#${targetId}`);

                    // Mobile: close navigation if open
                    const navElements = document.querySelectorAll('.sidebar, .sidebar-nav, #chapter-nav');
                    navElements.forEach(nav => {
                        if (nav && nav.classList.contains('active')) {
                            nav.classList.remove('active');
                        }
                    });
                }
            }
        });
    });

    // Mobile navigation toggle
    const navToggle = document.getElementById('show-nav-toggle');
    if (navToggle) {
        navToggle.addEventListener('click', () => {
            // Try different navigation elements
            const navElements = [
                document.querySelector('.sidebar'),
                document.querySelector('.sidebar-nav'),
                document.getElementById('chapter-nav')
            ].filter(Boolean);

            if (navElements.length > 0) {
                navElements.forEach(nav => nav.classList.toggle('active'));
            } else {
                console.warn("No navigation element found to toggle");
            }
        });
    } else {
        console.warn("Navigation toggle button not found");
    }

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
    console.log("Setting up lazy loading...");

    // Create an Intersection Observer
    state.observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const section = entry.target;
                console.log(`Section ${section.id} is intersecting, loading content...`);
                loadSectionContent(section);
            }
        });
    }, {
        rootMargin: '200px 0px', // Load when within 200px of viewport
        threshold: 0.1 // Trigger when at least 10% visible
    });

    // Start observing all section containers
    const sectionContainers = document.querySelectorAll('.section-container');
    console.log(`Found ${sectionContainers.length} section containers to observe`);

    if (sectionContainers.length === 0) {
        console.warn("No section containers found! This may indicate a structural issue.");
    }

    sectionContainers.forEach(section => {
        state.observer.observe(section);
        console.log(`Now observing section: ${section.id}`);
    });

    // Load the initial section immediately (don't wait for intersection)
    const initialSection = getVisibleSection();
    if (initialSection) {
        console.log(`Loading initial section ${initialSection.id} immediately`);
        loadSectionContent(initialSection);
    } else {
        console.warn("No visible section found for immediate loading");
        // Fallback: load the first section
        const firstSection = sectionContainers[0];
        if (firstSection) {
            console.log(`Fallback: Loading first section ${firstSection.id}`);
            loadSectionContent(firstSection);
        }
    }
}

/**
 * Get the currently visible section
 */
function getVisibleSection() {
    const sections = document.querySelectorAll('.section-container');
    const viewportHeight = window.innerHeight;
    const viewportTop = window.scrollY;
    const viewportBottom = viewportTop + viewportHeight;

    // Find the section that occupies the most of the viewport
    let bestSection = null;
    let bestVisibleArea = 0;

    sections.forEach(section => {
        const rect = section.getBoundingClientRect();
        const sectionTop = rect.top + window.scrollY;
        const sectionBottom = rect.bottom + window.scrollY;

        // Calculate the visible area of the section
        const visibleTop = Math.max(sectionTop, viewportTop);
        const visibleBottom = Math.min(sectionBottom, viewportBottom);
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);

        if (visibleHeight > bestVisibleArea) {
            bestVisibleArea = visibleHeight;
            bestSection = section;
        }
    });

    return bestSection;
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

    if (!contentElement) {
        console.error(`Section ${sectionId} has no content element`);
        return; // No content element
    }

    if (state.loadedSections.has(sectionId)) {
        console.log(`Section ${sectionId} already loaded, skipping`);
        return; // Already loaded
    }

    let contentPath = contentElement.getAttribute('data-src');
    if (!contentPath) {
        console.error(`Section ${sectionId} has no data-src attribute`);
        return;
    }

    console.log(`Loading content for section ${sectionId} from ${contentPath}`);

    // Create a loading indicator if it doesn't exist
    let loadingElement = contentElement.querySelector('.loading-placeholder');
    if (!loadingElement) {
        loadingElement = document.createElement('div');
        loadingElement.className = 'loading-placeholder';
        loadingElement.textContent = `Loading ${sectionId}...`;
        contentElement.appendChild(loadingElement);
    }

    // Show loading state
    contentElement.classList.add('loading');

    const isGitHubPages = window.vistaKineConfig && window.vistaKineConfig.isGitHubPages;
    console.log(`Environment: ${isGitHubPages ? 'GitHub Pages' : 'Local Development'}`);

    // Create a copy of the original path for local development
    const originalPath = contentPath;

    // Simple absolute path for local development
    const localPath = contentPath.startsWith('/') ? contentPath : '/' + contentPath;

    // Adjusted paths for GitHub Pages
    let githubPagesPath = contentPath;
    if (isGitHubPages && window.vistaKineConfig.repoName) {
        const repoName = window.vistaKineConfig.repoName;
        // Strip leading slashes and ensure no double slashes
        const cleanPath = contentPath.replace(/^\/+/, '');
        // Add repo name prefix if not already present
        if (!cleanPath.startsWith(repoName + '/')) {
            githubPagesPath = `/${repoName}/${cleanPath}`;
        } else {
            githubPagesPath = `/${cleanPath}`;
        }
    }

    // Encode parentheses and spaces for problematic filenames
    if (contentPath.includes('(') || contentPath.includes(')') || contentPath.includes(' ')) {
        const pathParts = contentPath.split('/');
        const fileName = pathParts.pop();
        const directory = pathParts.join('/');

        // Replace problematic characters in the filename
        const encodedFileName = fileName
            .replace(/\(/g, '%28')
            .replace(/\)/g, '%29')
            .replace(/\s/g, '%20');

        // Reconstruct the path
        const encodedPath = directory ? `${directory}/${encodedFileName}` : encodedFileName;

        // Add this as another path to try
        if (isGitHubPages) {
            if (window.vistaKineConfig.repoName) {
                const repoName = window.vistaKineConfig.repoName;
                const cleanEncodedPath = encodedPath.replace(/^\/+/, '');
                if (!cleanEncodedPath.startsWith(repoName + '/')) {
                    githubPagesPath = `/${repoName}/${cleanEncodedPath}`;
                }
            }
        }
    }

    // Use a cache buster to avoid caching issues
    const cacheBuster = `?_=${Date.now()}`;

    // Create the final list of paths to try
    const pathsToTry = [];

    if (isGitHubPages) {
        // GitHub Pages paths
        pathsToTry.push(
            githubPagesPath + cacheBuster,                      // GitHub Pages adjusted path with cache buster
            githubPagesPath,                                    // GitHub Pages adjusted path without cache buster
            window.vistaKineConfig.getResourcePath(contentPath) // Use the helper function
        );
    } else {
        // Local development paths
        pathsToTry.push(
            originalPath + cacheBuster,           // Original with cache buster
            originalPath,                         // Original without cache buster
            contentPath.replace(/^\//, ''),       // Without leading slash
            localPath                             // Ensure leading slash
        );
    }

    // Add shared fallbacks for both environments
    pathsToTry.push(
        // Try with URL constructor (handles relative paths correctly)
        new URL(contentPath.replace(/^\/+/, ''), window.location.origin).href,
        // Try direct content path (for local file:// protocol)
        contentPath
    );

    // Debug info
    console.log("Paths to try:", JSON.stringify(pathsToTry, null, 2));

    // Try to fetch the content with progressive fallbacks
    let response = null;
    let usedPath = '';
    let htmlContent = '';
    let fetchSuccess = false;

    try {
        // Try each path until one works
        for (const path of pathsToTry) {
            try {
                console.log(`Trying path: "${path}"`);

                // Fetch options to prevent caching
                const fetchOptions = {
                    method: 'GET',
                    headers: {
                        'Accept': 'text/html',
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    },
                    cache: 'no-store'
                };

                response = await fetch(path, fetchOptions);

                if (response.ok) {
                    usedPath = path;
                    htmlContent = await response.text();
                    console.log(`✅ Success with path: "${path}", content length: ${htmlContent.length} chars`);
                    fetchSuccess = true;
                    break;
                } else {
                    console.log(`❌ Failed with path: "${path}", status: ${response.status}`);
                }
            } catch (error) {
                console.warn(`❌ Error fetching "${path}":`, error.message);
            }
        }

        // If none of the paths worked, show an error
        if (!fetchSuccess) {
            throw new Error(`Failed to load content for section ${sectionId} after trying multiple paths`);
        }

        // Success! Insert the content
        console.log(`✅ Successfully loaded content for "${sectionId}", from: "${usedPath}"`);
        contentElement.innerHTML = htmlContent;
        state.loadedSections.add(sectionId);

        // Initialize Three.js if needed
        initializeThreeJs(section);

        // Remove loading state
        contentElement.classList.remove('loading');

        // Force a relayout/repaint to ensure content is visible
        contentElement.style.display = 'none';
        contentElement.offsetHeight; // Force a reflow
        contentElement.style.display = '';

        // Dispatch section-loaded event
        const sectionLoadedEvent = new CustomEvent('section-loaded', {
            detail: {
                sectionId: sectionId,
                timestamp: Date.now(),
                loaded: true,
                sectionElement: section
            }
        });
        document.dispatchEvent(sectionLoadedEvent);

        return true; // Success
    } catch (error) {
        console.error(`Error loading content for ${sectionId}:`, error);
        contentElement.innerHTML = `
            <div class="error-message">
                <h2>Error Loading Content</h2>
                <p>Failed to load content for this section. Please try again later.</p>
                <p class="error-details">${error.message}</p>
                <p>Paths attempted: ${pathsToTry.join(', ')}</p>
                <button onclick="loadSectionContent(document.getElementById('${sectionId}'))">Try Again</button>
                <button onclick="window.location.reload()">Reload Page</button>
            </div>
        `;
        contentElement.classList.remove('loading');
        contentElement.classList.add('error');

        return false; // Failure
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