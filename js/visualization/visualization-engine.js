/**
 * VistaKine Visualization Engine
 *
 * This file handles:
 * - Initialization of Three.js scenes
 * - Integration with Cannon.js physics
 * - Management of visualization containers
 * - Fullscreen/expand functionality
 */

// Create the VistaKine namespace if it doesn't exist
if (!window.VistaKine) {
    window.VistaKine = {};
}

// Create visualization namespace
VistaKine.visualization = {
    initialized: false,
    engine: null,

    /**
     * Initialize the visualization module
     */
    init: function() {
        if (this.initialized && this.engine) {
            console.warn('Visualization module already initialized');
            return;
        }

        console.log('Initializing VistaKine visualization module');

        try {
            // Create the engine instance immediately
            this.engine = new VisualizationEngine();

            // Initialize the engine
            this.engine.init();

            // Initialize scene managers if available
            if (VistaKine.SceneManager) {
                VistaKine.SceneManager.init();
            }

            // Initialize chapter managers if available
            if (VistaKine.ChapterManager) {
                VistaKine.ChapterManager.init();
            }

            // Add event listener for when new sections are loaded
            document.addEventListener('section-loaded', (event) => {
                console.log('Section loaded event received, scanning for visualizations');
                this.scanForContainers();
            });

            this.initialized = true;
            console.log('Visualization module initialized successfully');

            // Scan for any containers that might already be in the page
            this.scanForContainers();
        } catch (error) {
            console.error('Error initializing visualization module:', error);

            // Still mark as initialized to prevent multiple init attempts
            this.initialized = true;

            // Display user-friendly error
            if (VistaKine.loader && typeof VistaKine.loader.showErrorMessage === 'function') {
                VistaKine.loader.showErrorMessage('Could not initialize visualization: ' + error.message);
            }
        }
    },

    /**
     * Initialize visualization for a specific section
     * This is called from content-module.js when a section is loaded
     */
    initializeScene: function(section) {
        console.log('Initializing visualization for section:', section.id);

        // Make sure engine is initialized
        if (!this.initialized || !this.engine) {
            console.log('Visualization engine not initialized yet, initializing now...');
            this.init();

            // If initialization failed or is still not ready, show error
            if (!this.engine) {
                console.error('Failed to initialize visualization engine');
                if (VistaKine.loader && typeof VistaKine.loader.showErrorMessage === 'function') {
                    VistaKine.loader.showErrorMessage('Failed to initialize visualization engine. Please reload the page.');
                }
                return;
            }
        }

        // Use the onInit callback to ensure the engine is ready
        this.engine.onInit((error) => {
            if (error) {
                console.error('Failed to initialize engine:', error);
                return;
            }

            // Find all visualization containers within this section
            const containers = section.querySelectorAll('[data-threejs]');

            if (containers.length === 0) {
                console.log('No visualization containers found in section:', section.id);
                return;
            }

            console.log(`Found ${containers.length} visualization containers in section ${section.id}`);

            // Initialize each container
            containers.forEach(container => {
                const vizId = container.getAttribute('data-threejs');
                this.engine.initializeContainer(container, vizId);
            });
        });
    },

    /**
     * Create a new visualization in the specified container
     */
    createVisualization: function(container, options) {
        // Make sure engine is initialized
        if (!this.initialized || !this.engine) {
            console.log('Visualization engine not initialized yet, initializing now...');
            this.init();

            // If initialization failed or is still not ready, show error
            if (!this.engine) {
                console.error('Failed to initialize visualization engine');
                return null;
            }
        }

        return this.engine.initializeContainer(container, options.id || 'viz-' + Date.now());
    },

    /**
     * Scan the page for visualization containers
     */
    scanForContainers: function() {
        // Make sure engine is initialized
        if (!this.initialized || !this.engine) {
            console.log('Visualization engine not initialized yet, initializing now...');
            this.init();

            // If initialization failed or is still not ready, show error
            if (!this.engine) {
                console.error('Failed to initialize visualization engine');
                return;
            }
        }

        // Use the onInit callback to ensure the engine is ready
        this.engine.onInit((error) => {
            if (error) {
                console.error('Failed to initialize engine:', error);
                return;
            }

            console.log('Engine ready, scanning for containers...');
            this.engine.scanForContainers();
        });
    }
};

class VisualizationEngine {
    constructor() {
        console.log('VisualizationEngine: Constructor called');

        // Initialize properties
        this.scenes = new Map(); // Store all active scenes
        this.initialized = false;
        this.initCallbacks = []; // Callbacks to run after initialization
        this.initAttempted = false;

        // Bind methods that will be used as event handlers
        this.handleResize = this.handleResize.bind(this);
        this.toggleFullscreen = this.toggleFullscreen.bind(this);
        this.scanForContainers = this.scanForContainers.bind(this);

        // Add a timestamp for debugging
        this.constructorTimestamp = Date.now();
    }

    /**
     * Initialize the visualization engine and scan for containers
     */
    init() {
        console.log('VisualizationEngine: init method called');

        if (this.initialized) {
            console.warn('VisualizationEngine already initialized, skipping');
            // Run any pending callbacks
            this.runInitCallbacks();
            return;
        }

        this.initAttempted = true;

        try {
            // Check if Three.js is available
            if (typeof THREE === 'undefined') {
                throw new Error('Three.js library not found. Visualization engine cannot initialize.');
            }

            // Listen for window resize events
            window.addEventListener('resize', this.handleResize);

            // Scan the page for visualization containers
            this.scanForContainers();

            this.initialized = true;
            console.log('VisualizationEngine initialized successfully');

            // Run any pending callbacks
            this.runInitCallbacks();
        } catch (error) {
            console.error('Error initializing VisualizationEngine:', error);

            // Create a fallback div in any containers
            const containers = document.querySelectorAll('[data-threejs]');
            containers.forEach(container => {
                container.innerHTML = `
                    <div style="padding: 20px; background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 4px;">
                        <h3>Visualization Error</h3>
                        <p>Failed to initialize the visualization engine: ${error.message}</p>
                        <button onclick="location.reload()" style="background: #dc3545; color: white; border: none;
                                padding: 5px 10px; border-radius: 4px; margin-top: 10px;">
                            Reload Page
                        </button>
                    </div>
                `;
            });

            // Add a global error message
            if (VistaKine.loader && typeof VistaKine.loader.showErrorMessage === 'function') {
                VistaKine.loader.showErrorMessage('Failed to initialize visualization engine: ' + error.message);
            }

            // Try to run callbacks with error
            this.runInitCallbacks(error);
        }
    }

    /**
     * Register a callback to run after initialization
     */
    onInit(callback) {
        if (typeof callback !== 'function') return;

        if (this.initialized) {
            // Already initialized, run callback immediately
            callback();
        } else {
            // Store callback for later
            this.initCallbacks.push(callback);
        }
    }

    /**
     * Run all initialization callbacks
     */
    runInitCallbacks(error = null) {
        // Run all callbacks and clear the array
        while (this.initCallbacks.length > 0) {
            const callback = this.initCallbacks.shift();
            try {
                callback(error);
            } catch (e) {
                console.error('Error in initialization callback:', e);
            }
        }
    }

    /**
     * Scan the page for visualization containers and initialize them
     */
    scanForContainers() {
        try {
            console.log('VisualizationEngine: Scanning for containers with data-threejs attribute');

            // Check if we're initialized
            if (!this.initialized) {
                console.warn('VisualizationEngine not initialized yet, containers will be scanned after initialization');
                this.onInit(() => this.scanForContainers());
                return;
            }

            // Find all containers with data-threejs attribute
            const containers = document.querySelectorAll('[data-threejs]');

            console.log(`Found ${containers.length} visualization containers`);

            // Process each container
            containers.forEach(container => {
                try {
                    // Skip if already initialized or being processed
                    if (container.hasAttribute('data-viz-initialized') ||
                        container.hasAttribute('data-viz-processing')) {
                        return;
                    }

                    const vizId = container.getAttribute('data-threejs');
                    console.log(`Processing container with ID: ${vizId}`);
                    this.initializeContainer(container, vizId);
                } catch (containerError) {
                    console.error('Error processing container:', containerError);
                }
            });
        } catch (error) {
            console.error('Error scanning for containers:', error);
        }
    }

    /**
     * Initialize a specific visualization container
     */
    initializeContainer(container, vizId) {
        try {
            console.log(`Initializing visualization container with ID: ${vizId}`);

            // Check if container is valid
            if (!container || !(container instanceof HTMLElement)) {
                console.error('Invalid container provided to initializeContainer');
                return;
            }

            // Check if container already has a visualization
            if (container.hasAttribute('data-viz-initialized')) {
                console.log(`Container ${vizId} already initialized, skipping`);
                return;
            }

            // Mark container as being processed
            container.setAttribute('data-viz-processing', 'true');

            // Add expand button to the container
            this.addExpandButton(container);

            // Create the Three.js scene based on the visualization ID
            switch(vizId) {
                case 'coordinate-intro':
                    this.createCoordinateSystem(container, vizId);
                    break;
                // Add more visualization types here
                default:
                    console.warn(`Unknown visualization type: ${vizId}, using default scene`);
                    this.createDefaultScene(container, vizId);
            }

            // Mark container as initialized
            container.removeAttribute('data-viz-processing');
            container.setAttribute('data-viz-initialized', 'true');

            console.log(`Container ${vizId} initialized successfully`);
        } catch (error) {
            console.error(`Error initializing container ${vizId}:`, error);

            // Remove processing flag
            if (container) {
                container.removeAttribute('data-viz-processing');

                // Add error message to container
                container.innerHTML = `
                    <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
                          background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px;">
                        <div style="text-align: center; padding: 20px;">
                            <h3 style="color: #dc3545; margin-bottom: 10px;">Visualization Error</h3>
                            <p style="margin-bottom: 15px;">There was a problem with the visualization (${vizId}).</p>
                            <p style="font-size: 0.9em; color: #6c757d;">${error.message}</p>
                        </div>
                    </div>
                `;
            }

            // Show error message
            if (VistaKine.loader && typeof VistaKine.loader.showErrorMessage === 'function') {
                VistaKine.loader.showErrorMessage(`Error in visualization ${vizId}: ${error.message}`);
            }
        }
    }

    /**
     * Add expand button to the visualization container
     */
    addExpandButton(container) {
        // Create expand button element
        const expandButton = document.createElement('button');
        expandButton.className = 'viz-expand-button';
        expandButton.innerHTML = '<i class="ph ph-arrows-out"></i>';
        expandButton.setAttribute('aria-label', 'Expand visualization');
        expandButton.setAttribute('title', 'Expand visualization');

        // Add click event listener for fullscreen toggle
        expandButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleFullscreen(container);
        });

        // Add button to container
        container.appendChild(expandButton);

        // Add grid toggle button
        this.addGridToggleButton(container);

        // Make sure container has position relative for proper button positioning
        if (window.getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }
    }

    /**
     * Add grid toggle button to the visualization container
     */
    addGridToggleButton(container) {
        // Create grid toggle button
        const gridToggle = document.createElement('button');
        gridToggle.className = 'viz-grid-toggle';
        gridToggle.innerHTML = '<i class="ph ph-grid-four"></i>';
        gridToggle.setAttribute('aria-label', 'Toggle grid visibility');
        gridToggle.setAttribute('title', 'Toggle grid visibility');

        // Get the visualization ID
        const vizId = container.getAttribute('data-threejs');

        // Track grid state in the container's data attributes
        container.dataset.gridVisible = 'true';

        // Add click event listener for grid toggle
        gridToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleGrid(container, vizId);
        });

        // Add button to container
        container.appendChild(gridToggle);
    }

    /**
     * Toggle grid visibility
     */
    toggleGrid(container, vizId) {
        // Get the scene data
        const sceneData = this.scenes.get(vizId);
        if (!sceneData) return;

        // Toggle grid visibility state
        const gridVisible = container.dataset.gridVisible === 'true';
        container.dataset.gridVisible = (!gridVisible).toString();

        // Update the button icon
        const gridToggle = container.querySelector('.viz-grid-toggle i');
        if (gridToggle) {
            if (gridVisible) {
                gridToggle.className = 'ph ph-grid-four-slash';
                gridToggle.parentElement.setAttribute('title', 'Show grid');
                gridToggle.parentElement.setAttribute('aria-label', 'Show grid');
            } else {
                gridToggle.className = 'ph ph-grid-four';
                gridToggle.parentElement.setAttribute('title', 'Hide grid');
                gridToggle.parentElement.setAttribute('aria-label', 'Hide grid');
            }
        }

        // Toggle grid visibility using direct reference if available
        if (sceneData.gridHelper) {
            sceneData.gridHelper.visible = !gridVisible;
        }
        // Fallback to searching for grid in scene children
        else if (sceneData.scene) {
            const grid = sceneData.scene.getObjectByName('grid');
            if (grid) {
                grid.visible = !gridVisible;
            } else {
                // Try to find any GridHelper instance if named grid isn't found
                sceneData.scene.children.forEach(child => {
                    if (child instanceof THREE.GridHelper) {
                        child.visible = !gridVisible;
                    }
                });
            }
        }
    }

    /**
     * Handle window resize events
     */
    handleResize() {
        // Resize all active scenes
        this.scenes.forEach((sceneData, id) => {
            const { renderer, camera, container } = sceneData;

            if (!renderer || !container) return;

            // Get container dimensions
            const width = container.clientWidth;
            const height = container.clientHeight;

            // Skip if dimensions are zero (container not visible)
            if (width === 0 || height === 0) return;

            // Update renderer size
            renderer.setSize(width, height);

            // Update camera aspect ratio
            if (camera && camera.aspect) {
                camera.aspect = width / height;
                camera.updateProjectionMatrix();
            }

            // Ensure canvas is properly positioned, especially in fullscreen mode
            if (renderer.domElement) {
                const canvas = renderer.domElement;

                // If in fullscreen mode, ensure canvas is absolutely positioned
                if (container.classList.contains('fullscreen')) {
                    canvas.style.position = 'absolute';
                    canvas.style.left = '0';
                    canvas.style.top = '0';
                    canvas.style.width = '100%';
                    canvas.style.height = '100%';
                } else {
                    // Reset positioning for normal mode
                    canvas.style.position = '';
                    canvas.style.left = '';
                    canvas.style.top = '';
                    canvas.style.width = '100%';
                    canvas.style.height = '100%';
                }
            }
        });
    }

    /**
     * Toggle fullscreen mode for a visualization container
     */
    toggleFullscreen(container) {
        // Get the scene data for this container
        const sceneId = container.getAttribute('data-threejs');
        const sceneData = this.scenes.get(sceneId);

        if (!sceneData) return;

        // Toggle fullscreen class
        container.classList.toggle('fullscreen');

        // Store current body overflow to restore later
        if (container.classList.contains('fullscreen')) {
            // Save current body overflow
            container.dataset.prevBodyOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden'; // Prevent scrolling while in fullscreen

            // Add a close button if it doesn't exist yet
            if (!container.querySelector('.viz-close-button')) {
                const closeButton = document.createElement('button');
                closeButton.className = 'viz-close-button';
                closeButton.innerHTML = '<i class="ph ph-x"></i>';
                closeButton.setAttribute('aria-label', 'Exit fullscreen');
                closeButton.setAttribute('title', 'Exit fullscreen');

                closeButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggleFullscreen(container);
                });

                container.appendChild(closeButton);
            }

            // Add escape key listener
            this.escKeyListener = (e) => {
                if (e.key === 'Escape') {
                    this.toggleFullscreen(container);
                }
            };
            document.addEventListener('keydown', this.escKeyListener);

            // Move to body to avoid layout issues
            if (container.parentNode !== document.body) {
                // Save original parent for restoration
                container.dataset.originalParent = container.parentNode.id || 'unknown';
                document.body.appendChild(container);
            }
        } else {
            // Restore body overflow
            document.body.style.overflow = container.dataset.prevBodyOverflow || '';

            // Remove escape key listener
            if (this.escKeyListener) {
                document.removeEventListener('keydown', this.escKeyListener);
                this.escKeyListener = null;
            }

            // Restore to original parent
            if (container.dataset.originalParent && container.dataset.originalParent !== 'unknown') {
                const originalParent = document.getElementById(container.dataset.originalParent);
                if (originalParent) {
                    // Find the section-text element that originally contained this
                    const originalContainer = originalParent.querySelector(`.section-content[data-src*="chapter1-intro.html"]`);
                    if (originalContainer) {
                        // Find the specific content-section that should contain this visualization
                        const contentSections = originalContainer.querySelectorAll('.content-section');
                        if (contentSections.length > 0) {
                            // Typically the first content section with a visualization container
                            for (const section of contentSections) {
                                if (section.querySelector('.visualization-container') === null) {
                                    section.querySelector('.section-text:nth-of-type(1)').after(container);
                                    break;
                                }
                            }
                        } else {
                            originalContainer.appendChild(container);
                        }
                    } else {
                        originalParent.appendChild(container);
                    }
                } else {
                    // Fallback if original parent not found
                    document.getElementById('book-content').appendChild(container);
                }
            }
        }

        // Delay resize to ensure transitions complete
        setTimeout(() => {
            // Force a specific resize for this container
            if (sceneData.renderer) {
                const width = container.clientWidth;
                const height = container.clientHeight;

                // Properly resize renderer
                sceneData.renderer.setSize(width, height);

                // Update camera aspect ratio
                if (sceneData.camera && sceneData.camera.aspect) {
                    sceneData.camera.aspect = width / height;
                    sceneData.camera.updateProjectionMatrix();
                }

                // Ensure canvas is properly positioned
                if (sceneData.renderer.domElement) {
                    const canvas = sceneData.renderer.domElement;
                    canvas.style.position = 'absolute';
                    canvas.style.left = '0';
                    canvas.style.top = '0';
                }
            }

            // Trigger a general resize
            this.handleResize();
        }, 100); // Small delay to ensure transition has started

        // Update button icon
        const expandButton = container.querySelector('.viz-expand-button i');
        if (expandButton) {
            if (container.classList.contains('fullscreen')) {
                expandButton.className = 'ph ph-arrows-in';
            } else {
                expandButton.className = 'ph ph-arrows-out';
            }
        }
    }

    /**
     * Create a basic coordinate system visualization
     */
    createCoordinateSystem(container, id) {
        try {
            // Check if Three.js is available
            if (typeof THREE === 'undefined') {
                console.error('Three.js is not loaded. Cannot create coordinate system.');
                if (VistaKine.loader && typeof VistaKine.loader.showErrorMessage === 'function') {
                    VistaKine.loader.showErrorMessage('Three.js library is missing. Please check your internet connection and reload the page.');
                }
                return;
            }

            // Create Three.js scene
            const scene = new THREE.Scene();
            scene.background = new THREE.Color(0xffffff); // White background

            // Set up camera
            const aspectRatio = container.clientWidth / container.clientHeight;
            const camera = new THREE.PerspectiveCamera(45, aspectRatio, 0.1, 1000);
            camera.position.set(5, 5, 5);
            camera.lookAt(0, 0, 0);

            // Set up renderer
            const renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(container.clientWidth, container.clientHeight);
            renderer.setPixelRatio(window.devicePixelRatio);

            // Ensure canvas is properly positioned
            const canvas = renderer.domElement;
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.display = 'block';

            // Add canvas to container
            container.appendChild(canvas);

            // Check if OrbitControls is available
            if (typeof THREE.OrbitControls === 'undefined') {
                console.error('THREE.OrbitControls is not loaded. Using static camera view.');
                // Create a fallback div to inform the user
                const fallbackElement = document.createElement('div');
                fallbackElement.style.position = 'absolute';
                fallbackElement.style.bottom = '10px';
                fallbackElement.style.left = '10px';
                fallbackElement.style.background = 'rgba(255,0,0,0.7)';
                fallbackElement.style.color = 'white';
                fallbackElement.style.padding = '5px 10px';
                fallbackElement.style.borderRadius = '5px';
                fallbackElement.textContent = 'Camera controls unavailable - reload page';
                container.appendChild(fallbackElement);

                // Continue with static camera
                var controls = null;
            } else {
                // Add orbit controls
                const controls = new THREE.OrbitControls(camera, renderer.domElement);
                controls.enableDamping = true;
                controls.dampingFactor = 0.05;
            }

            // Colors for axes
            const xAxisColor = 0xff0000; // Red
            const yAxisColor = 0x00ff00; // Green
            const zAxisColor = 0x0000ff; // Blue

            // Add colored axes
            const axisLength = 5;

            // X-axis (red)
            const xAxisGeometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(axisLength, 0, 0)
            ]);
            const xAxisMaterial = new THREE.LineBasicMaterial({ color: xAxisColor, linewidth: 2 });
            const xAxis = new THREE.Line(xAxisGeometry, xAxisMaterial);
            scene.add(xAxis);

            // Y-axis (green)
            const yAxisGeometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, axisLength, 0)
            ]);
            const yAxisMaterial = new THREE.LineBasicMaterial({ color: yAxisColor, linewidth: 2 });
            const yAxis = new THREE.Line(yAxisGeometry, yAxisMaterial);
            scene.add(yAxis);

            // Z-axis (blue)
            const zAxisGeometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, axisLength)
            ]);
            const zAxisMaterial = new THREE.LineBasicMaterial({ color: zAxisColor, linewidth: 2 });
            const zAxis = new THREE.Line(zAxisGeometry, zAxisMaterial);
            scene.add(zAxis);

            // Add axis labels
            this.addAxisLabel(scene, 'X', new THREE.Vector3(axisLength + 0.3, 0, 0), xAxisColor);
            this.addAxisLabel(scene, 'Y', new THREE.Vector3(0, axisLength + 0.3, 0), yAxisColor);
            this.addAxisLabel(scene, 'Z', new THREE.Vector3(0, 0, axisLength + 0.3), zAxisColor);

            // Add grid - store a reference to it for toggling
            const gridHelper = new THREE.GridHelper(10, 10, 0x888888, 0xcccccc);
            gridHelper.name = 'grid'; // Name it for easy finding
            scene.add(gridHelper);

            // Add a point at the origin (0,0,0)
            const originGeometry = new THREE.SphereGeometry(0.1, 16, 16);
            const originMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const originPoint = new THREE.Mesh(originGeometry, originMaterial);
            scene.add(originPoint);

            // Add a demo point at (2,3,1)
            const pointGeometry = new THREE.SphereGeometry(0.1, 16, 16);
            const pointMaterial = new THREE.MeshBasicMaterial({ color: 0xff9900 });
            const demoPoint = new THREE.Mesh(pointGeometry, pointMaterial);
            demoPoint.position.set(2, 3, 1);
            scene.add(demoPoint);

            // Add coordinate lines to the demo point
            this.addCoordinateLines(scene, demoPoint.position, xAxisColor, yAxisColor, zAxisColor);

            // Add point label
            this.addPointLabel(scene, '(2,3,1)', new THREE.Vector3(2, 3, 1), 0xff9900);

            // Add ambient light
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); // Brighter ambient light
            scene.add(ambientLight);

            // Add directional light
            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
            directionalLight.position.set(5, 10, 7.5);
            scene.add(directionalLight);

            // Animation function
            const animate = () => {
                requestAnimationFrame(animate);

                if (controls) controls.update();
                renderer.render(scene, camera);
            };

            // Start animation
            animate();

            // Store scene data for later reference
            this.scenes.set(id, {
                scene,
                camera,
                renderer,
                controls,
                container,
                gridHelper // Store reference to grid helper
            });

            console.log(`Coordinate system visualization created successfully for container '${id}'`);

        } catch (error) {
            console.error('Error creating coordinate system visualization:', error);

            // Show user-friendly error message
            if (VistaKine.loader && typeof VistaKine.loader.showErrorMessage === 'function') {
                VistaKine.loader.showErrorMessage('Error creating visualization: ' + error.message);
            }

            // Create a fallback visualization with an error message
            container.innerHTML = `
                <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
                      background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px;">
                    <div style="text-align: center; padding: 20px;">
                        <h3 style="color: #dc3545; margin-bottom: 10px;">Visualization Error</h3>
                        <p style="margin-bottom: 15px;">There was a problem loading the 3D visualization.</p>
                        <p style="font-size: 0.9em; color: #6c757d;">${error.message}</p>
                        <button onclick="location.reload()"
                                style="background: #007bff; color: white; border: none; padding: 8px 16px;
                                border-radius: 4px; cursor: pointer; margin-top: 15px;">
                            Reload Page
                        </button>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Add a text label for an axis
     */
    addAxisLabel(scene, text, position, color) {
        // Create canvas for the label
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 64;
        canvas.height = 64;

        // Draw text on canvas
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.font = 'bold 48px Arial';
        context.fillStyle = '#' + color.toString(16).padStart(6, '0');
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2, canvas.height / 2);

        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);

        // Create sprite material with the texture
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });

        // Create sprite and position it
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.copy(position);
        sprite.scale.set(0.5, 0.5, 1);

        // Add sprite to scene
        scene.add(sprite);
    }

    /**
     * Add a label for a point in 3D space
     */
    addPointLabel(scene, text, position, color) {
        // Create canvas for the label
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 128;
        canvas.height = 64;

        // Draw text on canvas
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.font = 'bold 24px Arial';
        context.fillStyle = '#' + color.toString(16).padStart(6, '0');
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2, canvas.height / 2);

        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);

        // Create sprite material with the texture
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });

        // Create sprite and position it
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.copy(position);
        sprite.position.y += 0.4; // Position label slightly above point
        sprite.scale.set(0.8, 0.4, 1);

        // Add sprite to scene
        scene.add(sprite);
    }

    /**
     * Add coordinate lines from origin to a point
     */
    addCoordinateLines(scene, position, xColor, yColor, zColor) {
        // X coordinate line
        const xLineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(position.x, 0, 0)
        ]);
        const xLineMaterial = new THREE.LineDashedMaterial({
            color: xColor,
            dashSize: 0.2,
            gapSize: 0.1,
            linewidth: 1
        });
        const xLine = new THREE.Line(xLineGeometry, xLineMaterial);
        xLine.computeLineDistances(); // Required for dashed lines
        scene.add(xLine);

        // Y coordinate line
        const yLineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(position.x, 0, 0),
            new THREE.Vector3(position.x, position.y, 0)
        ]);
        const yLineMaterial = new THREE.LineDashedMaterial({
            color: yColor,
            dashSize: 0.2,
            gapSize: 0.1,
            linewidth: 1
        });
        const yLine = new THREE.Line(yLineGeometry, yLineMaterial);
        yLine.computeLineDistances();
        scene.add(yLine);

        // Z coordinate line
        const zLineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(position.x, position.y, 0),
            new THREE.Vector3(position.x, position.y, position.z)
        ]);
        const zLineMaterial = new THREE.LineDashedMaterial({
            color: zColor,
            dashSize: 0.2,
            gapSize: 0.1,
            linewidth: 1
        });
        const zLine = new THREE.Line(zLineGeometry, zLineMaterial);
        zLine.computeLineDistances();
        scene.add(zLine);
    }

    /**
     * Create a default scene for unknown visualization types
     */
    createDefaultScene(container, id) {
        // Create a basic scene with a message
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf0f0f0);

        // Set up camera
        const aspectRatio = container.clientWidth / container.clientHeight;
        const camera = new THREE.PerspectiveCamera(45, aspectRatio, 0.1, 1000);
        camera.position.set(0, 0, 5);

        // Set up renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);

        // Ensure canvas is properly positioned
        const canvas = renderer.domElement;
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.display = 'block';

        // Add canvas to container
        container.appendChild(canvas);

        // Add text message about unknown visualization
        const message = document.createElement('div');
        message.className = 'viz-message';
        message.textContent = `Visualization '${id}' not implemented yet`;
        container.appendChild(message);

        // Start simple animation
        const animate = () => {
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
        };

        animate();

        // Store scene data
        this.scenes.set(id, {
            scene,
            camera,
            renderer,
            container
        });
    }
}

// Register with VistaKine core if available
if (typeof VistaKine.registerModule === 'function') {
    VistaKine.registerModule('visualization', VistaKine.visualization);
}

console.log('VistaKine visualization module loaded');