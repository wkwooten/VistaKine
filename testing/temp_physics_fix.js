// Fixed switch statement for accurate collision shapes
switch(type) {
    case 'sphere':
        geometry = new THREE.SphereGeometry(size, 16, 16);
        shape = new CANNON.Sphere(size);
        break;
    case 'tetrahedron':
        geometry = new THREE.TetrahedronGeometry(size);
        geometry.computeVertexNormals();
        shape = this.createConvexPolyhedron(geometry, 1);
        break;
    case 'octahedron':
        geometry = new THREE.OctahedronGeometry(size);
        geometry.computeVertexNormals();
        shape = this.createConvexPolyhedron(geometry, 1);
        break;
    case 'dodecahedron':
        geometry = new THREE.DodecahedronGeometry(size);
        geometry.computeVertexNormals();
        shape = this.createConvexPolyhedron(geometry, 1);
        break;
    case 'cube':
    default:
        geometry = new THREE.BoxGeometry(size, size, size);
        shape = new CANNON.Box(new CANNON.Vec3(size/2, size/2, size/2));
        break;
}