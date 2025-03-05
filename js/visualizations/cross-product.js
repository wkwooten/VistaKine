/**
 * Cross Product Visualization
 *
 * This file creates an interactive 3D visualization to help understand
 * cross products geometrically. It allows users to:
 * 1. Drag vectors in 3D space
 * 2. See the resulting cross product update in real-time
 * 3. Visualize the area of the parallelogram formed by the two vectors
 * 4. Understand the right-hand rule through animation
 */

class CrossProductVisualization {
  constructor(containerId) {
    // Store DOM reference
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Container element with ID '${containerId}' not found`);
      return;
    }

    // Set dimensions
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight || 400; // Default height if not specified
    this.container.style.height = `${this.height}px`;

    // Vector properties
    this.vectorA = { x: 2, y: 0, z: 0 }; // Red vector
    this.vectorB = { x: 0, y: 2, z: 0 }; // Green vector
    this.draggingVector = null;
    this.dragPlane = new THREE.Plane();
    this.dragOffset = new THREE.Vector3();

    // Setup the visualization
    this.setupScene();
    this.setupCamera();
    this.setupRenderer();
    this.setupLights();
    this.setupAxes();
    this.setupVectors();
    this.setupDragControls();
    this.setupOrbitControls();
    this.setupUI();

    // Calculate and display cross product
    this.updateCrossProduct();

    // Start animation loop
    this.animate();

    // Handle window resize
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf5f5f5);

    // Add a grid for better spatial reference
    const gridHelper = new THREE.GridHelper(10, 10, 0x888888, 0xcccccc);
    this.scene.add(gridHelper);
  }

  setupCamera() {
    this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 1000);
    this.camera.position.set(6, 4, 10);
    this.camera.lookAt(0, 0, 0);
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.appendChild(this.renderer.domElement);
  }

  setupLights() {
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    this.scene.add(directionalLight);
  }

  setupAxes() {
    // Create custom axes with labels
    this.axesHelper = new THREE.AxesHelper(5);
    this.scene.add(this.axesHelper);

    // X-axis label
    const xLabel = this.createTextLabel('X', 5.5, 0, 0, 0xff0000);
    this.scene.add(xLabel);

    // Y-axis label
    const yLabel = this.createTextLabel('Y', 0, 5.5, 0, 0x00ff00);
    this.scene.add(yLabel);

    // Z-axis label
    const zLabel = this.createTextLabel('Z', 0, 0, 5.5, 0x0000ff);
    this.scene.add(zLabel);
  }

  createTextLabel(text, x, y, z, color) {
    // Create a text sprite for axis labels
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 64;
    canvas.height = 64;

    context.font = 'Bold 24px Arial';
    context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(x, y, z);
    sprite.scale.set(1, 1, 1);

    return sprite;
  }

  setupVectors() {
    // Create vector A (red)
    this.vectorAObject = this.createVector(
      this.vectorA.x, this.vectorA.y, this.vectorA.z,
      0xff0000,
      'A'
    );
    this.scene.add(this.vectorAObject);

    // Create vector B (green)
    this.vectorBObject = this.createVector(
      this.vectorB.x, this.vectorB.y, this.vectorB.z,
      0x00ff00,
      'B'
    );
    this.scene.add(this.vectorBObject);

    // Cross product vector (blue) - will be created in updateCrossProduct
    this.crossProductObject = null;

    // Create parallelogram area visualization
    this.areaObject = new THREE.Group();
    this.scene.add(this.areaObject);
  }

  createVector(x, y, z, color, label) {
    // Create a group to hold the arrow and handle
    const vectorGroup = new THREE.Group();

    // Create the direction and normalize it
    const dir = new THREE.Vector3(x, y, z);
    const length = dir.length();
    dir.normalize();

    // Create the arrow
    const arrowHelper = new THREE.ArrowHelper(
      dir,
      new THREE.Vector3(0, 0, 0),
      length,
      color,
      0.2 * length,  // head length proportional to arrow length
      0.1 * length   // head width proportional to arrow length
    );
    vectorGroup.add(arrowHelper);

    // Add a sphere handle for dragging
    const handleGeometry = new THREE.SphereGeometry(0.15, 16, 16);
    const handleMaterial = new THREE.MeshLambertMaterial({ color: color });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.set(x, y, z);
    vectorGroup.add(handle);

    // Add the label
    const textSprite = this.createTextLabel(label, x + 0.3, y + 0.3, z + 0.3, color);
    vectorGroup.add(textSprite);

    // Store original data as user data
    vectorGroup.userData = {
      type: 'vector',
      color: color,
      handle: handle,
      arrow: arrowHelper,
      label: textSprite,
      name: label
    };

    return vectorGroup;
  }

  setupDragControls() {
    // Create raycaster for handle selection
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Add mouse event listeners
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.renderer.domElement.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.renderer.domElement.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    this.renderer.domElement.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    this.renderer.domElement.addEventListener('touchend', this.onTouchEnd.bind(this));
  }

  setupOrbitControls() {
    // Add orbit controls for camera rotation
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.enabled = true; // Enable by default, will be disabled during vector dragging
  }

  setupUI() {
    // Create UI container
    const uiContainer = document.createElement('div');
    uiContainer.className = 'cross-product-ui';
    uiContainer.style.position = 'absolute';
    uiContainer.style.top = '10px';
    uiContainer.style.left = '10px';
    uiContainer.style.background = 'rgba(255, 255, 255, 0.8)';
    uiContainer.style.padding = '10px';
    uiContainer.style.borderRadius = '5px';
    uiContainer.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
    uiContainer.style.maxWidth = '300px';
    uiContainer.style.fontSize = '14px';

    // Create info header
    const header = document.createElement('h3');
    header.textContent = 'Cross Product Visualization';
    header.style.margin = '0 0 10px 0';
    uiContainer.appendChild(header);

    // Create info text
    const infoText = document.createElement('div');
    infoText.innerHTML = `
      <p>Drag the <span style="color:#ff0000">red</span> and <span style="color:#00cc00">green</span> vector handles to change their direction and magnitude.</p>
      <p>The <span style="color:#0000ff">blue</span> vector shows their cross product (A × B).</p>
      <p>The shaded area represents the parallelogram formed by the two vectors.</p>
    `;
    infoText.style.marginBottom = '10px';
    uiContainer.appendChild(infoText);

    // Create coordinates display
    this.coordsDisplay = document.createElement('div');
    this.coordsDisplay.className = 'coords-display';
    this.coordsDisplay.style.fontFamily = 'monospace';
    uiContainer.appendChild(this.coordsDisplay);

    // Add UI to container
    this.container.appendChild(uiContainer);

    // Ensure container has relative positioning for absolute positioning of UI
    this.container.style.position = 'relative';

    // Update coordinates display
    this.updateCoordsDisplay();
  }

  updateCoordsDisplay() {
    // Format vector to string with 2 decimal places
    const formatVector = v => `(${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)})`;

    // Get current vectors
    const vecA = { x: this.vectorA.x, y: this.vectorA.y, z: this.vectorA.z };
    const vecB = { x: this.vectorB.x, y: this.vectorB.y, z: this.vectorB.z };

    // Calculate cross product
    const cross = {
      x: vecA.y * vecB.z - vecA.z * vecB.y,
      y: vecA.z * vecB.x - vecA.x * vecB.z,
      z: vecA.x * vecB.y - vecA.y * vecB.x
    };

    // Calculate magnitude of cross product (area of parallelogram)
    const magnitude = Math.sqrt(
      cross.x * cross.x + cross.y * cross.y + cross.z * cross.z
    );

    // Update display
    this.coordsDisplay.innerHTML = `
      <div><strong>A:</strong> ${formatVector(vecA)}</div>
      <div><strong>B:</strong> ${formatVector(vecB)}</div>
      <div><strong>A × B:</strong> ${formatVector(cross)}</div>
      <div><strong>|A × B|:</strong> ${magnitude.toFixed(2)} (area)</div>
    `;
  }

  updateCrossProduct() {
    // Remove old cross product and area visualization
    if (this.crossProductObject) this.scene.remove(this.crossProductObject);
    this.areaObject.clear();

    // Get current vectors
    const vecA = { x: this.vectorA.x, y: this.vectorA.y, z: this.vectorA.z };
    const vecB = { x: this.vectorB.x, y: this.vectorB.y, z: this.vectorB.z };

    // Calculate cross product
    const cross = {
      x: vecA.y * vecB.z - vecA.z * vecB.y,
      y: vecA.z * vecB.x - vecA.x * vecB.z,
      z: vecA.x * vecB.y - vecA.y * vecB.x
    };

    // Create cross product vector (blue)
    this.crossProductObject = this.createVector(
      cross.x, cross.y, cross.z,
      0x0000ff,
      'A×B'
    );
    this.scene.add(this.crossProductObject);

    // Create parallelogram visualization
    this.createParallelogram(vecA, vecB);

    // Update UI display
    this.updateCoordsDisplay();
  }

  createParallelogram(vecA, vecB) {
    // Create vertices for the parallelogram
    const vertices = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(vecA.x, vecA.y, vecA.z),
      new THREE.Vector3(
        vecA.x + vecB.x,
        vecA.y + vecB.y,
        vecA.z + vecB.z
      ),
      new THREE.Vector3(vecB.x, vecB.y, vecB.z)
    ];

    // Create geometry
    const geometry = new THREE.BufferGeometry();

    // Create faces (triangles)
    const triangles = [
      // First triangle
      vertices[0].x, vertices[0].y, vertices[0].z,
      vertices[1].x, vertices[1].y, vertices[1].z,
      vertices[2].x, vertices[2].y, vertices[2].z,

      // Second triangle
      vertices[0].x, vertices[0].y, vertices[0].z,
      vertices[2].x, vertices[2].y, vertices[2].z,
      vertices[3].x, vertices[3].y, vertices[3].z,
    ];

    // Set positions
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(triangles, 3)
    );

    // Calculate normals
    geometry.computeVertexNormals();

    // Create material - semi-transparent blue
    const material = new THREE.MeshBasicMaterial({
      color: 0x0088ff,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide
    });

    // Create mesh and add to group
    const mesh = new THREE.Mesh(geometry, material);
    this.areaObject.add(mesh);

    // Add wireframe for edges
    const wireframe = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color: 0x0066cc })
    );
    this.areaObject.add(wireframe);
  }

  onMouseDown(event) {
    event.preventDefault();

    // Calculate mouse position
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / this.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / this.height) * 2 + 1;

    // Find intersections with handles
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Check handle intersections
    const handleA = this.vectorAObject.userData.handle;
    const handleB = this.vectorBObject.userData.handle;

    const intersects = this.raycaster.intersectObjects([handleA, handleB]);

    if (intersects.length > 0) {
      // Disable orbit controls while dragging
      this.controls.enabled = false;

      // Set up dragging
      this.draggingVector = intersects[0].object === handleA ? 'A' : 'B';

      // Create a plane perpendicular to the camera
      const planeNormal = new THREE.Vector3().copy(this.camera.position).normalize();

      // Get the intersection point
      const intersectionPoint = intersects[0].point;

      // Set the plane to pass through this point
      this.dragPlane.setFromNormalAndCoplanarPoint(planeNormal, intersectionPoint);

      // Calculate the offset from the handle to the intersection point
      this.dragOffset.copy(intersectionPoint).sub(
        this.draggingVector === 'A' ?
          new THREE.Vector3(this.vectorA.x, this.vectorA.y, this.vectorA.z) :
          new THREE.Vector3(this.vectorB.x, this.vectorB.y, this.vectorB.z)
      );
    }
  }

  onMouseMove(event) {
    event.preventDefault();

    if (this.draggingVector) {
      // Calculate mouse position
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / this.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / this.height) * 2 + 1;

      // Create a ray from the camera through the mouse position
      this.raycaster.setFromCamera(this.mouse, this.camera);

      // Find where the ray intersects our drag plane
      const intersectionPoint = new THREE.Vector3();
      this.raycaster.ray.intersectPlane(this.dragPlane, intersectionPoint);

      // Subtract the offset to get the new position
      intersectionPoint.sub(this.dragOffset);

      // Update the appropriate vector
      if (this.draggingVector === 'A') {
        this.vectorA.x = intersectionPoint.x;
        this.vectorA.y = intersectionPoint.y;
        this.vectorA.z = intersectionPoint.z;

        // Update vector A visualization
        this.scene.remove(this.vectorAObject);
        this.vectorAObject = this.createVector(
          this.vectorA.x, this.vectorA.y, this.vectorA.z,
          0xff0000,
          'A'
        );
        this.scene.add(this.vectorAObject);
      } else {
        this.vectorB.x = intersectionPoint.x;
        this.vectorB.y = intersectionPoint.y;
        this.vectorB.z = intersectionPoint.z;

        // Update vector B visualization
        this.scene.remove(this.vectorBObject);
        this.vectorBObject = this.createVector(
          this.vectorB.x, this.vectorB.y, this.vectorB.z,
          0x00ff00,
          'B'
        );
        this.scene.add(this.vectorBObject);
      }

      // Update cross product
      this.updateCrossProduct();
    }
  }

  onMouseUp(event) {
    event.preventDefault();

    // Stop dragging
    this.draggingVector = null;

    // Re-enable orbit controls
    this.controls.enabled = true;
  }

  onTouchStart(event) {
    event.preventDefault();
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      const fakeEvent = { clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => {} };
      this.onMouseDown(fakeEvent);
    }
  }

  onTouchMove(event) {
    event.preventDefault();
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      const fakeEvent = { clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => {} };
      this.onMouseMove(fakeEvent);
    }
  }

  onTouchEnd(event) {
    const fakeEvent = { preventDefault: () => {} };
    this.onMouseUp(fakeEvent);
  }

  onWindowResize() {
    // Update dimensions
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight || 400;

    // Update camera aspect ratio
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();

    // Update renderer size
    this.renderer.setSize(this.width, this.height);
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));

    // Update controls
    if (this.controls) this.controls.update();

    // Render the scene
    this.renderer.render(this.scene, this.camera);
  }

  // Public method to reset vectors to default positions
  reset() {
    // Reset vector A
    this.vectorA = { x: 2, y: 0, z: 0 };
    this.scene.remove(this.vectorAObject);
    this.vectorAObject = this.createVector(
      this.vectorA.x, this.vectorA.y, this.vectorA.z,
      0xff0000,
      'A'
    );
    this.scene.add(this.vectorAObject);

    // Reset vector B
    this.vectorB = { x: 0, y: 2, z: 0 };
    this.scene.remove(this.vectorBObject);
    this.vectorBObject = this.createVector(
      this.vectorB.x, this.vectorB.y, this.vectorB.z,
      0x00ff00,
      'B'
    );
    this.scene.add(this.vectorBObject);

    // Update cross product
    this.updateCrossProduct();
  }

  // Public method to demonstrate the right-hand rule
  demonstrateRightHandRule() {
    // Store original positions
    const originalA = { ...this.vectorA };
    const originalB = { ...this.vectorB };

    // Start animation sequence
    let animationStep = 0;
    const totalSteps = 100;
    const animationDuration = 3000; // 3 seconds
    const stepTime = animationDuration / totalSteps;

    const animate = () => {
      if (animationStep >= totalSteps) {
        // Reset to original positions when done
        this.vectorA = { ...originalA };
        this.vectorB = { ...originalB };

        // Update vectors
        this.scene.remove(this.vectorAObject);
        this.vectorAObject = this.createVector(
          this.vectorA.x, this.vectorA.y, this.vectorA.z,
          0xff0000,
          'A'
        );
        this.scene.add(this.vectorAObject);

        this.scene.remove(this.vectorBObject);
        this.vectorBObject = this.createVector(
          this.vectorB.x, this.vectorB.y, this.vectorB.z,
          0x00ff00,
          'B'
        );
        this.scene.add(this.vectorBObject);

        // Update cross product
        this.updateCrossProduct();
        return;
      }

      // Calculate progress (0 to 1)
      const progress = animationStep / totalSteps;

      // Use a different animation curve for smoother motion
      const easedProgress = 0.5 - 0.5 * Math.cos(progress * Math.PI);

      // Animate vectors to demonstrate right-hand rule
      // First align vectors with X and Y axes
      if (progress < 0.3) {
        const p = progress / 0.3;
        this.vectorA = {
          x: 2,
          y: originalA.y * (1 - p),
          z: originalA.z * (1 - p)
        };

        this.vectorB = {
          x: originalB.x * (1 - p),
          y: 2,
          z: originalB.z * (1 - p)
        };
      }
      // Then rotate them to show curling of fingers
      else if (progress < 0.7) {
        const p = (progress - 0.3) / 0.4;
        const angle = p * Math.PI / 2;

        this.vectorA = {
          x: 2 * Math.cos(angle),
          y: 2 * Math.sin(angle),
          z: 0
        };
      }
      // Finally show thumb pointing in Z direction
      else {
        const p = (progress - 0.7) / 0.3;
        this.vectorA = {
          x: 2 * Math.cos(Math.PI/2),
          y: 2 * Math.sin(Math.PI/2),
          z: 0
        };

        this.vectorB = {
          x: 0,
          y: 2,
          z: 0
        };
      }

      // Update vectors
      this.scene.remove(this.vectorAObject);
      this.vectorAObject = this.createVector(
        this.vectorA.x, this.vectorA.y, this.vectorA.z,
        0xff0000,
        'A'
      );
      this.scene.add(this.vectorAObject);

      this.scene.remove(this.vectorBObject);
      this.vectorBObject = this.createVector(
        this.vectorB.x, this.vectorB.y, this.vectorB.z,
        0x00ff00,
        'B'
      );
      this.scene.add(this.vectorBObject);

      // Update cross product
      this.updateCrossProduct();

      // Increment step
      animationStep++;

      // Continue animation
      setTimeout(animate, stepTime);
    };

    // Start animation
    animate();
  }
}

// Export for module usage
export function initialize(containerId, options = {}) {
  const visualization = new CrossProductVisualization(containerId);
  return visualization;
}

// For backwards compatibility with non-module loading
if (typeof window !== 'undefined') {
  window.initializeCrossProductVisualization = function(containerId) {
    return initialize(containerId);
  };
}