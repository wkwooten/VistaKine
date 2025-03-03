export class SceneManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);

        // If container doesn't exist, create a dummy container and bail out
        if (!this.container) {
            console.warn(`SceneManager: Container with ID "${containerId}" not found. Creating dummy container.`);
            this.createDummyContainer();
            return;
        }

        this.initScene();
        this.initPhysics();
        this.initRenderer();
        this.initCamera();

        this.onWindowResize();
    }

    // Create a hidden placeholder container when on pages without 3D scenes
    createDummyContainer() {
        // Create a placeholder invisible div
        this.container = document.createElement('div');
        this.container.id = 'scene-container-placeholder';
        this.container.style.width = '0px';
        this.container.style.height = '0px';
        this.container.style.position = 'absolute';
        this.container.style.visibility = 'hidden';
        document.body.appendChild(this.container);

        // Create stub methods that do nothing
        this.renderer = {
            render: () => {},
            setSize: () => {},
            setPixelRatio: () => {},
            domElement: document.createElement('canvas')
        };

        this.camera = {
            aspect: 1,
            updateProjectionMatrix: () => {}
        };

        this.scene = {};
        this.world = { step: () => {} };
    }

    initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf8f8f8);
    }

    initPhysics() {
        this.world = new CANNON.World();
        this.world.gravity.set(0, -9.82, 0);
    }

    initRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);
    }

    initCamera() {
        this.camera = new THREE.PerspectiveCamera(
            75,
            this.container.clientWidth / this.container.clientHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 2, 5);
        this.camera.lookAt(0, 0, 0);
    }

    onWindowResize() {
        // Skip resize if using dummy container
        if (this.container.id === 'scene-container-placeholder') return;

        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    update() {
        // Skip update if using dummy container
        if (this.container.id === 'scene-container-placeholder') return;

        // Update physics
        this.world.step(1/60);

        // Render scene
        this.renderer.render(this.scene, this.camera);
    }
}