const fs = require('fs');
const THREE = require('three');
const { GLTFLoader } = require('three/examples/jsm/loaders/GLTFLoader.js');

global.THREE = THREE;
global.self = global;
global.window = global;
global.document = { createElement: () => ({}), createElementNS: () => ({}) };
global.URL = { createObjectURL: () => '', revokeObjectURL: () => '' };

const fileData = fs.readFileSync('public/models/low-poly_industrial_building.glb');
const arrayBuffer = fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength);

const loader = new GLTFLoader();
loader.parse(arrayBuffer, '', (gltf) => {
  const scene = gltf.scene;
  // Center scene
  const box = new THREE.Box3().setFromObject(scene);
  const center = new THREE.Vector3();
  box.getCenter(center);
  console.log('Original Center:', center);
  
  // Find stairs or inclined planes or floor layers by analyzing Y-distribution of vertices
  scene.traverse((child) => {
    if (child.isMesh) {
      const posAttr = child.geometry.attributes.position;
      const ys = [];
      for (let i = 0; i < posAttr.count; i++) {
        const y = posAttr.getY(i) - center.y;
        ys.push(y);
      }
      ys.sort((a, b) => a - b);
      console.log(`\nMesh ${child.name} Y range centered: min=${ys[0].toFixed(2)}, max=${ys[ys.length-1].toFixed(2)}`);
      
      // Histogram of Y values
      const histogram = {};
      ys.forEach(y => {
        const step = (Math.round(y * 2) / 2).toFixed(1);
        histogram[step] = (histogram[step] || 0) + 1;
      });
      console.log('Y Levels (step 0.5):', Object.keys(histogram).filter(k => histogram[k] > 20).map(k => `${k}m (${histogram[k]} verts)`).join(', '));
    }
  });

  // Extract precise collision boxes per mesh
  const extractedData = {
    modelCenter: [center.x, center.y, center.z],
    bounds: { min: [box.min.x - center.x, box.min.y - center.y, box.min.z - center.z], max: [box.max.x - center.x, box.max.y - center.y, box.max.z - center.z] },
    floors: [-5.0, 0.0, 5.0], // 3 Layers of height
    stairs: [],
    structures: []
  };

  // Traversal to extract boxes
  scene.traverse((child) => {
    if (child.isMesh) {
      child.geometry.computeBoundingBox();
      const b = child.geometry.boundingBox;
      extractedData.structures.push({
        name: child.name,
        min: [b.min.x - center.x, b.min.y - center.y, b.min.z - center.z],
        max: [b.max.x - center.x, b.max.y - center.y, b.max.z - center.z]
      });
    }
  });

  fs.writeFileSync('src/game/industrial_map_data.json', JSON.stringify(extractedData, null, 2));
  console.log('\nWrote src/game/industrial_map_data.json successfully!');
});
