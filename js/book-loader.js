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
 * Set up Intersection Observer to track the active section during scrolling
 */
function setupScrollObserver() {
    // Create an Intersection Observer for scrolling
    state.scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            // If section is in view
            if (entry.isIntersecting && entry.intersectionRatio >= 0.3) {
                const sectionId = entry.target.id;

                // Update the URL hash without triggering a scroll
                if (history.pushState && window.location.hash !== `#${sectionId}`) {
                    history.pushState(null, null, `#${sectionId}`);
                }

                // Update active section
                updateActiveSection(sectionId);
            }
        });
    }, {
        threshold: [0.3, 0.7] // Trigger at these visibility thresholds
    });

    // Start observing all section containers
    document.querySelectorAll('.section-container').forEach(section => {
        state.scrollObserver.observe(section);
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

        // Here you would call your Three.js initialization code
        // This is a placeholder for your specific Three.js setup
        console.log(`Initializing Three.js scene: ${sceneId}`);

        try {
            // Placeholder for Three.js scene initialization
            // In reality, you would create your scene, camera, renderer, etc.
            const scene = {
                id: sceneId,
                container,
                isVisible: false,
                animationFrameId: null,

                // Mock renderer and scene objects
                renderer: {
                    domElement: document.createElement('canvas'),
                    render: () => {},
                    setSize: () => {},
                    dispose: () => {}
                },
                scene: { children: [] },
                camera: {},

                // Animation loop function
                animate: function() {
                    if (!this.isVisible) return;

                    // Your animation code would go here

                    // Request next frame if still visible
                    if (this.isVisible) {
                        this.animationFrameId = requestAnimationFrame(() => this.animate());
                    }
                },

                // Start rendering
                start: function() {
                    if (!this.isVisible) {
                        this.isVisible = true;
                        this.animate();
                    }
                },

                // Stop rendering
                stop: function() {
                    if (this.isVisible) {
                        this.isVisible = false;
                        if (this.animationFrameId) {
                            cancelAnimationFrame(this.animationFrameId);
                            this.animationFrameId = null;
                        }
                    }
                },

                // Clean up resources
                dispose: function() {
                    this.stop();
                    this.renderer.dispose();
                    // Clean up geometries, materials, etc.
                }
            };

            // Append the canvas to the container
            container.appendChild(scene.renderer.domElement);

            // Store the scene
            state.threeJsScenes.set(sceneId, scene);

            // Start rendering if section is active or visible
            if (isElementInViewport(container)) {
                scene.start();
            }
        } catch (error) {
            console.error(`Error initializing Three.js scene ${sceneId}:`, error);
            container.innerHTML = `
                <div class="error-message">
                    <i class="ph ph-warning"></i>
                    <h3>Failed to initialize 3D scene</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    });
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
 * Manage visibility of Three.js scenes based on active section and viewport
 */
function manageScenesVisibility() {
    state.threeJsScenes.forEach(scene => {
        const container = scene.container;

        // Check if container is visible in the viewport
        if (isElementInViewport(container)) {
            scene.start();
        } else {
            scene.stop();
        }
    });
}

/**
 * Handle window resize to update Three.js renderers
 */
window.addEventListener('resize', () => {
    state.threeJsScenes.forEach(scene => {
        // Update renderer size
        if (scene.renderer && scene.container) {
            const width = scene.container.clientWidth;
            const height = scene.container.clientHeight;
            scene.renderer.setSize(width, height);

            // Update camera aspect ratio if needed
            if (scene.camera && scene.camera.aspect) {
                scene.camera.aspect = width / height;
                scene.camera.updateProjectionMatrix();
            }
        }
    });
});

/**
 * Handle scroll events to update Three.js visibility
 */
document.getElementById('book-content').addEventListener('scroll', () => {
    // Throttle the function to improve performance
    if (!state.scrollThrottle) {
        state.scrollThrottle = setTimeout(() => {
            manageScenesVisibility();
            state.scrollThrottle = null;
        }, 200);
    }
});

/**
 * Clean up resources when page is unloaded
 */
window.addEventListener('beforeunload', () => {
    state.threeJsScenes.forEach(scene => {
        scene.dispose();
    });
});