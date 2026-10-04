const fs = require('fs');
const THREE = require('three');
const { GLTFLoader } = require('three/examples/jsm/loaders/GLTFLoader.js');

// Mock DOM/FileReader for THREE GLTFLoader in Node
global.THREE = THREE;
global.self = global;
global.window = global;
global.document = {
  createElement: () => ({}),
  createElementNS: () => ({}),
};
global.URL = { createObjectURL: () => '', revokeObjectURL: () => '' };

const fileData = fs.readFileSync('public/models/low-poly_industrial_building.glb');
const arrayBuffer = fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength);

const loader = new GLTFLoader();
loader.parse(arrayBuffer, '', (gltf) => {
  console.log('--- Industrial Building GLB Hierarchy ---');
  const meshes = [];
  let totalTriangles = 0;

  gltf.scene.traverse((child) => {
    if (child.isMesh) {
      const box = new THREE.Box3().setFromObject(child);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);
      
      const count = child.geometry.index
        ? child.geometry.index.count / 3
        : child.geometry.attributes.position.count / 3;
      totalTriangles += count;

      meshes.push({
        name: child.name,
        tris: count,
        center: [center.x.toFixed(2), center.y.toFixed(2), center.z.toFixed(2)],
        size: [size.x.toFixed(2), size.y.toFixed(2), size.z.toFixed(2)],
        minY: box.min.y.toFixed(2),
        maxY: box.max.y.toFixed(2),
      });
    }
  });

  const overallBox = new THREE.Box3().setFromObject(gltf.scene);
  const overallSize = new THREE.Vector3();
  overallBox.getSize(overallSize);
  const overallCenter = new THREE.Vector3();
  overallBox.getCenter(overallCenter);

  console.log('Overall Box Min:', overallBox.min, 'Max:', overallBox.max);
  console.log('Overall Size:', overallSize);
  console.log('Total Meshes:', meshes.length, 'Total Triangles:', totalTriangles);

  console.log('\n--- Meshes Detail ---');
  meshes.forEach((m, i) => {
    console.log(`[${i}] ${m.name} | tris: ${m.tris} | center: ${m.center} | size: ${m.size} | Y: [${m.minY}..${m.maxY}]`);
  });
}, (err) => {
  console.error('Error parsing GLB:', err);
});
