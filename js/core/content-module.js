/**
 * VistaKine Content Module
 * Handles loading and management of section content
 */

// Ensure VistaKine namespace exists
window.VistaKine = window.VistaKine || {};

// Content module
VistaKine.content = {
    // State
    state: {
        observer: null,
        loadedSections: new Set(),
        contentInitialized: false
    },

    /**
     * Initialize content loading functionality
     */
    init: function() {
        if (VistaKine.content.state.contentInitialized) {
            VistaKine.utils.log('Content module already initialized', 'warn');
            return;
        }

        VistaKine.utils.log('Initializing content module');

        // Setup the Intersection Observer for lazy loading
        VistaKine.content.setupLazyLoading();

        // Load the initial visible section immediately
        VistaKine.content.loadInitialSection();

        // Set up scroll observer for section visibility
        VistaKine.content.setupScrollObserver();

        // Setup progress indicator if enabled
        if (VistaKine.config.features.progressIndicator) {
            VistaKine.content.setupProgressIndicator();
        }

        // Mark as initialized
        VistaKine.content.state.contentInitialized = true;
        VistaKine.state.initialized.content = true;

        VistaKine.utils.log('Content module initialized successfully', 'success');
    },

    /**
     * Set up Intersection Observer for lazy loading
     */
    setupLazyLoading: function() {
        if (!VistaKine.config.features.lazyLoading) {
            VistaKine.utils.log('Lazy loading disabled in config', 'warn');
            return;
        }

        // Create an Intersection Observer
        VistaKine.content.state.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const section = entry.target;
                    VistaKine.utils.log(`Section ${section.id} is intersecting, loading content...`);
                    VistaKine.content.loadSection(section);
                }
            });
        }, {
            rootMargin: '200px 0px', // Load when within 200px of viewport
            threshold: 0.1 // Trigger when at least 10% visible
        });

        // Start observing all section containers
        const sectionContainers = VistaKine.dom.getSections();

        VistaKine.utils.log(`Found ${sectionContainers.length} section containers to observe`);

        if (sectionContainers.length === 0) {
            VistaKine.utils.log('No section containers found! This may indicate a structural issue.', 'warn');
            return;
        }

        sectionContainers.forEach(section => {
            VistaKine.content.state.observer.observe(section);
            VistaKine.utils.log(`Now observing section: ${section.id}`);
        });
    },

    /**
     * Load the initial visible section immediately
     */
    loadInitialSection: function() {
        const initialSection = VistaKine.navigation.findVisibleSection();

        if (initialSection) {
            VistaKine.utils.log(`Loading initial section ${initialSection.id} immediately`);
            VistaKine.content.loadSection(initialSection);
        } else {
            VistaKine.utils.log('No visible section found for immediate loading', 'warn');

            // Fallback: load the first section
            const sections = VistaKine.dom.getSections();
            const firstSection = sections[0];

            if (firstSection) {
                VistaKine.utils.log(`Fallback: Loading first section ${firstSection.id}`);
                VistaKine.content.loadSection(firstSection);
            }
        }
    },

    /**
     * Set up an observer to detect which section is visible while scrolling
     */
    setupScrollObserver: function() {
        // Use a throttled scroll event to check section visibility
        let ticking = false;

        window.addEventListener('scroll', function() {
            if (!ticking) {
                window.requestAnimationFrame(function() {
                    const visibleSection = VistaKine.navigation.findVisibleSection();

                    if (visibleSection && visibleSection.id) {
                        // Only update if not already the active section
                        if (VistaKine.state.activeSection !== visibleSection.id) {
                            VistaKine.utils.log(`Scroll detected: ${visibleSection.id} now visible`);

                            // Update active section in navigation
                            VistaKine.navigation.setActiveSection(visibleSection.id);

                            // Update URL hash if needed
                            if (window.location.hash !== `#${visibleSection.id}`) {
                                history.replaceState(null, null, `#${visibleSection.id}`);
                            }
                        }

                        // Also ensure this section's content is loaded
                        VistaKine.content.loadSection(visibleSection);
                    }

                    ticking = false;
                });

                ticking = true;
            }
        }, { passive: true });
    },

    /**
     * Set up the reading progress indicator
     */
    setupProgressIndicator: function() {
        const progressBar = document.getElementById('reading-progress');

        if (!progressBar) {
            VistaKine.utils.log('Reading progress indicator element not found', 'warn');
            return;
        }

        // Update progress on scroll
        window.addEventListener('scroll', () => {
            const scrollPosition = window.scrollY;
            const windowHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight - windowHeight;
            const progress = (scrollPosition / documentHeight) * 100;

            progressBar.style.width = `${progress}%`;
        }, { passive: true });
    },

    /**
     * Load content for a section
     */
    loadSection: function(section) {
        if (!section) {
            VistaKine.utils.log('No section provided to loadSection', 'error');
            return false;
        }

        const sectionId = section.id;
        const contentElement = section.querySelector('.section-content');

        if (!contentElement) {
            VistaKine.utils.log(`Section ${sectionId} has no content element`, 'error');
            return false;
        }

        // Check if already loaded
        if (VistaKine.state.loadedSections.has(sectionId) || VistaKine.content.state.loadedSections.has(sectionId)) {
            VistaKine.utils.log(`Section ${sectionId} already loaded, skipping`);
            return true;
        }

        const contentPath = contentElement.getAttribute('data-src');
        if (!contentPath) {
            VistaKine.utils.log(`Section ${sectionId} has no data-src attribute`, 'error');
            return false;
        }

        VistaKine.utils.log(`Loading content for section ${sectionId} from ${contentPath}`);

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

        return VistaKine.content.fetchSectionContent(contentPath, sectionId)
            .then(htmlContent => {
                // Success! Insert the content
                contentElement.innerHTML = htmlContent;

                // Mark as loaded in both state objects for compatibility
                VistaKine.state.loadedSections.add(sectionId);
                VistaKine.content.state.loadedSections.add(sectionId);

                // Initialize Three.js if available
                if (typeof VistaKine.visualization !== 'undefined') {
                    if (typeof VistaKine.visualization.initializeScene === 'function') {
                        console.log(`Initializing visualization for section ${sectionId}`);
                        VistaKine.visualization.initializeScene(section);
                    } else if (typeof VistaKine.visualization.scanForContainers === 'function') {
                        console.log(`Scanning for visualizations in section ${sectionId}`);
                        VistaKine.visualization.scanForContainers();
                    }
                }

                // Remove loading state
                contentElement.classList.remove('loading');

                // Force a relayout/repaint to ensure content is visible
                contentElement.style.display = 'none';
                contentElement.offsetHeight; // Force a reflow
                contentElement.style.display = '';

                // Calculate reading time if applicable
                VistaKine.content.calculateReadingTime(section);

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

                VistaKine.utils.log(`Section ${sectionId} loaded successfully`, 'success');
                return true;
            })
            .catch(error => {
                VistaKine.utils.log(`Error loading content for ${sectionId}: ${error.message}`, 'error');

                contentElement.innerHTML = `
                    <div class="error-message">
                        <h2>Error Loading Content</h2>
                        <p>Failed to load content for this section.</p>
                        <p class="error-details">${error.message}</p>
                        <button onclick="VistaKine.content.loadSection(document.getElementById('${sectionId}'))">Try Again</button>
                        <button onclick="window.location.reload()">Reload Page</button>
                    </div>
                `;

                contentElement.classList.remove('loading');
                contentElement.classList.add('error');

                return false;
            });
    },

    /**
     * Fetch section content with multiple fallback strategies
     */
    fetchSectionContent: function(contentPath, sectionId) {
        // Determine environment
        const isGitHubPages = VistaKine.state.isGitHubPages;

        // Create a copy of the original path
        const originalPath = contentPath;

        // Simple absolute path for local development
        const localPath = contentPath.startsWith('/') ? contentPath : '/' + contentPath;

        // Use cache busting to avoid caching issues
        const cacheBuster = `?_=${Date.now()}`;

        // Create paths to try based on environment
        const pathsToTry = [];

        if (isGitHubPages) {
            // GitHub Pages paths
            pathsToTry.push(
                VistaKine.utils.getResourcePath(contentPath) + cacheBuster,
                VistaKine.utils.getResourcePath(contentPath),
                contentPath + cacheBuster,
                contentPath
            );
        } else {
            // Local development paths
            pathsToTry.push(
                originalPath + cacheBuster,
                originalPath,
                contentPath.replace(/^\//, ''),
                localPath + cacheBuster,
                localPath
            );
        }

        // Common fallbacks for both environments
        pathsToTry.push(
            new URL(contentPath.replace(/^\/+/, ''), window.location.origin).href,
            contentPath.replace(/^\/+/, '')
        );

        // Log the paths
        VistaKine.utils.log(`Trying to fetch content for ${sectionId} with ${pathsToTry.length} possible paths`);

        // Try each path until one works
        return VistaKine.content.tryPaths(pathsToTry, 0, sectionId);
    },

    /**
     * Recursively try paths until one succeeds or all fail
     */
    tryPaths: function(paths, index, sectionId) {
        if (index >= paths.length) {
            return Promise.reject(new Error(`Failed to load content for ${sectionId} after trying ${paths.length} paths`));
        }

        const path = paths[index];
        VistaKine.utils.log(`Trying path ${index + 1}/${paths.length}: ${path}`);

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

        return fetch(path, fetchOptions)
            .then(response => {
                if (response.ok) {
                    VistaKine.utils.log(`Path succeeded: ${path}`, 'success');
                    return response.text();
                }

                VistaKine.utils.log(`Path failed with status ${response.status}: ${path}`, 'warn');
                // Try next path
                return VistaKine.content.tryPaths(paths, index + 1, sectionId);
            })
            .catch(error => {
                VistaKine.utils.log(`Error fetching ${path}: ${error.message}`, 'warn');
                // Try next path
                return VistaKine.content.tryPaths(paths, index + 1, sectionId);
            });
    },

    /**
     * Calculate reading time for a section's content
     */
    calculateReadingTime: function(section) {
        if (!section) return;

        // Find the reading time element
        const readingTimeElement = section.querySelector('.reading-time span');
        if (!readingTimeElement) return;

        // Find the text content (usually in a .section-text element)
        const textContent = section.querySelector('.section-text') || section;

        if (textContent) {
            // Average reading speed (words per minute)
            const wordsPerMinute = 200;

            // Get text content
            const text = textContent.textContent || textContent.innerText;

            // Count words (roughly)
            const wordCount = text.trim().split(/\s+/).length;

            // Calculate reading time in minutes
            const readingTime = Math.ceil(wordCount / wordsPerMinute);

            // Update the reading time element
            readingTimeElement.textContent = readingTime < 1 ? '< 1 min read' : readingTime + ' min read';

            VistaKine.utils.log(`Calculated reading time for ${section.id}: ${readingTimeElement.textContent}`);
        }
    }
};

// Initialize when core and navigation are ready
document.addEventListener('DOMContentLoaded', function() {
    // Check if necessary modules are initialized before proceeding
    const initInterval = setInterval(function() {
        if (window.VistaKine &&
            VistaKine.state &&
            VistaKine.state.initialized.core &&
            VistaKine.state.initialized.navigation) {

            clearInterval(initInterval);
            VistaKine.content.init();
        }
    }, 50);
});