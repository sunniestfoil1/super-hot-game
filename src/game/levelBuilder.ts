import * as THREE from 'three';
import { LevelConfig } from './types';
import { buildIndustrialLevelEnvironment } from './industrialMapLoader';

export const buildLevelEnvironment = async (
  worldGroup: THREE.Group,
  config: LevelConfig
): Promise<THREE.Box3[]> => {
  if (config.useIndustrialModel) {
    return await buildIndustrialLevelEnvironment(worldGroup);
  }

  const wallBoxes: THREE.Box3[] = [];

  while (worldGroup.children.length > 0) {
    worldGroup.remove(worldGroup.children[0]);
  }

  // Floor — concreto claro com resposta especular sutil
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xd4d0c8,
    roughness: 0.68,
    metalness: 0.08,
  });

  // Walls — off-white matte elegante
  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xede9e3,
    roughness: 0.85,
    metalness: 0.0,
  });

  // Columns & Beams — com contraste arquitetônico sutil
  const columnMat = new THREE.MeshStandardMaterial({
    color: 0xe2ded7,
    roughness: 0.72,
    metalness: 0.05,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xb8cce0,
    roughness: 0.08,
    metalness: 0.15,
    transparent: true,
    opacity: 0.35,
  });

  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x8a8e96,
    roughness: 0.30,
    metalness: 0.82,
  });

  // Obstáculos — cinza escuro de alta leitura (#282a30), sem preto puro esmagado
  const darkObstacleMat = new THREE.MeshStandardMaterial({
    color: 0x282a30,
    roughness: 0.42,
    metalness: 0.35,
  });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  worldGroup.add(floor);

  // Faixas de luz solar no chão (janelas) — projeção física refinada
  const lightBandMat = new THREE.MeshBasicMaterial({
    color: 0xfffcf5,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  for (let i = -4; i <= 4; i++) {
    const band = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 32), lightBandMat);
    band.rotation.x = -Math.PI / 2;
    band.position.set(i * 5.5, 0.012, -2);
    worldGroup.add(band);
  }
  // Faixas transversais mais curtas
  for (let i = -3; i <= 2; i++) {
    const band = new THREE.Mesh(new THREE.PlaneGeometry(20, 1.8), lightBandMat.clone());
    band.rotation.x = -Math.PI / 2;
    band.position.set(0, 0.013, i * 7 - 4);
    worldGroup.add(band);
  }

  // Teto arquitetônico
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), whiteMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 7;
  ceiling.receiveShadow = true;
  worldGroup.add(ceiling);

  // Detalhes Arquitetônicos: Pilares regulares e molduras nas paredes para estabelecer escala e composição
  const pillarGeo = new THREE.BoxGeometry(0.4, 7, 0.4);
  for (let z = -25; z <= 25; z += 6.5) {
    // Pilares esquerdos
    const pLeft = new THREE.Mesh(pillarGeo, columnMat);
    pLeft.position.set(-9.8, 3.5, z);
    pLeft.castShadow = true;
    pLeft.receiveShadow = true;
    worldGroup.add(pLeft);

    // Pilares direitos
    const pRight = new THREE.Mesh(pillarGeo, columnMat);
    pRight.position.set(9.8, 3.5, z);
    pRight.castShadow = true;
    pRight.receiveShadow = true;
    worldGroup.add(pRight);
  }

  // Vigas superiores do teto
  const beamGeo = new THREE.BoxGeometry(20, 0.35, 0.35);
  for (let z = -25; z <= 25; z += 6.5) {
    const beam = new THREE.Mesh(beamGeo, columnMat);
    beam.position.set(0, 6.8, z);
    beam.castShadow = true;
    beam.receiveShadow = true;
    worldGroup.add(beam);
  }

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
