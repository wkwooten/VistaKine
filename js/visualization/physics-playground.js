/**
 * VistaKine Physics Playground
 *
 * This file implements a 3D physics playground using Rapier physics engine
 * and Three.js for visualization. It's designed to be loaded by the
 * visualization engine when a container with data-threejs="physics-playground"
 * is encountered.
 */

// Import dependencies - these will be handled by the visualization engine
// which already provides THREE globally
import RAPIER from '@dimforge/rapier3d-compat';

// Create the VistaKine namespace if it doesn't exist
if (!window.VistaKine) {
    window.VistaKine = {};
}

// Create the PhysicsPlayground implementation
VistaKine.PhysicsPlayground = class {
    constructor(container, visualizationEngine) {
        // Store references
        this.container = container;
        this.visualizationEngine = visualizationEngine;

        // Set defaults
        this.initialized = false;
        this.objects = [];
        this.animating = false;
        this.lastTime = 0;

        // Performance monitoring properties
        this.perfStats = {
            fps: 0,
            frameTime: 0,
            physicsTime: 0,
            drawCalls: 0,
            triangles: 0,
            activeBodies: 0,
            sleepingBodies: 0,
            collisions: 0,
            objectCount: 0,
            textureCount: 0,
            geometryCount: 0,
            memoryUsed: 0,
            memoryLimit: 0,
            lastPhysicsStart: 0
        };

        // Physics is always enabled
        this.physicsEnabled = true;

        // Initialize memory estimation
        this.initMemoryEstimation();
    }

    // Initialize the playground
    async init() {
        try {
            console.log('Initializing Physics Playground');

            // Initialize Three.js scene
            this.initScene();

            // Initialize Rapier physics engine (this also creates the physics world and boundaries)
            await this.initPhysics();

            // Create UI
            this.createUI();

            // Add event listeners
            this.setupEventListeners();

            // Start animation loop
            this.animate();

            // Add theme change listener
            document.addEventListener('vistakine:settingsUpdated', this.handleSettingsUpdate.bind(this));

            console.log('Physics Playground initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize Physics Playground:', error);
            this.showError(error);
            return false;
        }
    }

    // Initialize memory estimation function
    initMemoryEstimation() {
        // Add memory estimation function for browsers without performance.memory
        window.VistaKineMemoryEstimate = () => {
            // Default values
            let memoryInfo = {
                used: 0,
                limit: 2048 // Default estimate of 2GB limit
            };

            // If Chrome's performance.memory is available, use it
            if (window.performance && window.performance.memory) {
                memoryInfo.used = Math.round(window.performance.memory.usedJSHeapSize / (1024 * 1024));
                memoryInfo.limit = Math.round(window.performance.memory.jsHeapSizeLimit / (1024 * 1024));
                return memoryInfo;
            }

            // For Firefox and other browsers, use a rough estimation based on objects in the scene
            try {
                // Estimate based on objects count
                const objectCount = this.objects.length;
                // Rough estimate: each physics object is ~1MB of memory
                const objectMemory = objectCount * 1;

                // Base memory for the engine and scene
                const baseMemory = 50; // Rough estimate for engine, scene, renderer

                memoryInfo.used = baseMemory + objectMemory;
            } catch (e) {
                console.warn("Error estimating memory usage:", e);
            }

            return memoryInfo;
        };
    }

    // Initialize Three.js scene
    initScene() {
        // Create scene
        this.scene = new THREE.Scene();

        // Use CSS variable for background color to match theme
        this.computedStyle = getComputedStyle(document.documentElement);
        const bgColor = this.computedStyle.getPropertyValue('--bg-color').trim();
        this.scene.background = new THREE.Color(bgColor);

        // Create camera
        this.camera = new THREE.PerspectiveCamera(
            45, this.container.clientWidth / this.container.clientHeight, 0.1, 1000
        );
        this.camera.position.set(0, 10, 20);

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;

        // Add renderer to container
        this.container.appendChild(this.renderer.domElement);

        // Add controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        // Add transform controls
        this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
        this.transformControls.size = 0.75;
        this.transformControls.visible = false;
        this.transformControls.enabled = false;
        this.scene.add(this.transformControls);

        // Add basic lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.camera.left = -20;
        directionalLight.shadow.camera.right = 20;
        directionalLight.shadow.camera.top = 20;
        directionalLight.shadow.camera.bottom = -20;
        this.scene.add(directionalLight);

        // Add ground
        const groundGeometry = new THREE.BoxGeometry(40, 1, 40);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.8,
            metalness: 0.2
        });

        // Get theme colors from CSS variables
        const groundColor = this.computedStyle.getPropertyValue('--hover-bg').trim() || 'rgba(0, 0, 0, 0.04)';

        // Convert rgba to hex
        let groundColorHex = 0x333333; // Default fallback
        if (groundColor.startsWith('rgba')) {
            // Just use a light neutral color that will work with both themes
            groundColorHex = 0xf5f5f5;
        }

        groundMaterial.color = new THREE.Color(groundColorHex);
        this.groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
        this.groundMesh.position.set(0, -0.5, 0); // Center of the box is at y=-0.5
        this.groundMesh.receiveShadow = true;
        this.scene.add(this.groundMesh);

        // Ground level is at y=0 (top of the box)
        this.groundY = 0;

        // Add grid helper with blue color to match the site theme
        const blueColor = this.computedStyle.getPropertyValue('--chapter1-color').trim() || '#3b82f6';
        this.grid = new THREE.GridHelper(40, 40, new THREE.Color(blueColor), new THREE.Color(blueColor).multiplyScalar(0.5));
        this.grid.position.y = 0.01; // Slightly above ground to avoid z-fighting
        this.scene.add(this.grid);
    }

    // Create UI for the playground
    createUI() {
        // Use the container reference directly instead of trying to get it by ID
        const container = this.container;

        // Create UI container
        const uiContainer = document.createElement('div');
        uiContainer.className = 'physics-playground-ui';
        uiContainer.style.position = 'absolute';
        uiContainer.style.bottom = '10px';
        uiContainer.style.left = '10px';
        uiContainer.style.padding = '10px';
        uiContainer.style.borderRadius = '5px';
        uiContainer.style.fontFamily = 'var(--body-font, sans-serif)';
        uiContainer.style.fontSize = '14px';
        uiContainer.style.zIndex = '100';

        // Use theme colors for UI
        const bgColor = this.computedStyle.getPropertyValue('--bg-color').trim();
        const textColor = this.computedStyle.getPropertyValue('--text-color').trim();

        // Semi-transparent background
        uiContainer.style.backgroundColor = bgColor ? `${bgColor}e6` : 'rgba(255, 255, 255, 0.9)'; // e6 hex = 90% opacity
        uiContainer.style.color = textColor || '#333';
        uiContainer.style.boxShadow = 'var(--shadow-md)';

        container.appendChild(uiContainer);
        this.uiContainer = uiContainer;

        // Add title
        const title = document.createElement('h3');
        title.textContent = 'Physics Playground';
        title.style.margin = '0 0 10px 0';
        title.style.fontSize = '16px';
        uiContainer.appendChild(title);

        // Create button group
        const buttonGroup = document.createElement('div');
        buttonGroup.style.display = 'flex';
        buttonGroup.style.flexWrap = 'wrap';
        buttonGroup.style.gap = '5px';
        uiContainer.appendChild(buttonGroup);

        // Add buttons
        this.createButton(buttonGroup, 'Add Box', () => this.addBox());
        this.createButton(buttonGroup, 'Add Sphere', () => this.addSphere());
        this.createButton(buttonGroup, 'Add Cylinder', () => this.addCylinder());
        this.createButton(buttonGroup, 'Clear All', () => this.clearAllObjects());

        // Add stress test button
        this.createButton(buttonGroup, 'Run Stress Test', () => this.runStressTest());

        // Stats container
        const statsContainer = document.createElement('div');
        statsContainer.style.marginTop = '15px';
        statsContainer.style.fontSize = '12px';
        statsContainer.innerHTML = `
            <div>Objects: <span id="physics-object-count">0</span></div>
            <div>FPS: <span id="physics-fps">60</span></div>
        `;
        uiContainer.appendChild(statsContainer);
    }

    // Helper function to convert hex to RGB
    hexToRgb(hex) {
        // Remove # if present
        hex = hex.replace(/^#/, '');

        // Parse hex
        let bigint = parseInt(hex, 16);
        let r = (bigint >> 16) & 255;
        let g = (bigint >> 8) & 255;
        let b = bigint & 255;

        return { r, g, b };
    }

    // Helper to create a button
    createButton(parent, text, onClick) {
        const button = document.createElement('button');
        button.textContent = text;
        button.style.margin = '5px';
        button.style.padding = '8px 12px';
        button.style.border = 'none';
        button.style.borderRadius = '4px';
        button.style.cursor = 'pointer';
        button.style.fontFamily = 'inherit';

        // Use theme colors for buttons
        const primaryColor = this.computedStyle.getPropertyValue('--primary-color').trim() || '#1E88E5';
        const textOnDark = this.computedStyle.getPropertyValue('--text-on-dark').trim() || 'white';

        button.style.backgroundColor = primaryColor;
        button.style.color = textOnDark;
        button.style.transition = 'background-color 0.2s';

        button.addEventListener('mouseover', () => {
            const accentColorDark = this.computedStyle.getPropertyValue('--accent-color-dark').trim() || '#1565C0';
            button.style.backgroundColor = accentColorDark;
        });

        button.addEventListener('mouseout', () => {
            button.style.backgroundColor = primaryColor;
        });

        button.addEventListener('click', onClick);
        parent.appendChild(button);
        return button;
    }

    // Initialize Rapier physics
    async initPhysics() {
        // Initialize Rapier physics
        await RAPIER.init();
        this.RAPIER = RAPIER;

        // Create physics world with gravity
        const gravity = { x: 0.0, y: -9.81, z: 0.0 };
        this.world = new RAPIER.World(gravity);

        // Ground dimensions (matching the visual ground)
        const groundSize = 40;
        const halfGroundSize = groundSize / 2;
        const groundThickness = 1;

        // Create ground collider with material properties
        const groundColliderDesc = this.RAPIER.ColliderDesc.cuboid(halfGroundSize, groundThickness/2, halfGroundSize);

        // Set floor physics properties
        groundColliderDesc.setFriction(0.8);
        groundColliderDesc.setRestitution(0.2);

        // Create the ground collider
        this.groundCollider = this.world.createCollider(groundColliderDesc);

        // Position the ground collider at the same place as the visual ground
        this.groundCollider.setTranslation({
            x: 0.0,
            y: -0.5,
            z: 0.0
        });

        // Add boundary walls to keep objects from falling off the edge
        const wallHeight = 2.0;
        const wallThickness = 0.3;

        // Create walls - one for each side of the square ground
        const walls = [
            // North wall (+Z)
            {
                desc: this.RAPIER.ColliderDesc.cuboid(halfGroundSize, wallHeight/2, wallThickness/2),
                position: { x: 0, y: wallHeight/2, z: halfGroundSize + wallThickness/4 }
            },
            // South wall (-Z)
            {
                desc: this.RAPIER.ColliderDesc.cuboid(halfGroundSize, wallHeight/2, wallThickness/2),
                position: { x: 0, y: wallHeight/2, z: -halfGroundSize - wallThickness/4 }
            },
            // East wall (+X)
            {
                desc: this.RAPIER.ColliderDesc.cuboid(wallThickness/2, wallHeight/2, halfGroundSize),
                position: { x: halfGroundSize + wallThickness/4, y: wallHeight/2, z: 0 }
            },
            // West wall (-X)
            {
                desc: this.RAPIER.ColliderDesc.cuboid(wallThickness/2, wallHeight/2, halfGroundSize),
                position: { x: -halfGroundSize - wallThickness/4, y: wallHeight/2, z: 0 }
            }
        ];

        // Create the wall colliders
        this.wallColliders = [];
        walls.forEach(wall => {
            // Apply physics properties to walls
            wall.desc.setFriction(0.3);
            wall.desc.setRestitution(0.4);

            // Create collider
            const collider = this.world.createCollider(wall.desc);

            // Set position
            collider.setTranslation(wall.position);

            // Store reference
            this.wallColliders.push(collider);
        });

        // Create visual boundaries (semi-transparent)
        this.createVisualBoundaries(groundSize, wallHeight, wallThickness);
    }

    // Create visual boundaries to represent the physics walls
    createVisualBoundaries(groundSize, wallHeight, wallThickness) {
        const halfGroundSize = groundSize / 2;
        const wallMaterial = new THREE.MeshStandardMaterial({
            color: 0x3366ff,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide
        });

        // Store walls for potential cleanup later
        this.boundaryWalls = [];

        // Create four walls - one for each side of the square ground
        const walls = [
            // North wall (+Z)
            {
                geometry: new THREE.BoxGeometry(groundSize, wallHeight, wallThickness),
                position: new THREE.Vector3(0, wallHeight/2, halfGroundSize)
            },
            // South wall (-Z)
            {
                geometry: new THREE.BoxGeometry(groundSize, wallHeight, wallThickness),
                position: new THREE.Vector3(0, wallHeight/2, -halfGroundSize)
            },
            // East wall (+X)
            {
                geometry: new THREE.BoxGeometry(wallThickness, wallHeight, groundSize),
                position: new THREE.Vector3(halfGroundSize, wallHeight/2, 0)
            },
            // West wall (-X)
            {
                geometry: new THREE.BoxGeometry(wallThickness, wallHeight, groundSize),
                position: new THREE.Vector3(-halfGroundSize, wallHeight/2, 0)
            }
        ];

        // Create and add wall meshes
        walls.forEach(wall => {
            const mesh = new THREE.Mesh(wall.geometry, wallMaterial);
            mesh.position.copy(wall.position);
            mesh.receiveShadow = true;
            this.scene.add(mesh);
            this.boundaryWalls.push(mesh);
        });

        // Add ground outline to better visualize the boundaries
        const groundOutlineGeometry = new THREE.EdgesGeometry(
            new THREE.BoxGeometry(groundSize, 0.1, groundSize)
        );
        const blueColor = this.computedStyle.getPropertyValue('--chapter1-color').trim() || '#3b82f6';
        const groundOutlineMaterial = new THREE.LineBasicMaterial({ color: new THREE.Color(blueColor) });
        const groundOutline = new THREE.LineSegments(groundOutlineGeometry, groundOutlineMaterial);
        groundOutline.position.set(0, 0.01, 0); // Slightly above ground
        this.scene.add(groundOutline);
        this.boundaryWalls.push(groundOutline);
    }

    // Set up event listeners
    setupEvents() {
        // Set up resize handling
        window.addEventListener('resize', this.handleResize.bind(this));

        // Set up orbit controls events
        this.controls.addEventListener('change', () => {
            // Handle camera movement
        });

        // Setup mouse events
        this.mouse = new THREE.Vector2();
        this.raycaster = new THREE.Raycaster();

        this.container.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.container.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.container.addEventListener('mouseup', this.handleMouseUp.bind(this));
    }

    // Handle window resize
    handleResize() {
        // Update camera aspect ratio
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();

        // Update renderer size
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    // Handle mouse move
    handleMouseMove(event) {
        // Calculate mouse position relative to container
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / this.container.clientWidth) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / this.container.clientHeight) * 2 + 1;
    }

    // Handle mouse down
    handleMouseDown(event) {
        // Implement mouse down handling
    }

    // Handle mouse up
    handleMouseUp(event) {
        // Implement mouse up handling
    }

    // Add a box to the scene
    addBox() {
        const size = 1 + Math.random() * 0.5;
        const geometry = new THREE.BoxGeometry(size, size, size);
        const material = new THREE.MeshStandardMaterial({
            color: Math.random() * 0xffffff,
            roughness: 0.7,
            metalness: 0.2
        });

        // Make sure starting position is above the ground
        const y = 10 + Math.random() * 5;

        const cube = new THREE.Mesh(geometry, material);
        cube.position.set(
            (Math.random() - 0.5) * 10,
            y,
            (Math.random() - 0.5) * 10
        );
        cube.castShadow = true;
        cube.receiveShadow = true;
        this.scene.add(cube);

        // Create physics body with appropriate mass
        const density = 1.0;
        const volume = size * size * size;
        const mass = density * volume;

        // Add a slight rotation to prevent perfectly flat surfaces
        cube.rotation.x = Math.random() * 0.1;
        cube.rotation.z = Math.random() * 0.1;

        const bodyDesc = this.RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(cube.position.x, cube.position.y, cube.position.z)
            .setRotation({
                x: cube.quaternion.x,
                y: cube.quaternion.y,
                z: cube.quaternion.z,
                w: cube.quaternion.w
            })
            .setAdditionalMass(mass);

        const body = this.world.createRigidBody(bodyDesc);

        // Create collider with margin to prevent falling through surfaces
        const colliderSize = size * 1.02; // 2% margin
        const colliderDesc = this.RAPIER.ColliderDesc.cuboid(
            colliderSize/2, colliderSize/2, colliderSize/2
        )
            .setFriction(0.7)
            .setRestitution(0.3);

        this.world.createCollider(colliderDesc, body);

        // Store reference to the body and shape type
        cube.body = body;
        cube.shapeType = 'box';
        cube.physicsShape = { halfExtents: { x: size/2, y: size/2, z: size/2 } };

        // Apply a small initial impulse for better physics behavior
        const impulse = 0.1;
        body.applyImpulse(
            { x: (Math.random() - 0.5) * impulse, y: 0, z: (Math.random() - 0.5) * impulse },
            true
        );

        // Add to objects array
        this.objects.push(cube);

        // Update UI
        this.updateObjectCount();

        return cube;
    }

    // Add a sphere to the scene
    addSphere() {
        const radius = 0.5 + Math.random() * 0.5;
        const geometry = new THREE.SphereGeometry(radius, 32, 32);
        const material = new THREE.MeshStandardMaterial({
            color: Math.random() * 0xffffff,
            roughness: 0.7,
            metalness: 0.2
        });

        // Make sure starting position is above the ground
        const y = 10 + Math.random() * 5;

        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.set(
            (Math.random() - 0.5) * 10,
            y,
            (Math.random() - 0.5) * 10
        );
        sphere.castShadow = true;
        sphere.receiveShadow = true;
        this.scene.add(sphere);

        // Create physics body with appropriate mass
        const density = 1.0;
        const volume = (4/3) * Math.PI * radius * radius * radius;
        const mass = density * volume;

        const bodyDesc = this.RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(sphere.position.x, sphere.position.y, sphere.position.z)
            .setAdditionalMass(mass);

        const body = this.world.createRigidBody(bodyDesc);

        // Create collider with slightly larger radius
        const colliderRadius = radius * 1.05; // 5% margin
        const colliderDesc = this.RAPIER.ColliderDesc.ball(colliderRadius)
            .setFriction(0.5)
            .setRestitution(0.6);

        this.world.createCollider(colliderDesc, body);

        // Store reference to the body and shape type
        sphere.body = body;
        sphere.shapeType = 'sphere';
        sphere.physicsShape = { radius: radius };

        // Apply a small initial impulse for better physics behavior
        const impulse = 0.05;
        body.applyImpulse(
            { x: (Math.random() - 0.5) * impulse, y: 0, z: (Math.random() - 0.5) * impulse },
            true
        );

        // Add to objects array
        this.objects.push(sphere);

        // Update UI
        this.updateObjectCount();

        return sphere;
    }

    // Add a cylinder to the scene
    addCylinder() {
        const radius = 0.5 + Math.random() * 0.3;
        const height = 1 + Math.random() * 0.5;
        const geometry = new THREE.CylinderGeometry(radius, radius, height, 32);
        const material = new THREE.MeshStandardMaterial({
            color: Math.random() * 0xffffff,
            roughness: 0.7,
            metalness: 0.2
        });

        // Make sure starting position is above the ground
        const y = 10 + Math.random() * 5;

        const cylinder = new THREE.Mesh(geometry, material);
        cylinder.position.set(
            (Math.random() - 0.5) * 10,
            y,
            (Math.random() - 0.5) * 10
        );

        // Add a slight rotation to prevent perfect vertical alignment
        cylinder.rotation.x = Math.random() * 0.1;
        cylinder.rotation.z = Math.random() * 0.1;

        cylinder.castShadow = true;
        cylinder.receiveShadow = true;
        this.scene.add(cylinder);

        // Create physics body with appropriate mass
        const density = 0.8;
        const volume = Math.PI * radius * radius * height;
        const mass = density * volume;

        const bodyDesc = this.RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(cylinder.position.x, cylinder.position.y, cylinder.position.z)
            .setRotation({
                x: cylinder.quaternion.x,
                y: cylinder.quaternion.y,
                z: cylinder.quaternion.z,
                w: cylinder.quaternion.w
            })
            .setAdditionalMass(mass);

        const body = this.world.createRigidBody(bodyDesc);

        // Create collider with slight adjustments
        const colliderRadius = radius * 1.05; // 5% margin
        const colliderHeight = height * 1.02; // 2% margin
        const colliderDesc = this.RAPIER.ColliderDesc.cylinder(colliderHeight/2, colliderRadius)
            .setFriction(0.6)
            .setRestitution(0.4);

        this.world.createCollider(colliderDesc, body);

        // Store reference to the body and shape type
        cylinder.body = body;
        cylinder.shapeType = 'cylinder';
        cylinder.physicsShape = { radius: radius, height: height };

        // Apply a small initial impulse for better physics behavior
        const impulse = 0.05;
        body.applyImpulse(
            { x: (Math.random() - 0.5) * impulse, y: 0, z: (Math.random() - 0.5) * impulse },
            true
        );

        // Add to objects array
        this.objects.push(cylinder);

        // Update UI
        this.updateObjectCount();

        return cylinder;
    }

    // Update object count in UI
    updateObjectCount() {
        const objectCountElement = document.getElementById('physics-object-count');
        if (objectCountElement) {
            objectCountElement.textContent = this.objects.length;
        }
    }

    // Clear all objects
    clearAllObjects() {
        // Remove all objects except ground and boundaries
        while (this.objects.length > 0) {
            const object = this.objects.pop();

            // Remove from scene
            this.scene.remove(object);

            // Remove physics body
            if (object.body) {
                this.world.removeRigidBody(object.body);
            }
        }

        // Update object count
        this.updateObjectCount();
    }

    // Stress test
    runStressTest() {
        // Show a warning if there are already many objects
        if (this.objects.length > 30) {
            if (!confirm(`There are already ${this.objects.length} objects. Adding more may affect performance. Continue?`)) {
                return;
            }
        }

        const testSize = 30; // Number of objects to create
        const objectTypes = ['box', 'sphere', 'cylinder'];
        const startTime = performance.now();

        // Create a status message
        const statusMsg = document.createElement('div');
        statusMsg.style.position = 'absolute';
        statusMsg.style.top = '50%';
        statusMsg.style.left = '50%';
        statusMsg.style.transform = 'translate(-50%, -50%)';
        statusMsg.style.background = 'rgba(0,0,0,0.8)';
        statusMsg.style.color = 'white';
        statusMsg.style.padding = '15px';
        statusMsg.style.borderRadius = '5px';
        statusMsg.style.zIndex = '2000';
        statusMsg.textContent = `Creating ${testSize} objects...`;
        this.container.appendChild(statusMsg);

        // Create objects with a slight delay to avoid freezing the UI
        let count = 0;
        const createBatch = () => {
            for (let i = 0; i < 5 && count < testSize; i++, count++) {
                // Choose a random object type
                const typeIndex = Math.floor(Math.random() * objectTypes.length);
                const type = objectTypes[typeIndex];

                // Create object based on type
                switch (type) {
                    case 'box': this.addBox(); break;
                    case 'sphere': this.addSphere(); break;
                    case 'cylinder': this.addCylinder(); break;
                }
            }

            // Update status
            statusMsg.textContent = `Creating objects: ${count}/${testSize}`;

            // Continue if not done
            if (count < testSize) {
                setTimeout(createBatch, 10);
            } else {
                // Finished - remove status and show results
                this.container.removeChild(statusMsg);
                const duration = ((performance.now() - startTime) / 1000).toFixed(2);

                // Create result message
                const resultMsg = document.createElement('div');
                resultMsg.style.position = 'absolute';
                resultMsg.style.top = '50%';
                resultMsg.style.left = '50%';
                resultMsg.style.transform = 'translate(-50%, -50%)';
                resultMsg.style.background = 'rgba(0,0,0,0.8)';
                resultMsg.style.color = 'white';
                resultMsg.style.padding = '15px';
                resultMsg.style.borderRadius = '5px';
                resultMsg.style.zIndex = '2000';
                resultMsg.textContent = `Stress test completed!\nCreated ${testSize} objects in ${duration} seconds.\nTotal objects: ${this.objects.length}`;
                this.container.appendChild(resultMsg);

                // Remove result message after 5 seconds
                setTimeout(() => {
                    try {
                        this.container.removeChild(resultMsg);
                    } catch (e) {
                        // Element might have been removed already
                    }
                }, 5000);
            }
        };

        // Start creating objects
        createBatch();
    }

    // Start animation loop
    startAnimation() {
        this.animating = true;
        this.lastTime = performance.now();
        this.frameCount = 0;
        this.lastFpsUpdate = this.lastTime;

        // Start animation loop - call the animateFrame method directly
        // instead of going through the animate() alias which creates recursion
        requestAnimationFrame(this.animateFrame.bind(this));
    }

    // Animation loop - renamed from animate to animateFrame to avoid confusion
    animateFrame(time) {
        if (!this.animating) return;

        // Request next frame
        requestAnimationFrame(this.animateFrame.bind(this));

        // Calculate delta time
        const dt = Math.min((time - this.lastTime) / 1000, 0.1); // Max 0.1s (10 fps)
        this.lastTime = time;

        // Update FPS counter
        this.frameCount++;
        if (time - this.lastFpsUpdate > 1000) { // Update once per second
            const fps = Math.round(this.frameCount * 1000 / (time - this.lastFpsUpdate));
            const fpsElement = document.getElementById('physics-fps');
            if (fpsElement) {
                fpsElement.textContent = fps;
            }
            this.frameCount = 0;
            this.lastFpsUpdate = time;
        }

        // Update controls
        this.controls.update();

        // Update physics
        this.updatePhysics(dt);

        // Synchronize visual meshes with physics bodies
        this.synchronizeVisuals();

        // Render scene
        this.renderer.render(this.scene, this.camera);
    }

    // Update physics simulation
    updatePhysics(dt) {
        if (!this.physicsEnabled || !this.world) return;

        // Start timing physics update
        const physicsStartTime = performance.now();

        // Step the physics world
        const subSteps = 3; // Use 3 substeps for better accuracy
        for (let i = 0; i < subSteps; i++) {
            this.world.step();
        }

        // Calculate physics update time
        this.perfStats.physicsTime = performance.now() - physicsStartTime;
    }

    // Synchronize visual meshes with physics bodies
    synchronizeVisuals() {
        this.objects.forEach(object => {
            if (object.body) {
                // Get physics body position and rotation
                const translation = object.body.translation();
                const rotation = object.body.rotation();

                // Update visual mesh position and rotation
                object.position.set(translation.x, translation.y, translation.z);
                object.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
            }
        });
    }

    // Display error message
    showError(error) {
        console.error('Physics Playground Error:', error);

        // Create error message element
        const errorEl = document.createElement('div');
        errorEl.style.position = 'absolute';
        errorEl.style.top = '50%';
        errorEl.style.left = '50%';
        errorEl.style.transform = 'translate(-50%, -50%)';
        errorEl.style.backgroundColor = 'rgba(200, 0, 0, 0.8)';
        errorEl.style.color = 'white';
        errorEl.style.padding = '20px';
        errorEl.style.borderRadius = '5px';
        errorEl.style.maxWidth = '80%';
        errorEl.style.textAlign = 'center';
        errorEl.style.zIndex = '1000';

        errorEl.innerHTML = `
            <h3 style="margin-top:0">Physics Playground Error</h3>
            <p>${error.message || error}</p>
            <p>See console for details.</p>
        `;

        this.container.appendChild(errorEl);
    }

    // Clean up resources
    dispose() {
        console.log('Disposing Physics Playground');

        // Stop animation loop
        this.animating = false;

        // Remove event listeners
        window.removeEventListener('resize', this.handleResize);

        // Remove all objects
        this.clearAllObjects();

        // Remove UI elements
        const uiContainer = document.getElementById('physics-ui-container');
        if (uiContainer && uiContainer.parentNode) {
            uiContainer.parentNode.removeChild(uiContainer);
        }

        // Clean up THREE.js resources
        if (this.renderer) {
            this.renderer.dispose();
        }
    }

    // Toggle physics debug visualization
    togglePhysicsDebug(enabled) {
        this.physicsDebugEnabled = enabled === undefined ? !this.physicsDebugEnabled : enabled;

        if (this.physicsDebugEnabled) {
            this.showPhysicsDebug();
        } else {
            this.hidePhysicsDebug();
        }

        return this.physicsDebugEnabled;
    }

    // Update status message styling method
    showStatusMessage(message, duration = 2000) {
        const statusMsg = document.createElement('div');
        statusMsg.className = 'physics-status-message';
        statusMsg.textContent = message;
        statusMsg.style.position = 'absolute';
        statusMsg.style.top = '20px';
        statusMsg.style.left = '50%';
        statusMsg.style.transform = 'translateX(-50%)';
        statusMsg.style.padding = '10px 20px';
        statusMsg.style.borderRadius = '5px';
        statusMsg.style.fontSize = '16px';
        statusMsg.style.fontWeight = 'bold';
        statusMsg.style.zIndex = '2000';
        statusMsg.style.opacity = '0';
        statusMsg.style.transition = 'opacity 0.3s ease-in-out';

        // Use theme colors for status message
        const primaryColor = this.computedStyle.getPropertyValue('--primary-color').trim() || '#1E88E5';
        const textOnDark = this.computedStyle.getPropertyValue('--text-on-dark').trim() || 'white';

        statusMsg.style.backgroundColor = primaryColor;
        statusMsg.style.color = textOnDark;
        statusMsg.style.boxShadow = 'var(--shadow-md)';

        this.container.appendChild(statusMsg);

        // Fade in
        setTimeout(() => {
            statusMsg.style.opacity = '1';
        }, 10);

        // Fade out and remove after duration
        setTimeout(() => {
            statusMsg.style.opacity = '0';
            setTimeout(() => {
                if (statusMsg.parentNode) {
                    statusMsg.parentNode.removeChild(statusMsg);
                }
            }, 300);
        }, duration);
    }

    // Update result message styling
    showResultMessage(message, duration = 3000) {
        const resultMsg = document.createElement('div');
        resultMsg.className = 'physics-result-message';
        resultMsg.innerHTML = message;
        resultMsg.style.position = 'absolute';
        resultMsg.style.top = '50%';
        resultMsg.style.left = '50%';
        resultMsg.style.transform = 'translate(-50%, -50%)';
        resultMsg.style.padding = '20px 30px';
        resultMsg.style.borderRadius = '8px';
        resultMsg.style.fontSize = '18px';
        resultMsg.style.fontWeight = 'bold';
        resultMsg.style.textAlign = 'center';
        resultMsg.style.zIndex = '2000';
        resultMsg.style.opacity = '0';
        resultMsg.style.transition = 'opacity 0.5s ease-in-out';

        // Use theme colors for result message
        const bgColor = this.computedStyle.getPropertyValue('--bg-color').trim() || '#ffffff';
        const textColor = this.computedStyle.getPropertyValue('--text-color').trim() || '#333333';
        const borderColor = this.computedStyle.getPropertyValue('--primary-color').trim() || '#1E88E5';

        resultMsg.style.backgroundColor = bgColor;
        resultMsg.style.color = textColor;
        resultMsg.style.border = `2px solid ${borderColor}`;
        resultMsg.style.boxShadow = 'var(--shadow-lg)';

        this.container.appendChild(resultMsg);

        // Fade in
        setTimeout(() => {
            resultMsg.style.opacity = '1';
        }, 10);

        // Fade out and remove after duration
        setTimeout(() => {
            resultMsg.style.opacity = '0';
            setTimeout(() => {
                if (resultMsg.parentNode) {
                    resultMsg.parentNode.removeChild(resultMsg);
                }
            }, 500);
        }, duration);
    }

    // Handle settings updates
    handleSettingsUpdate(event) {
        if (event.detail && event.detail.settings) {
            // Refresh computed style to get new theme values
            this.computedStyle = getComputedStyle(document.documentElement);
            this.updateTheme();
        }
    }

    // Update theme colors when theme changes
    updateTheme() {
        // Update background color
        const bgColor = this.computedStyle.getPropertyValue('--bg-color').trim();
        this.scene.background = new THREE.Color(bgColor);

        // Update grid color
        const blueColor = this.computedStyle.getPropertyValue('--chapter1-color').trim() || '#3b82f6';
        if (this.grid) {
            this.scene.remove(this.grid);
        }
        this.grid = new THREE.GridHelper(40, 40, new THREE.Color(blueColor), new THREE.Color(blueColor).multiplyScalar(0.5));
        this.grid.position.y = 0.01;
        this.scene.add(this.grid);

        // Update UI elements if they exist
        if (this.uiContainer) {
            const textColor = this.computedStyle.getPropertyValue('--text-color').trim();
            this.uiContainer.style.backgroundColor = bgColor ? `${bgColor}e6` : 'rgba(255, 255, 255, 0.9)';
            this.uiContainer.style.color = textColor || '#333';
        }

        // Update ground outline
        if (this.boundaryWalls && this.boundaryWalls.length > 0) {
            const groundOutline = this.boundaryWalls[this.boundaryWalls.length - 1];
            if (groundOutline && groundOutline.material) {
                groundOutline.material.color = new THREE.Color(blueColor);
            }
        }
    }

    // Alias methods for compatibility with both name sets
    setupEventListeners() {
        this.setupEvents();
    }

    animate() {
        // Just start the animation without creating a loop
        this.startAnimation();
    }
};

// Export the class
export default VistaKine.PhysicsPlayground;