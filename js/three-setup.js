import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Make THREE available globally for legacy code
window.THREE = THREE;
window.OrbitControls = OrbitControls;


import '../node_modules/@phosphor-icons/web/src/regular/style.css';

console.log('THREE.js setup complete:', THREE.REVISION);
