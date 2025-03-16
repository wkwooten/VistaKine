/**
 * Experimental Polyhedron for Interactive Playground
 *
 * This script creates an interactive 3D polyhedron that users can drag and throw
 * in a physics-based environment. It uses Three.js for rendering and Cannon.js for physics.
 *
 * The polyhedron responds to user interaction, changes color based on system color scheme,
 * and provides visual feedback for hover and drag states.
 *
 * This version is specifically designed for the experiments page with enhanced controls
 * and interactive features.
 *
 * @author Wooten
 * @version 2.0
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// Helper function for centralized debug logging
function debugLog(instance, message) {
  if (instance && instance.debug) {
    console.log(`[Polyhedron ${instance.color ? '0x' + instance.color.toString(16) : 'unknown'}]: ${message}`);
  }
}

class InteractivePolyhedron {
  constructor(container, options = {}) {
    // Store debug flag
    this.debug = false;

    // Performance monitoring - simplified
    this.performanceStats = {
      frameTime: 1,
      physicsTime: 1,
      renderTime: 1,
      lastFpsUpdate: 1,
      frameCount: 1,
      fps: 1
    };

    // Store container reference
    this.container = container;

    // Check if container exists
    if (!container) {
      console.error('Container #grid-canvas not found');
      return;
    }

    // Get container dimensions
    this.width = container.clientWidth;
    this.height = container.clientHeight;

    // Set up delay before animation starts
    this.startDelay = 0; // No delay for experimental version
    this.startTime = performance.now() + this.startDelay;
    this.isActive = false;

    // Grab smoothness factor (0-1): higher = faster, lower = smoother
    this.grabSmoothness = 0.2;

    // Initialize Three.js scene
    this.scene = new THREE.Scene();

    // Initialize camera with adjusted position and angle
    this.camera = new THREE.PerspectiveCamera(
      60, // Narrower field of view for better control (was 65)
      this.width / this.height, // Aspect ratio
      0.1, // Near clipping plane
      1000 // Far clipping plane
    );
    this.camera.position.z = 6; // Move camera back (was 5)
    this.camera.position.y = 3; // Raise camera higher (was 2)
    this.camera.lookAt(0, -1, 0); // Look down toward the floor

    // Initialize renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    // Initialize physics world with optimized settings
    this.world = new CANNON.World();
    this.world.gravity.set(0, -0.5, 0); // Moderate gravity for natural falling
    this.world.broadphase = new CANNON.NaiveBroadphase(); // Using NaiveBroadphase which is available in all versions
    this.world.solver.iterations = 5; // Reduced from 8 to compensate for more complex physics
    this.world.allowSleep = true; // Allow bodies to sleep when they come to rest
    this.world.sleepSpeedLimit = 0.05; // Lower threshold to allow bodies to sleep sooner
    this.world.sleepTimeLimit = 0.5; // Shorter time before sleeping

    // Initialize raycaster for mouse interaction
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Initialize interaction state
    this.isDragging = false;
    this.isHovering = false;
    this.isMovingFast = true; // Start in fast movement state for smooth initial animation
    this.previousMousePosition = { x: 0, y: 0 };
    this.mouseVelocity = { x: 0, y: 0 };
    this.lastMouseMoveTime = 0;
    this.boundaryMeshes = [];

    // Initialize clock for animation
    this.clock = new THREE.Clock();

    // Add event listeners
    window.addEventListener('resize', this.onWindowResize.bind(this));
    container.addEventListener('mousedown', this.onMouseDown.bind(this));
    window.addEventListener('mousemove', this.onMouseMove.bind(this));
    window.addEventListener('mouseup', this.onMouseUp.bind(this));

    // Use passive: true by default for touch events, but allow preventDefault() when needed
    container.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    window.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    window.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: true });

    // Add color scheme change listener
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', this.updatePolyhedronColor.bind(this));

    // Setup scene
    this.addLights();
    this.createPolyhedron();
    this.addBoundaries();

    // Start animation loop
    this.animate();
  }

  addLights() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    // Directional light (sun-like)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    this.scene.add(directionalLight);

    // Point light (for highlights)
    const pointLight = new THREE.PointLight(0x0088ff, 1, 100);
    pointLight.position.set(0, 0, 5);
    this.scene.add(pointLight);

    // Add a second colored point light for more visual interest
    const pointLight2 = new THREE.PointLight(0xff3366, 0.8, 100);
    pointLight2.position.set(-5, 3, -5);
    this.scene.add(pointLight2);
  }

  createPolyhedron() {
    // Create Three.js geometry
    const radius = 1 * this.size;
    const detail = 0;
    const geometry = new THREE.IcosahedronGeometry(radius, detail);

    // Create material
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide
    });

    // Ensure we have a valid color before creating edges
    if (!this.color) {
      const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.updateColorFromScheme(isDarkMode);
      console.log(`Set initial color to 0x${this.color.toString(16)}`);
    }

    // Create edges with the correct color
    const edgesGeometry = new THREE.EdgesGeometry(geometry);
    const edgesMaterial = new THREE.LineBasicMaterial({
      color: this.color,
      linewidth: 2,
      transparent: true,
      opacity: 0
    });

    console.log(`Creating polyhedron edges with color: 0x${this.color.toString(16)}`);

    const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);

    // Create mesh
    this.polyhedron = new THREE.Mesh(geometry, material);
    this.polyhedron.add(edges);
    this.polyhedron.scale.set(1.2, 1.2, 1.2);
    this.polyhedron.visible = false;
    this.polyhedron.userData.instance = this; // Store reference to this instance
    this.scene.add(this.polyhedron);

    // Create physics body
    const shape = new CANNON.Sphere(radius * 1.2);
    this.polyhedronBody = new CANNON.Body({
      mass: 5,
      shape: shape,
      position: new CANNON.Vec3(this.initialPosition.x, this.initialPosition.y, this.initialPosition.z),
      material: new CANNON.Material({
        friction: 0.3,
        restitution: 0.8
      }),
      linearDamping: 0.05,
      angularDamping: 0.05,
      allowSleep: true,
      collisionFilterGroup: 1, // Enable collisions with other polyhedra
      collisionFilterMask: 1 // Collide with other polyhedra
    });

    // Initially set the body to sleep until the delay is over
    this.polyhedronBody.sleep();
    this.world.addBody(this.polyhedronBody);
  }

  createPolyhedronShape(geometry, radius) {
    // Extract vertices from the geometry
    const vertices = [];
    const positions = geometry.attributes.position.array;

    for (let i = 0; i < positions.length; i += 3) {
      vertices.push(new CANNON.Vec3(
        positions[i],
        positions[i + 1],
        positions[i + 2]
      ));
    }

    // Extract faces from the geometry
    const faces = [];
    for (let i = 0; i < positions.length; i += 9) {
      faces.push([i/3, i/3 + 1, i/3 + 2]);
    }

    // Create a convex polyhedron shape
    return new CANNON.ConvexPolyhedron({
      vertices: vertices,
      faces: faces
    });
  }

  addBoundaries() {
    // Create boundary material
    const wallMaterial = new CANNON.Material({
      friction: 0.1,
      restitution: 0.8
    });

    // Create boundary size
    const boundarySize = 10; // Reset to original size
    const boundaryDepth = 0.5;

    // Create all boundaries
    const boundaries = [
      // Floor - raised to be more visible in the camera view
      {
        shape: new CANNON.Box(new CANNON.Vec3(boundarySize, boundaryDepth, boundarySize)),
        position: new CANNON.Vec3(0, -2, 0), // Raised from -3 to -2
        dimensions: [boundarySize * 2, boundaryDepth * 2, boundarySize * 2],
        isFloor: true // Mark this as the floor for special visualization
      },
      // Ceiling
      {
        shape: new CANNON.Box(new CANNON.Vec3(boundarySize, boundaryDepth, boundarySize)),
        position: new CANNON.Vec3(0, 20, 0),
        dimensions: [boundarySize * 2, boundaryDepth * 2, boundarySize * 2]
      },
      // Left wall
      {
        shape: new CANNON.Box(new CANNON.Vec3(boundaryDepth, boundarySize, boundarySize)),
        position: new CANNON.Vec3(-5, 0, 0),
        dimensions: [boundaryDepth * 2, boundarySize * 2, boundarySize * 2]
      },
      // Right wall
      {
        shape: new CANNON.Box(new CANNON.Vec3(boundaryDepth, boundarySize, boundarySize)),
        position: new CANNON.Vec3(5, 0, 0),
        dimensions: [boundaryDepth * 2, boundarySize * 2, boundarySize * 2]
      },
      // Back wall
      {
        shape: new CANNON.Box(new CANNON.Vec3(boundarySize, boundarySize, boundaryDepth)),
        position: new CANNON.Vec3(0, 0, -5),
        dimensions: [boundarySize * 2, boundarySize * 2, boundaryDepth * 2]
      },
      // Front wall - moved closer to camera
      {
        shape: new CANNON.Box(new CANNON.Vec3(boundarySize, boundarySize, boundaryDepth)),
        position: new CANNON.Vec3(0, 0, 4), // Moved from 5 to 4 to be in front of camera
        dimensions: [boundarySize * 2, boundarySize * 2, boundaryDepth * 2]
      }
    ];

    const boundaryMeshes = [];

    // Create all boundary bodies and meshes
    boundaries.forEach(boundary => {
      const body = new CANNON.Body({
        mass: 0,
        shape: boundary.shape,
        position: boundary.position,
        material: wallMaterial
      });
      this.world.addBody(body);

      // Only create visualization in debug mode
      if (this.debug || boundary.isFloor) {
        const geometry = new THREE.BoxGeometry(
          boundary.dimensions[0],
          boundary.dimensions[1],
          boundary.dimensions[2]
        );

        // Use a different material for the floor to make it more visible
        const material = boundary.isFloor ?
          new THREE.MeshBasicMaterial({
            color: window.matchMedia('(prefers-color-scheme: dark)').matches ? 0x333333 : 0xeeeeee,
            transparent: true,
            opacity: 0.5,
            wireframe: true
          }) :
          new THREE.MeshBasicMaterial({
            color: 0x444444,
            wireframe: true,
            transparent: true,
            opacity: 0.08,
            wireframeLinewidth: 1
          });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(body.position);
        mesh.quaternion.copy(body.quaternion);
        this.scene.add(mesh);
        boundaryMeshes.push({ mesh, body });
      } else {
        boundaryMeshes.push({ mesh: null, body });
      }
    });

    this.boundaryMeshes = boundaryMeshes;
  }

  onWindowResize() {
    if (!this.container || !this.camera || !this.renderer) return;

    // Update camera aspect ratio
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();

    // Update renderer size
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    debugLog(this, `Window resized: ${this.container.clientWidth}x${this.container.clientHeight}`);
  }

  // Consolidated method to handle both mouse and touch input coordinates
  getInputCoordinates(event, isTouch = false) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (isTouch && event.touches.length > 0) {
      return {
        x: ((event.touches[0].clientX - rect.left) / rect.width) * 2 - 1,
        y: -((event.touches[0].clientY - rect.top) / rect.height) * 2 + 1,
        clientX: event.touches[0].clientX,
        clientY: event.touches[0].clientY
      };
    } else {
      return {
        x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
        clientX: event.clientX,
        clientY: event.clientY
      };
    }
  }

  // Consolidated method to start dragging (used by both mouse and touch)
  startDragging(coords, clientX, clientY) {
    // Safety check - if polyhedron doesn't exist yet, return
    if (!this.polyhedron) {
      return false;
    }

    // Check if we clicked/touched on the polyhedron
    this.mouse.x = coords.x;
    this.mouse.y = coords.y;
    const isIntersecting = this.checkPolyhedronIntersection(this.mouse);

    if (isIntersecting) {
      // Start dragging
      this.isDragging = true;
      this.isHovering = true;

      // Update cursor style for mouse
      document.body.style.cursor = 'grabbing';

      // Initialize dragPositions for throw calculation
      this.dragPositions = [{
        time: performance.now(),
        x: clientX,
        y: clientY
      }];

      // Wake up the physics body
      this.polyhedronBody.wakeUp();

      // Store the current gravity for later restoration
      this.savedGravity = new CANNON.Vec3().copy(this.world.gravity);

      // Disable gravity while dragging
      this.world.gravity.set(0, 0, 0);

      // Set the body type to kinematic to prevent other forces from affecting it
      this.polyhedronBody.type = CANNON.BODY_TYPES.KINEMATIC;

      // Store the current angular velocity for preservation
      this.savedAngularVelocity = new CANNON.Vec3().copy(this.polyhedronBody.angularVelocity);

      // Dampen the angular velocity to 70% of its original value
      // This preserves some of the spinning motion but makes it more controlled
      this.polyhedronBody.angularVelocity.scale(0.7);

      // Zero out linear velocity for precise positioning
      this.polyhedronBody.velocity.set(0, 0, 0);

      // Zero out forces and torques
      this.polyhedronBody.force.set(0, 0, 0);
      this.polyhedronBody.torque.set(0, 0, 0);

      // Initialize the target position for smooth transition
      // Create a ray from the camera through the mouse position
      this.raycaster.setFromCamera(this.mouse, this.camera);

      // Calculate the initial target position
      const distance = 4; // Distance from camera
      this.targetPosition = new THREE.Vector3();
      this.targetPosition.copy(this.raycaster.ray.direction);
      this.targetPosition.multiplyScalar(distance);
      this.targetPosition.add(this.camera.position);

      // Snap the polyhedron to the cursor with smooth transition
      this.snapPolyhedronToCursor(this.mouse);

      debugLog(this, 'Dragging started, gravity disabled, motion partially preserved');
      return true;
    }
    return false;
  }

  // Consolidated method to update dragging (used by both mouse and touch)
  updateDragging(coords, clientX, clientY) {
    if (!this.isDragging) return;

    // Update mouse position
    this.mouse.x = coords.x;
    this.mouse.y = coords.y;

    // Snap polyhedron to cursor position
    this.snapPolyhedronToCursor(this.mouse);

    // Store position for velocity calculation
    const currentTime = performance.now();

    if (!this.dragPositions) {
      this.dragPositions = [];
    }

    this.dragPositions.push({
      time: currentTime,
      x: clientX,
      y: clientY
    });

    // Keep only the last 5 positions for velocity calculation
    if (this.dragPositions.length > 5) {
      this.dragPositions.shift();
    }

    // Calculate mouse velocity for throw physics
    if (this.previousMousePosition) {
      const deltaTime = currentTime - this.lastMouseMoveTime;

      if (deltaTime > 0) {
        this.mouseVelocity.x = (coords.x - this.previousMousePosition.x) / deltaTime * 1000;
        this.mouseVelocity.y = (coords.y - this.previousMousePosition.y) / deltaTime * 1000;
      }

      this.previousMousePosition.x = coords.x;
      this.previousMousePosition.y = coords.y;
      this.lastMouseMoveTime = currentTime;
    }
  }

  // Consolidated method to end dragging (used by both mouse and touch)
  endDragging() {
    if (!this.isDragging) return;

    this.isDragging = false;

    // Reset cursor based on hover state
    document.body.style.cursor = this.isHovering ? 'grab' : 'auto';

    // Calculate throw velocity based on recent movement
    let throwVelocity = this.calculateThrowVelocity();

    // Resume physics with a throw
    this.polyhedronBody.type = CANNON.BODY_TYPES.DYNAMIC;
    this.polyhedronBody.velocity.copy(throwVelocity);

    // Restore the original gravity
    if (this.savedGravity) {
      this.world.gravity.copy(this.savedGravity);
    } else {
      // Default gravity if saved gravity doesn't exist
      this.world.gravity.set(0, -0.5, 0);
    }

    // Add some random spin for visual interest
    // Blend the saved angular velocity with a new random component
    if (this.savedAngularVelocity) {
      // Create a new random angular velocity component
      const randomAngVel = new CANNON.Vec3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      );

      // Blend 50% of the saved angular velocity with 50% of the new random component
      this.polyhedronBody.angularVelocity.set(
        this.savedAngularVelocity.x * 0.5 + randomAngVel.x * 0.5,
        this.savedAngularVelocity.y * 0.5 + randomAngVel.y * 0.5,
        this.savedAngularVelocity.z * 0.5 + randomAngVel.z * 0.5
      );
    } else {
      // Fallback to just random if no saved angular velocity
      this.polyhedronBody.angularVelocity.set(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      );
    }

    debugLog(this, 'Dragging ended, gravity restored');
  }

  // Update the mouse event handlers to use the consolidated methods
  onMouseDown(event) {
    const coords = this.getInputCoordinates(event);
    this.startDragging(coords, event.clientX, event.clientY);
  }

  onMouseMove(event) {
    const coords = this.getInputCoordinates(event);

    if (this.isDragging) {
      this.updateDragging(coords, event.clientX, event.clientY);
    } else {
      // If not dragging, check if we're hovering over the polyhedron
      this.mouse.x = coords.x;
      this.mouse.y = coords.y;
      const isIntersecting = this.checkPolyhedronIntersection(this.mouse);

      // Only update if the hover state has changed
      if (isIntersecting !== this.isHovering) {
        this.isHovering = isIntersecting;
        this.highlightPolyhedron(isIntersecting);

        // Update cursor style
        document.body.style.cursor = isIntersecting ? 'grab' : 'auto';
      }
    }
  }

  onMouseUp() {
    this.endDragging();
  }

  // Update the touch event handlers to use the consolidated methods
  onTouchStart(event) {
    const coords = this.getInputCoordinates(event, true);

    // Only prevent default if we're interacting with the polyhedron
    if (this.startDragging(coords, coords.clientX, coords.clientY)) {
      event.preventDefault();
      debugLog(this, 'Touch dragging started');
    }
    // If not touching the polyhedron, allow default behavior (scrolling)
  }

  onTouchMove(event) {
    // Only prevent default and handle the event if we're dragging the polyhedron
    if (this.isDragging) {
      event.preventDefault();
      const coords = this.getInputCoordinates(event, true);
      this.updateDragging(coords, coords.clientX, coords.clientY);
    }
    // If not dragging, allow default behavior (scrolling)
  }

  onTouchEnd() {
    this.endDragging();
  }

  // Remove the now-redundant methods
  getMouseCoordinates(event) {
    return this.getInputCoordinates(event);
  }

  getTouchCoordinates(event) {
    return this.getInputCoordinates(event, true);
  }

  checkPolyhedronIntersection(mousePosition) {
    // Safety check - if polyhedron doesn't exist yet, return false
    if (!this.polyhedron) {
      if (this.debug) console.log('Cannot check intersection: polyhedron not initialized');
      return false;
    }

    // Set the raycaster to use the mouse position
    this.raycaster.setFromCamera(mousePosition, this.camera);

    // Check for intersections with the polyhedron
    const intersects = this.raycaster.intersectObject(this.polyhedron, true);

    // Return true if there are any intersections
    return intersects.length > 0;
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));

    const startTime = performance.now();

    // Check if polyhedron exists
    if (!this.polyhedron || !this.polyhedronBody) {
      console.error('Polyhedron or physics body missing in animation loop');
      return;
    }

    // Make sure clock is initialized
    if (!this.clock) {
      this.clock = new THREE.Clock();
      debugLog(this, 'Initializing clock in animation loop');
    }

    // Check if we should activate the polyhedron
    const currentTime = performance.now();
    if (!this.isActive && currentTime > this.startTime) {
      this.activatePolyhedron();
      this.isActive = true;
    }

    // Handle fade-in animation if the polyhedron is visible but not fully opaque
    this.handleFadeInAnimation();

    // Update physics - measure time
    const physicsStartTime = performance.now();
    const deltaTime = this.clock.getDelta();

    // Run physics every frame but with optimized settings
    if (this.isActive) {
      this.updatePhysics(deltaTime);

      // Update mesh position and rotation from physics body
      this.polyhedron.position.copy(this.polyhedronBody.position);
      this.polyhedron.quaternion.copy(this.polyhedronBody.quaternion);

      // Check if polyhedron is out of bounds and reset if needed
      this.checkBounds();

      // Apply a subtle force to keep the polyhedron away from the exact center when not being interacted with
      if (!this.isDragging) {
        this.applySubtleForce();
      }
    }

    this.performanceStats.physicsTime = performance.now() - physicsStartTime;

    // Render scene - measure time
    const renderStartTime = performance.now();
    this.renderer.render(this.scene, this.camera);
    this.performanceStats.renderTime = performance.now() - renderStartTime;

    // Update performance stats only when debug is enabled
    if (this.debug) {
      this.updatePerformanceStats(currentTime, startTime);
    }
  }

  // New method to handle fade-in animation
  handleFadeInAnimation() {
    if (this.polyhedron.visible &&
        this.polyhedron.material &&
        this.polyhedron.material.opacity < 1.0) {

      // Gradually increase opacity
      this.polyhedron.material.opacity += 0.02;

      // Also increase edge opacity
      if (this.polyhedron.children.length > 0 &&
          this.polyhedron.children[0].material) {
        this.polyhedron.children[0].material.opacity += 0.02;
      }

      // Ensure we don't exceed 1.0 opacity
      if (this.polyhedron.material.opacity >= 1.0) {
        this.polyhedron.material.opacity = 1.0;
        this.polyhedron.material.transparent = false;

        if (this.polyhedron.children.length > 0 &&
            this.polyhedron.children[0].material) {
          this.polyhedron.children[0].material.opacity = 1.0;
          this.polyhedron.children[0].material.transparent = false;
        }
      }

      // Mark materials for update
      this.polyhedron.material.needsUpdate = true;
      if (this.polyhedron.children.length > 0 &&
          this.polyhedron.children[0].material) {
        this.polyhedron.children[0].material.needsUpdate = true;
      }
    }
  }

  // New method to update physics
  updatePhysics(deltaTime) {
    // Check if the polyhedron is nearly at rest and can be put to sleep
    const isAlmostSleeping =
      this.polyhedronBody.velocity.lengthSquared() < 0.05 &&
      this.polyhedronBody.angularVelocity.lengthSquared() < 0.05;

    if (isAlmostSleeping && !this.isDragging) {
      // Reduce physics iterations for objects nearly at rest
      this.world.solver.iterations = 5;
    } else {
      // Use more iterations for active objects
      this.world.solver.iterations = 8;
    }

    // Step the physics world with optimized parameters
    this.world.step(1/60, deltaTime, this.world.solver.iterations);

    // Limit angular velocity
    this.limitAngularVelocity();

    // Update boundary visualizations if they exist - only if they've moved
    if (this.boundaryMeshes && this.physicsFrameCount % 5 === 0) {
      this.boundaryMeshes.forEach(item => {
        // Only update if the mesh exists and the body is not sleeping
        if (item.mesh && item.body.sleepState !== CANNON.Body.SLEEPING) {
          item.mesh.position.copy(item.body.position);
          item.mesh.quaternion.copy(item.body.quaternion);
        }
      });
    }

    // Increment physics frame counter
    this.physicsFrameCount = (this.physicsFrameCount || 0) + 1;
  }

  // New method to update performance stats
  updatePerformanceStats(currentTime, startTime) {
    this.performanceStats.frameTime = performance.now() - startTime;
    this.performanceStats.frameCount++;

    if (currentTime - this.performanceStats.lastFpsUpdate > 1000) {
      this.performanceStats.fps = Math.round(
        (this.performanceStats.frameCount * 1000) /
        (currentTime - this.performanceStats.lastFpsUpdate)
      );
      this.performanceStats.frameCount = 0;
      this.performanceStats.lastFpsUpdate = currentTime;

      debugLog(this, `Performance: ${this.performanceStats.fps} FPS, Frame: ${this.performanceStats.frameTime.toFixed(2)}ms, Physics: ${this.performanceStats.physicsTime.toFixed(2)}ms, Render: ${this.performanceStats.renderTime.toFixed(2)}ms`);
    }
  }

  // New method to limit angular velocity
  limitAngularVelocity() {
    const maxAngularSpeed = 3; // Maximum angular speed in radians per second
    const angVel = this.polyhedronBody.angularVelocity;

    // Calculate current angular speed (magnitude of angular velocity)
    const currentSpeed = Math.sqrt(
      angVel.x * angVel.x +
      angVel.y * angVel.y +
      angVel.z * angVel.z
    );

    // If speed exceeds maximum, scale it down
    if (currentSpeed > maxAngularSpeed) {
      const scaleFactor = maxAngularSpeed / currentSpeed;
      angVel.x *= scaleFactor;
      angVel.y *= scaleFactor;
      angVel.z *= scaleFactor;
    }
  }

  // Apply a subtle force to keep the polyhedron moving in an interesting way
  applySubtleForce() {
    // Don't apply forces if not active yet
    if (!this.isActive) {
      return;
    }

    // Only apply force if the polyhedron is near the center
    const pos = this.polyhedronBody.position;
    const distanceFromCenter = Math.sqrt(pos.x * pos.x + pos.z * pos.z);

    if (distanceFromCenter < 1.5) {
      // Calculate a force that pushes away from the center, but very gently
      const angle = Math.atan2(pos.z, pos.x) + (Math.random() * 0.1 - 0.05);
      const forceMagnitude = 0.2 * (1.5 - distanceFromCenter); // Reduced from 0.5 to 0.2

      // Apply the force perpendicular to the current position to create orbital movement
      const forceX = forceMagnitude * Math.cos(angle + Math.PI/2);
      const forceZ = forceMagnitude * Math.sin(angle + Math.PI/2);

      this.polyhedronBody.applyForce(
        new CANNON.Vec3(forceX, 0, forceZ),
        this.polyhedronBody.position
      );
    }
  }

  // Add a safety check to reset the polyhedron if it somehow escapes the boundaries
  checkBounds() {
    // Only check bounds if the polyhedron is active
    if (!this.isActive) return;

    const pos = this.polyhedronBody.position;
    const vel = this.polyhedronBody.velocity;

    // Check for out of bounds or unstable velocity
    const isOutOfBounds =
      Math.abs(pos.x) > 10 ||  // Reset to original boundary size
      pos.y > 25 || // Higher than ceiling
      pos.y < -8 || // Adjusted for new floor position (-2 with some margin)
      Math.abs(pos.z) > 10 ||  // Reset to original boundary size
      Math.abs(vel.x) > 20 ||
      Math.abs(vel.y) > 20 ||
      Math.abs(vel.z) > 20;

    if (isOutOfBounds) {
      debugLog(this, 'Polyhedron out of bounds or unstable, resetting position', {
        position: [pos.x, pos.y, pos.z],
        velocity: [vel.x, vel.y, vel.z]
      });

      this.resetPolyhedron();
    }
  }

  // New method to reset the polyhedron to a valid position
  resetPolyhedron() {
    // Get the viewport height in world coordinates - same calculation as in activatePolyhedron
    const cameraDistance = this.camera.position.z;
    const vFOV = THREE.MathUtils.degToRad(this.camera.fov);
    const visibleHeightAtDistance = 2 * Math.tan(vFOV / 2) * cameraDistance;

    // Position the polyhedron just above the visible area but below the ceiling
    // Same as the initial spawn position in activatePolyhedron
    const startY = Math.min(15, visibleHeightAtDistance / 2 + 5);

    // Reset position to match the initial spawn position
    this.polyhedronBody.position.set(
      (Math.random() - 0.5) * 4, // Reset to original range
      startY, // Position high but below ceiling
      (Math.random() - 0.5) * 3  // Reset to original range
    );

    // Reset velocity to match the initial spawn velocity
    this.polyhedronBody.velocity.set(
      (Math.random() - 0.5) * 0.8, // Slight horizontal drift
      -4, // Strong downward velocity for dramatic falling effect
      (Math.random() - 0.5) * 0.8  // Slight depth drift
    );

    // Add gentle initial rotation - same as in activatePolyhedron
    this.polyhedronBody.angularVelocity.set(
      (Math.random() - 0.5) * 2, // Moderate rotation for visual interest
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2
    );

    // Wake up the body if it was sleeping
    this.polyhedronBody.wakeUp();
  }

  // Method to smoothly move the polyhedron to the cursor position
  snapPolyhedronToCursor(mouseCoords) {
    // Create a ray from the camera through the mouse position
    this.raycaster.setFromCamera(mouseCoords, this.camera);

    // Calculate a point along the ray at a fixed distance from the camera
    // This gives us a 3D position that corresponds to the cursor
    const distance = 4; // Distance from camera
    const targetPosition = new THREE.Vector3();
    targetPosition.copy(this.raycaster.ray.direction);
    targetPosition.multiplyScalar(distance);
    targetPosition.add(this.camera.position);

    // Initialize target position if this is the first time
    if (!this.targetPosition) {
      this.targetPosition = new THREE.Vector3().copy(targetPosition);
    } else {
      // Update the target position
      this.targetPosition.copy(targetPosition);
    }

    // Constrain the target position to keep it within visible bounds
    this.constrainTargetPosition();

    // Use the grabSmoothness property to control the interpolation speed
    // Higher values = faster movement, lower values = smoother but slower
    const lerpFactor = this.grabSmoothness; // Value between 0.1-0.5 is good

    // Calculate the new position by interpolating between current and target
    const newPosition = new THREE.Vector3();
    newPosition.copy(this.polyhedronBody.position);
    newPosition.lerp(this.targetPosition, lerpFactor);

    // Set the polyhedron's position to this interpolated point
    this.polyhedronBody.position.copy(newPosition);

    debugLog(this, 'Moving to cursor at:', this.targetPosition);
  }

  // Helper method to constrain the target position within bounds
  constrainTargetPosition() {
    // Limit X position (left/right)
    this.targetPosition.x = Math.max(-4, Math.min(4, this.targetPosition.x));
    // Limit Y position (up/down)
    this.targetPosition.y = Math.max(-1.5, Math.min(5, this.targetPosition.y));
    // Limit Z position (forward/backward)
    this.targetPosition.z = Math.max(-4, Math.min(3, this.targetPosition.z));
  }

  // New method to activate the polyhedron after the delay
  activatePolyhedron() {
    debugLog(this, 'Activating polyhedron after delay');

    // Make the polyhedron visible
    this.polyhedron.visible = true;

    // Wake up the physics body
    this.polyhedronBody.wakeUp();

    // Get the viewport height in world coordinates
    const cameraDistance = this.camera.position.z;
    const vFOV = THREE.MathUtils.degToRad(this.camera.fov);
    const visibleHeightAtDistance = 2 * Math.tan(vFOV / 2) * cameraDistance;

    // Position the polyhedron just above the visible area but below the ceiling
    // The ceiling is at y=20, so we'll position it at around y=15
    const startY = Math.min(15, visibleHeightAtDistance / 2 + 5);

    this.polyhedronBody.position.set(
      (Math.random() - 0.5) * 4, // Reset to original range
      startY, // Position high but below ceiling
      (Math.random() - 0.5) * 3  // Reset to original range
    );

    // Add gentle initial rotation
    this.polyhedronBody.angularVelocity.set(
      (Math.random() - 0.5) * 2, // Moderate rotation for visual interest
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2
    );

    // Add a downward velocity to create a falling effect
    this.polyhedronBody.velocity.set(
      (Math.random() - 0.5) * 0.8, // Slight horizontal drift
      -4, // Strong downward velocity for dramatic falling effect
      (Math.random() - 0.5) * 0.8  // Slight depth drift
    );

    // Ensure we're in fast movement state when activating
    this.isMovingFast = true;

    // Make the polyhedron visible with a slight fade-in
    this.setupFadeInMaterials();

    debugLog(this, `Polyhedron activated at position (${this.polyhedronBody.position.x.toFixed(2)}, ${this.polyhedronBody.position.y.toFixed(2)}, ${this.polyhedronBody.position.z.toFixed(2)})`);
    debugLog(this, `Initial velocity: (${this.polyhedronBody.velocity.x.toFixed(2)}, ${this.polyhedronBody.velocity.y.toFixed(2)}, ${this.polyhedronBody.velocity.z.toFixed(2)})`);
  }

  // Helper method to set up fade-in materials
  setupFadeInMaterials() {
    if (this.polyhedron.material) {
      this.polyhedron.material.transparent = true;
      this.polyhedron.material.opacity = 0.9;
      this.polyhedron.material.needsUpdate = true;
    }

    // Make edges visible too
    if (this.polyhedron.children.length > 0 && this.polyhedron.children[0].material) {
      this.polyhedron.children[0].material.transparent = true;
      this.polyhedron.children[0].material.opacity = 0.9;
      this.polyhedron.children[0].material.needsUpdate = true;
    }
  }

  // Add a method to update colors based on color scheme
  updateColors(options) {
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Update the color based on color scheme
    if (isDarkMode && options.darkModeColors) {
      this.color = options.darkModeColors[options.colorIndex || 0] || (Math.random() * 0xffffff);
    } else if (options.colors) {
      this.color = options.colors[options.colorIndex || 0] || (Math.random() * 0xffffff);
    } else {
      this.color = options.color || (Math.random() * 0xffffff);
    }

    // Update the edge material color
    if (this.polyhedron && this.polyhedron.children.length > 0) {
      const edgeMaterial = this.polyhedron.children[0].material;
      if (edgeMaterial) {
        edgeMaterial.color.setHex(this.color);
        edgeMaterial.needsUpdate = true;

        debugLog(this, `Updated polyhedron color to ${this.color.toString(16)} (Dark mode: ${isDarkMode})`);
      }
    }
  }
}

// Static factory method to create multiple instances - optimized version
InteractivePolyhedron.createInstances = function(container, count = 1, options = {}) {
  console.log(`Creating ${count} polyhedron instances with options:`, options);
  const instances = [];

  // Create shared resources
  const sharedResources = createSharedResources(container, options.debug);

  // Create instances with staggered start times and different properties
  for (let i = 0; i < count; i++) {
    // Create a custom polyhedron instance that uses shared resources
    const instanceOptions = {
      startDelay: 2500 + (i * 500), // Stagger start times
      colorIndex: i % (options.colors ? options.colors.length : 1), // Pass the color index
      colors: options.colors, // Pass the entire colors array
      darkModeColors: options.darkModeColors, // Pass the dark mode colors array
      size: options.sizes ? options.sizes[i % options.sizes.length] : 1.0 + (i * 0.2),
      position: options.positions ? options.positions[i] : {
        x: (Math.random() - 0.5) * 4,
        y: 15 + i * 2,
        z: (Math.random() - 0.5) * 3
      },
      debug: options.debug || false
    };

    console.log(`Creating instance ${i} with colorIndex: ${instanceOptions.colorIndex}`);

    const instance = new CustomPolyhedronInstance(
      container,
      sharedResources.scene,
      sharedResources.camera,
      sharedResources.renderer,
      sharedResources.world,
      sharedResources.raycaster,
      sharedResources.clock,
      sharedResources.boundaries,
      instanceOptions
    );
    instances.push(instance);
  }

  // Set up shared event handlers
  setupSharedEventHandlers(container, instances, sharedResources);

  // Start the animation loop
  startAnimationLoop(instances, sharedResources);

  return instances;
};

// Helper function to create shared resources
function createSharedResources(container, debug = false) {
  // Create a shared renderer
  const width = container.clientWidth;
  const height = container.clientHeight;
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  // Create a shared scene
  const scene = new THREE.Scene();

  // Create a shared physics world with optimized settings
  const world = new CANNON.World();
  world.gravity.set(0, -0.5, 0);
  world.broadphase = new CANNON.NaiveBroadphase(); // Using NaiveBroadphase which is available in all versions
  world.solver.iterations = 5; // Reduced from 8 to compensate for more complex physics
  world.allowSleep = true; // Allow bodies to sleep when they come to rest
  world.sleepSpeedLimit = 0.05; // Lower threshold to allow bodies to sleep sooner
  world.sleepTimeLimit = 0.5; // Shorter time before sleeping

  // Add lights to the shared scene
  addLightsToScene(scene);

  // Create shared boundaries
  const boundaries = addSharedBoundaries(world, scene, debug);

  // Create a shared camera
  const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
  camera.position.z = 6;
  camera.position.y = 3;
  camera.lookAt(0, -1, 0);

  // Create a shared clock and raycaster
  const clock = new THREE.Clock();
  const raycaster = new THREE.Raycaster();

  // Add window resize handler for shared resources
  window.addEventListener('resize', () => {
    // Update camera aspect ratio
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();

    // Update renderer size
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    if (debug) {
      console.log(`Window resized: ${container.clientWidth}x${container.clientHeight}`);
    }
  });

  return {
    renderer,
    scene,
    world,
    boundaries,
    camera,
    clock,
    raycaster,
    width,
    height
  };
}

// Helper function to add lights to scene
function addLightsToScene(scene) {
  // Ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  // Directional light (sun-like)
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 5, 5);
  scene.add(directionalLight);

  // Point light (for highlights)
  const pointLight = new THREE.PointLight(0x0088ff, 1, 100);
  pointLight.position.set(0, 0, 5);
  scene.add(pointLight);
}

// Helper function to add shared boundaries
function addSharedBoundaries(world, scene, debug = false) {
  const boundarySize = 10;
  const boundaryDepth = 0.5;
  const wallMaterial = new CANNON.Material({
    friction: 0.1,
    restitution: 0.8
  });

  // Create all boundaries
  const boundaries = [
    // Floor - raised to be more visible in the camera view
    {
      shape: new CANNON.Box(new CANNON.Vec3(boundarySize, boundaryDepth, boundarySize)),
      position: new CANNON.Vec3(0, -2, 0), // Raised from -3 to -2
      dimensions: [boundarySize * 2, boundaryDepth * 2, boundarySize * 2],
      isFloor: true // Mark this as the floor for special visualization
    },
    // Ceiling
    {
      shape: new CANNON.Box(new CANNON.Vec3(boundarySize, boundaryDepth, boundarySize)),
      position: new CANNON.Vec3(0, 20, 0),
      dimensions: [boundarySize * 2, boundaryDepth * 2, boundarySize * 2]
    },
    // Left wall
    {
      shape: new CANNON.Box(new CANNON.Vec3(boundaryDepth, boundarySize, boundarySize)),
      position: new CANNON.Vec3(-5, 0, 0),
      dimensions: [boundaryDepth * 2, boundarySize * 2, boundarySize * 2]
    },
    // Right wall
    {
      shape: new CANNON.Box(new CANNON.Vec3(boundaryDepth, boundarySize, boundarySize)),
      position: new CANNON.Vec3(5, 0, 0),
      dimensions: [boundaryDepth * 2, boundarySize * 2, boundarySize * 2]
    },
    // Back wall
    {
      shape: new CANNON.Box(new CANNON.Vec3(boundarySize, boundarySize, boundaryDepth)),
      position: new CANNON.Vec3(0, 0, -5),
      dimensions: [boundarySize * 2, boundarySize * 2, boundaryDepth * 2]
    },
    // Front wall - moved closer to camera
    {
      shape: new CANNON.Box(new CANNON.Vec3(boundarySize, boundarySize, boundaryDepth)),
      position: new CANNON.Vec3(0, 0, 4), // Moved from 5 to 4 to be in front of camera
      dimensions: [boundarySize * 2, boundarySize * 2, boundaryDepth * 2]
    }
  ];

  const boundaryMeshes = [];

  // Create all boundary bodies and meshes
  boundaries.forEach(boundary => {
    const body = new CANNON.Body({
      mass: 0,
      shape: boundary.shape,
      position: boundary.position,
      material: wallMaterial
    });
    world.addBody(body);

    // Only create visualization in debug mode or for the floor
    if (debug || boundary.isFloor) {
      const geometry = new THREE.BoxGeometry(
        boundary.dimensions[0],
        boundary.dimensions[1],
        boundary.dimensions[2]
      );

      // Use a different material for the floor to make it more visible
      const material = boundary.isFloor ?
        new THREE.MeshBasicMaterial({
          color: window.matchMedia('(prefers-color-scheme: dark)').matches ? 0x090909 : 0xeeeeee,
          transparent: true,
          opacity: 0.0,
          wireframe: false
        }) :
        new THREE.MeshBasicMaterial({
          color: 0x444444,
          wireframe: true,
          transparent: true,
          opacity: 0.08,
          wireframeLinewidth: 1
        });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(body.position);
      mesh.quaternion.copy(body.quaternion);
      scene.add(mesh);
      boundaryMeshes.push({ mesh, body });
    } else {
      boundaryMeshes.push({ mesh: null, body });
    }
  });

  return boundaryMeshes;
}

// Helper function to set up shared event handlers
function setupSharedEventHandlers(container, instances, resources) {
  let activeInstance = null;
  let mouse = new THREE.Vector2();

  // Mouse down event handler
  container.addEventListener('mousedown', (event) => {
    // Get mouse coordinates
    const rect = resources.renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Set up raycaster
    resources.raycaster.setFromCamera(mouse, resources.camera);

    // Find intersections with all polyhedra
    const polyhedronMeshes = instances.map(instance => instance.polyhedron);
    const intersects = resources.raycaster.intersectObjects(polyhedronMeshes);

    if (intersects.length > 0) {
      // Get the first intersected polyhedron
      const intersectedMesh = intersects[0].object;

      // Find the instance that owns this mesh
      activeInstance = instances.find(instance =>
        instance.polyhedron === intersectedMesh ||
        instance.polyhedron.children.includes(intersectedMesh)
      );

      if (activeInstance) {
        // Start dragging this instance
        activeInstance.startDragging(mouse, event.clientX, event.clientY);
      }
    }
  });

  // Mouse move event handler
  window.addEventListener('mousemove', (event) => {
    // Update mouse coordinates
    const rect = resources.renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Handle active instance dragging
    if (activeInstance && activeInstance.isDragging) {
      activeInstance.updateDragging(mouse, event.clientX, event.clientY);
    } else {
      // Check for hover state on all instances
      resources.raycaster.setFromCamera(mouse, resources.camera);
      const polyhedronMeshes = instances.map(instance => instance.polyhedron);
      const intersects = resources.raycaster.intersectObjects(polyhedronMeshes);

      // Reset hover state on all instances
      instances.forEach(instance => {
        instance.isHovering = false;
      });

      if (intersects.length > 0) {
        // Get the first intersected polyhedron
        const intersectedMesh = intersects[0].object;

        // Find the instance that owns this mesh
        const hoveredInstance = instances.find(instance =>
          instance.polyhedron === intersectedMesh ||
          instance.polyhedron.children.includes(intersectedMesh)
        );

        if (hoveredInstance) {
          hoveredInstance.isHovering = true;
          document.body.style.cursor = 'grab';
        } else {
          document.body.style.cursor = 'auto';
        }
      } else {
        document.body.style.cursor = 'auto';
      }
    }
  });

  // Mouse up event handler
  window.addEventListener('mouseup', () => {
    if (activeInstance && activeInstance.isDragging) {
      activeInstance.endDragging();
      activeInstance = null;
    }
  });

  // Touch event handlers
  container.addEventListener('touchstart', (event) => {
    if (event.touches.length > 0) {
      // Get touch coordinates
      const rect = resources.renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.touches[0].clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.touches[0].clientY - rect.top) / rect.height) * 2 + 1;

      // Set up raycaster
      resources.raycaster.setFromCamera(mouse, resources.camera);

      // Find intersections with all polyhedra
      const polyhedronMeshes = instances.map(instance => instance.polyhedron);
      const intersects = resources.raycaster.intersectObjects(polyhedronMeshes);

      if (intersects.length > 0) {
        // Prevent default to avoid scrolling
        event.preventDefault();

        // Get the first intersected polyhedron
        const intersectedMesh = intersects[0].object;

        // Find the instance that owns this mesh
        activeInstance = instances.find(instance =>
          instance.polyhedron === intersectedMesh ||
          instance.polyhedron.children.includes(intersectedMesh)
        );

        if (activeInstance) {
          // Start dragging this instance
          activeInstance.startDragging(mouse, event.touches[0].clientX, event.touches[0].clientY);
        }
      }
    }
  }, { passive: false });

  container.addEventListener('touchmove', (event) => {
    if (activeInstance && activeInstance.isDragging && event.touches.length > 0) {
      // Prevent default to avoid scrolling
      event.preventDefault();

      // Get touch coordinates
      const rect = resources.renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.touches[0].clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.touches[0].clientY - rect.top) / rect.height) * 2 + 1;

      // Update dragging
      activeInstance.updateDragging(mouse, event.touches[0].clientX, event.touches[0].clientY);
    }
  }, { passive: false });

  container.addEventListener('touchend', () => {
    if (activeInstance && activeInstance.isDragging) {
      activeInstance.endDragging();
      activeInstance = null;
    }
  });
}

// Helper function to start the animation loop
function startAnimationLoop(instances, resources) {
  const animateAll = function() {
    requestAnimationFrame(animateAll);

    // Update physics world
    const deltaTime = resources.clock.getDelta();
    resources.world.step(1/60, deltaTime, 3);

    // Update all instances
    instances.forEach(instance => instance.update(deltaTime));

    // Render the scene
    resources.renderer.render(resources.scene, resources.camera);
  };

  // Start the animation loop
  animateAll();
}

// Custom polyhedron instance class that uses shared resources
class CustomPolyhedronInstance {
  constructor(container, scene, camera, renderer, world, raycaster, clock, boundaries, options = {}) {
    this.container = container;
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.world = world;
    this.raycaster = raycaster;
    this.clock = clock;
    this.boundaries = boundaries;

    // Store options for later use
    this.options = options;

    // Set options with defaults
    this.startDelay = options.startDelay || 2500;
    this.startTime = performance.now() + this.startDelay;
    this.isActive = false;
    this.debug = options.debug || false;
    this.size = options.size || 1.0;

    // Store color options for later use
    this.colorOptions = {
      colors: options.colors || [],
      darkModeColors: options.darkModeColors || [],
      colorIndex: options.colorIndex || 0,
      defaultColor: options.color || 0x1a73e8,
      darkModeBackground: 0x090909, // Dark mode background color #090909
      lightModeBackground: 0xffffff // Light mode background color #ffffff
    };

    // Set initial color based on current color scheme
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.updateColorFromScheme(isDarkMode);

    this.initialPosition = options.position || { x: 0, y: 15, z: 0 };

    // Create the polyhedron mesh and physics body
    this.createPolyhedron();

    // Initialize interaction state
    this.isDragging = false;
    this.isHovering = false;

    // Set grabSmoothness property for smooth dragging
    this.grabSmoothness = 0.3;

    // Initialize mouse/touch tracking properties
    this.dragPositions = [];
    this.targetPosition = null;
    this.savedGravity = null;
    this.savedAngularVelocity = null;

    // Add media query listener to update colors when color scheme changes
    this.colorSchemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.colorSchemeMediaQuery.addEventListener('change', (e) => {
      console.log('Color scheme changed to:', e.matches ? 'dark' : 'light');
      this.updateColorFromScheme(e.matches);
      this.updatePolyhedronColor();
    });
  }

  createPolyhedron() {
    // Create Three.js geometry
    const radius = 1 * this.size;
    const detail = 0;
    const geometry = new THREE.IcosahedronGeometry(radius, detail);

    // Determine background color based on color scheme
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const backgroundColor = isDarkMode ? this.colorOptions.darkModeBackground : this.colorOptions.lightModeBackground;

    // Create material with appropriate background color
    const material = new THREE.MeshBasicMaterial({
      color: backgroundColor,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide
    });

    // Ensure we have a valid color before creating edges
    if (!this.color) {
      this.updateColorFromScheme(isDarkMode);
      console.log(`Set initial color to 0x${this.color.toString(16)}`);
    }

    // Create edges with the correct color
    const edgesGeometry = new THREE.EdgesGeometry(geometry);
    const edgesMaterial = new THREE.LineBasicMaterial({
      color: this.color,
      linewidth: 2,
      transparent: true,
      opacity: 0
    });

    console.log(`Creating polyhedron edges with color: 0x${this.color.toString(16)}`);

    const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);

    // Create mesh
    this.polyhedron = new THREE.Mesh(geometry, material);
    this.polyhedron.add(edges);
    this.polyhedron.scale.set(1.2, 1.2, 1.2);
    this.polyhedron.visible = false;
    this.polyhedron.userData.instance = this; // Store reference to this instance
    this.scene.add(this.polyhedron);

    // Create physics body
    const shape = new CANNON.Sphere(radius * 1.2);
    this.polyhedronBody = new CANNON.Body({
      mass: 5,
      shape: shape,
      position: new CANNON.Vec3(this.initialPosition.x, this.initialPosition.y, this.initialPosition.z),
      material: new CANNON.Material({
        friction: 0.3,
        restitution: 0.8
      }),
      linearDamping: 0.05,
      angularDamping: 0.05,
      allowSleep: true,
      collisionFilterGroup: 1, // Enable collisions with other polyhedra
      collisionFilterMask: 1 // Collide with other polyhedra
    });

    // Initially set the body to sleep until the delay is over
    this.polyhedronBody.sleep();
    this.world.addBody(this.polyhedronBody);
  }

  update(deltaTime) {
    // Check if we should activate the polyhedron
    const currentTime = performance.now();
    if (!this.isActive && currentTime > this.startTime) {
      this.activatePolyhedron();
      this.isActive = true;
    }

    // Handle fade-in animation
    this.updateFadeInAnimation();

    // Handle dragging with smooth movement
    if (this.isActive && this.isDragging && this.targetPosition) {
      this.snapPolyhedronToCursor();
    }

    // Update mesh position and rotation from physics body
    if (this.isActive) {
      this.polyhedron.position.copy(this.polyhedronBody.position);
      this.polyhedron.quaternion.copy(this.polyhedronBody.quaternion);

      // Check bounds
      this.checkBounds();
    }

    // Visual feedback for hover state
    this.highlightPolyhedron();
  }

  // Handle fade-in animation
  updateFadeInAnimation() {
    if (this.polyhedron.visible && this.polyhedron.material.opacity < 1.0) {
      // Gradually increase opacity
      this.polyhedron.material.opacity += 0.02;

      // Also increase edge opacity
      if (this.polyhedron.children.length > 0) {
        this.polyhedron.children[0].material.opacity += 0.02;
      }

      // Ensure we don't exceed 1.0 opacity
      if (this.polyhedron.material.opacity >= 1.0) {
        this.polyhedron.material.opacity = 1.0;
        this.polyhedron.material.transparent = false;

        if (this.polyhedron.children.length > 0) {
          this.polyhedron.children[0].material.opacity = 1.0;
          this.polyhedron.children[0].material.transparent = false;
        }
      }

      // Mark materials for update
      this.polyhedron.material.needsUpdate = true;
      if (this.polyhedron.children.length > 0) {
        this.polyhedron.children[0].material.needsUpdate = true;
      }
    }
  }

  // Smoothly move polyhedron to cursor position
  snapPolyhedronToCursor() {
    // Use the grabSmoothness property to control the interpolation speed
    const lerpFactor = this.grabSmoothness || 0.3; // Default to 0.3 if not set

    // Calculate the new position by interpolating between current and target
    const newPosition = new THREE.Vector3();
    newPosition.copy(this.polyhedronBody.position);
    newPosition.lerp(this.targetPosition, lerpFactor);

    // Set the polyhedron's position to this interpolated point
    this.polyhedronBody.position.copy(newPosition);
  }

  // Visual feedback for hover/drag state
  highlightPolyhedron() {
    if (this.polyhedron.children.length > 0) {
      const edgeMaterial = this.polyhedron.children[0].material;
      if (edgeMaterial) {
        if (this.isHovering && !this.isDragging) {
          // Highlight the edges when hovering
          edgeMaterial.linewidth = 3; // Note: this may not work in all browsers
        } else {
          // Reset to normal appearance
          edgeMaterial.linewidth = 2;
        }
        edgeMaterial.needsUpdate = true;
      }
    }
  }

  activatePolyhedron() {
    debugLog(this, 'Activating polyhedron after delay');

    // Make the polyhedron visible
    this.polyhedron.visible = true;

    // Wake up the physics body
    this.polyhedronBody.wakeUp();

    // Set initial position
    this.polyhedronBody.position.set(
      this.initialPosition.x,
      this.initialPosition.y,
      this.initialPosition.z
    );

    // Add gentle initial rotation
    this.polyhedronBody.angularVelocity.set(
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2
    );

    // Add a downward velocity to create a falling effect
    this.polyhedronBody.velocity.set(
      (Math.random() - 0.5) * 0.8,
      -4,
      (Math.random() - 0.5) * 0.8
    );

    // Ensure we're in fast movement state when activating
    this.isMovingFast = true;

    // Make the polyhedron visible with a slight fade-in
    this.setupFadeInMaterials();

    debugLog(this, `Polyhedron activated at position (${this.polyhedronBody.position.x.toFixed(2)}, ${this.polyhedronBody.position.y.toFixed(2)}, ${this.polyhedronBody.position.z.toFixed(2)})`);
    debugLog(this, `Initial velocity: (${this.polyhedronBody.velocity.x.toFixed(2)}, ${this.polyhedronBody.velocity.y.toFixed(2)}, ${this.polyhedronBody.velocity.z.toFixed(2)})`);
  }

  // Start dragging the polyhedron
  startDragging(mouse, clientX, clientY) {
    this.isDragging = true;
    this.isHovering = true;

    // Update cursor style
    document.body.style.cursor = 'grabbing';

    // Store initial mouse position for velocity calculation
    this.dragPositions = [{
      time: performance.now(),
      x: clientX,
      y: clientY
    }];

    // Wake up the physics body
    this.polyhedronBody.wakeUp();

    // Store the current gravity for later restoration
    this.savedGravity = new CANNON.Vec3().copy(this.world.gravity);

    // Disable gravity while dragging
    this.world.gravity.set(0, 0, 0);

    // Set the body type to kinematic to prevent other forces from affecting it
    this.polyhedronBody.type = CANNON.BODY_TYPES.KINEMATIC;

    // Completely stop all motion by zeroing out velocities
    this.polyhedronBody.velocity.set(0, 0, 0);
    this.polyhedronBody.angularVelocity.scale(0.7);

    // Zero out forces and torques
    this.polyhedronBody.force.set(0, 0, 0);
    this.polyhedronBody.torque.set(0, 0, 0);

    // Initialize the target position for smooth transition
    const distance = 4; // Distance from camera
    this.targetPosition = new THREE.Vector3();
    this.targetPosition.copy(this.raycaster.ray.direction);
    this.targetPosition.multiplyScalar(distance);
    this.targetPosition.add(this.camera.position);

    debugLog(this, 'Started dragging polyhedron');
  }

  // Update dragging position
  updateDragging(mouse, clientX, clientY) {
    // Store position for velocity calculation
    this.dragPositions.push({
      time: performance.now(),
      x: clientX,
      y: clientY
    });

    // Keep only the last 5 positions for velocity calculation
    if (this.dragPositions.length > 5) {
      this.dragPositions.shift();
    }

    // Update target position
    this.raycaster.setFromCamera(mouse, this.camera);
    const distance = 4; // Distance from camera
    this.targetPosition.copy(this.raycaster.ray.direction);
    this.targetPosition.multiplyScalar(distance);
    this.targetPosition.add(this.camera.position);

    // Constrain the target position to keep it within visible bounds
    this.targetPosition.x = Math.max(-4, Math.min(4, this.targetPosition.x));
    this.targetPosition.y = Math.max(-1.5, Math.min(5, this.targetPosition.y));
    this.targetPosition.z = Math.max(-4, Math.min(3, this.targetPosition.z));
  }

  // End dragging and apply throw velocity
  endDragging() {
    // Calculate throw velocity
    const throwVelocity = this.calculateThrowVelocity();

    // Resume physics with a throw
    this.polyhedronBody.type = CANNON.BODY_TYPES.DYNAMIC;
    this.polyhedronBody.velocity.copy(throwVelocity);

    // Restore the original gravity
    if (this.savedGravity) {
      this.world.gravity.copy(this.savedGravity);
    } else {
      this.world.gravity.set(0, -0.5, 0);
    }

    // Blend saved angular velocity with new random component
    const randomAngVel = new CANNON.Vec3(
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2
    );

    this.polyhedronBody.angularVelocity.set(
      this.polyhedronBody.angularVelocity.x * 0.5 + randomAngVel.x * 0.5,
      this.polyhedronBody.angularVelocity.y * 0.5 + randomAngVel.y * 0.5,
      this.polyhedronBody.angularVelocity.z * 0.5 + randomAngVel.z * 0.5
    );

    // Reset state
    this.isDragging = false;

    // Reset cursor based on hover state
    document.body.style.cursor = 'auto';

    debugLog(this, `Ended dragging with velocity: (${throwVelocity.x.toFixed(2)}, ${throwVelocity.y.toFixed(2)}, ${throwVelocity.z.toFixed(2)})`);
  }

  // Calculate throw velocity based on drag history
  calculateThrowVelocity() {
    let throwVelocity = new CANNON.Vec3(0, 0, 0);

    if (this.dragPositions.length >= 2) {
      const latest = this.dragPositions[this.dragPositions.length - 1];
      const previous = this.dragPositions[0];

      // Calculate time difference in seconds
      const timeDiff = (latest.time - previous.time) / 1000;
      if (timeDiff > 0) {
        // Calculate pixel velocity
        const pixelVelocityX = (latest.x - previous.x) / timeDiff;
        const pixelVelocityY = (latest.y - previous.y) / timeDiff;

        // Convert to 3D space
        const velocityX = pixelVelocityX / this.container.clientWidth * 2;
        const velocityY = -pixelVelocityY / this.container.clientHeight * 2;

        // Add some randomness to Z velocity
        const velocityZ = (Math.random() - 0.5) * Math.abs(velocityX + velocityY) * 0.5;

        throwVelocity = new CANNON.Vec3(velocityX, velocityY, velocityZ);
      }
    }

    return throwVelocity;
  }

  checkBounds() {
    const pos = this.polyhedronBody.position;
    const vel = this.polyhedronBody.velocity;

    // Check for out of bounds or unstable velocity
    if (Math.abs(pos.x) > 10 ||
        pos.y > 25 ||
        pos.y < -8 ||
        Math.abs(pos.z) > 10 ||
        Math.abs(vel.x) > 20 ||
        Math.abs(vel.y) > 20 ||
        Math.abs(vel.z) > 20) {

      this.resetPolyhedron();
    }
  }

  // Reset polyhedron to a safe position
  resetPolyhedron() {
    // Reset position to match the initial spawn position
    this.polyhedronBody.position.set(
      (Math.random() - 0.5) * 4,
      15,
      (Math.random() - 0.5) * 3
    );

    // Reset velocity to match the initial spawn velocity
    this.polyhedronBody.velocity.set(
      (Math.random() - 0.5) * 0.8,
      -4,
      (Math.random() - 0.5) * 0.8
    );

    // Add gentle initial rotation
    this.polyhedronBody.angularVelocity.set(
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2
    );

    // Wake up the body if it was sleeping
    this.polyhedronBody.wakeUp();

    debugLog(this, 'Polyhedron reset due to out-of-bounds position or velocity');
  }

  // Helper method to set up fade-in materials
  setupFadeInMaterials() {
    if (this.polyhedron.material) {
      this.polyhedron.material.transparent = true;
      this.polyhedron.material.opacity = 0.9;
      this.polyhedron.material.needsUpdate = true;
    }

    // Make edges visible too
    if (this.polyhedron.children.length > 0 && this.polyhedron.children[0].material) {
      this.polyhedron.children[0].material.transparent = true;
      this.polyhedron.children[0].material.opacity = 0.9;
      this.polyhedron.children[0].material.needsUpdate = true;
    }
  }

  // Helper method to update color based on color scheme
  updateColorFromScheme(isDarkMode) {
    const options = this.colorOptions;

    if (isDarkMode && options.darkModeColors && options.darkModeColors.length > 0) {
      this.color = options.darkModeColors[options.colorIndex % options.darkModeColors.length];
      console.log(`Using dark mode color: 0x${this.color.toString(16)}`);
    } else if (options.colors && options.colors.length > 0) {
      this.color = options.colors[options.colorIndex % options.colors.length];
      console.log(`Using light mode color: 0x${this.color.toString(16)}`);
    } else {
      this.color = options.defaultColor;
      console.log(`Using default color: 0x${this.color.toString(16)}`);
    }
  }

  // Update the polyhedron color immediately
  updatePolyhedronColor() {
    if (!this.polyhedron) {
      console.warn('Cannot update color: polyhedron not initialized');
      return;
    }

    // Update edge color
    if (this.polyhedron.children.length > 0) {
      const edgeMaterial = this.polyhedron.children[0].material;
      if (edgeMaterial) {
        const oldColor = edgeMaterial.color.getHex();
        edgeMaterial.color.setHex(this.color);
        edgeMaterial.needsUpdate = true;
        console.log(`Updated polyhedron edge color from 0x${oldColor.toString(16)} to 0x${this.color.toString(16)}`);
      }
    }

    // Update background color based on color scheme
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const backgroundColor = isDarkMode ? this.colorOptions.darkModeBackground : this.colorOptions.lightModeBackground;

    if (this.polyhedron.material) {
      this.polyhedron.material.color.setHex(backgroundColor);
      this.polyhedron.material.needsUpdate = true;
      console.log(`Updated polyhedron background color to 0x${backgroundColor.toString(16)}`);
    }
  }

  // Add a method to update colors based on color scheme
  updateColors() {
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    console.log('Updating colors, dark mode:', isDarkMode);

    // Update the color based on color scheme
    this.updateColorFromScheme(isDarkMode);

    // Update the edge material color
    this.updatePolyhedronColor();
  }
}

// Initialize when script is loaded (for lazy loading)
console.log('Polyhedron script loaded, looking for grid-canvas container...');
const container = document.querySelector('#grid-canvas');

if (container) {
  console.log('Grid canvas container found, dimensions:', container.clientWidth, 'x', container.clientHeight);
  try {
    // Clear any existing canvas elements to prevent duplicates
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    console.log('Container cleared of any existing elements');

    // Define color schemes
    const lightModeColors = [0x1a73e8, 0x9c27b0, 0x00c971]; // Blue, purple, and green for light mode
    const darkModeColors = [0x00c971, 0x9c27b0, 0x1a73e8]; // Green, purple, and blue for dark mode

    // Set to true for debugging, false for production
    const debugMode = false;

    if (debugMode) {
      console.log('Light mode colors:', lightModeColors.map(c => '0x' + c.toString(16)));
      console.log('Dark mode colors:', darkModeColors.map(c => '0x' + c.toString(16)));
    }

    // Create multiple polyhedron instances with shared resources
    const instances = InteractivePolyhedron.createInstances(container, 1, {
      debug: debugMode,
      colors: lightModeColors,
      darkModeColors: darkModeColors,
      sizes: [1.0, 1, 1], // Different sizes for visual interest
      positions: [
        { x: -2, y: 15, z: -1 },
        { x: 0.5, y: 18, z: 0 },
        { x: 2, y: 16, z: 1 }
      ]
    });

    // Expose instances to global scope for debugging
    window.heroPolyhedrons = instances;

    console.log(`${instances.length} polyhedron instances created with shared resources`);

    // Add a click handler to the container to help with mobile devices
    container.addEventListener('click', () => {
      // This empty click handler helps ensure touch events work properly on some mobile devices
    });

    // Force an initial color update to ensure correct colors on load
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (debugMode) {
      console.log('Initial color scheme is:', isDarkMode ? 'dark' : 'light');
    }

    setTimeout(() => {
      instances.forEach((instance, index) => {
        if (debugMode) {
          console.log(`Forcing color update for instance ${index}`);
        }
        instance.updateColors();
      });
    }, 500); // Small delay to ensure everything is initialized

  } catch (error) {
    console.error('Error initializing polyhedron:', error);
  }
}

// Export the InteractivePolyhedron class
export { InteractivePolyhedron };