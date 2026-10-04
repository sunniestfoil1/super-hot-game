import * as THREE from 'three';
import { LevelConfig } from './types';

export const buildLevelEnvironment = (
  worldGroup: THREE.Group,
  config: LevelConfig
): THREE.Box3[] => {
  const wallBoxes: THREE.Box3[] = [];

  while (worldGroup.children.length > 0) {
    worldGroup.remove(worldGroup.children[0]);
  }

  // Floor — concreto claro (não branco estourado)
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xc8c4bc,
    roughness: 0.82,
    metalness: 0.02,
  });

  // Walls — off-white matte
  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xe8e4de,
    roughness: 0.9,
    metalness: 0.0,
  });

  const columnMat = new THREE.MeshStandardMaterial({
    color: 0xefebe4,
    roughness: 0.75,
    metalness: 0.03,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xc8d8e8,
    roughness: 0.05,
    metalness: 0.1,
    transparent: true,
    opacity: 0.32,
  });

  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x9a9ea6,
    roughness: 0.32,
    metalness: 0.78,
  });

  // Obstáculos — cinza escuro (#292929), NUNCA #000
  const darkObstacleMat = new THREE.MeshStandardMaterial({
    color: 0x292929,
    roughness: 0.55,
    metalness: 0.25,
  });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  worldGroup.add(floor);

  // Faixas de luz no chão (janelas) — leitura de escala/profundidade
  const lightBandMat = new THREE.MeshBasicMaterial({
    color: 0xfff8ee,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  for (let i = -4; i <= 4; i++) {
    const band = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 28), lightBandMat);
    band.rotation.x = -Math.PI / 2;
    band.position.set(i * 5.5, 0.012, -2);
    worldGroup.add(band);
  }
  // Faixas transversais mais curtas
  for (let i = -3; i <= 2; i++) {
    const band = new THREE.Mesh(new THREE.PlaneGeometry(18, 1.6), lightBandMat.clone());
    band.rotation.x = -Math.PI / 2;
    band.position.set(0, 0.013, i * 7 - 4);
    worldGroup.add(band);
  }

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), whiteMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 7;
  ceiling.receiveShadow = true;
  worldGroup.add(ceiling);

  config.structures.forEach((st) => {
    const geo = new THREE.BoxGeometry(...st.size);
    let mat: THREE.MeshStandardMaterial;
    if (st.type === 'pillar') {
      mat = columnMat;
    } else if (st.type === 'obstacle') {
      mat = darkObstacleMat;
    } else if (st.type === 'glass') {
      mat = glassMat;
    } else if (st.type === 'metal') {
      mat = metalMat;
    } else {
      mat = whiteMat;
    }

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...st.pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    worldGroup.add(mesh);
    wallBoxes.push(new THREE.Box3().setFromObject(mesh));
  });

  return wallBoxes;
};
