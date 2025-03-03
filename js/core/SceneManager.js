export class SceneManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);

        this.initScene();
        this.initPhysics();
        this.initRenderer();
        this.initCamera();

        this.onWindowResize();
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
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    update() {
        // Update physics
        this.world.step(1/60);

        // Render scene
        this.renderer.render(this.scene, this.camera);
    }
}