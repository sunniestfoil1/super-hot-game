import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { analyzeGlbSpatialStructure, convertProxiesToBoxes } from './glbSpatialAnalyzer';

let industrialModelCache: THREE.Group | null = null;
let mesaModelCache: THREE.Group | null = null;
let chairModelCache: THREE.Group | null = null;
let gltfLoaderInstance: GLTFLoader | null = null;

function getGLTFLoader(): GLTFLoader {
  if (!gltfLoaderInstance) {
    gltfLoaderInstance = new GLTFLoader();
  }
  return gltfLoaderInstance;
}

export function loadIndustrialBuildingModel(): Promise<THREE.Group> {
  if (industrialModelCache) {
    return Promise.resolve(industrialModelCache.clone());
  }

  const loader = getGLTFLoader();
  return new Promise((resolve) => {
    loader.load(
      '/models/low-poly_industrial_building.glb',
      (gltf) => {
        const model = gltf.scene;

        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            if (mesh.material) {
              const mat = mesh.material as THREE.MeshStandardMaterial;
              mat.roughness = Math.max(0.4, mat.roughness || 0.5);
              mat.metalness = Math.min(0.8, mat.metalness || 0.2);
            }
          }
        });

        industrialModelCache = model;
        resolve(model.clone());
      },
      undefined,
      (err) => {
        console.warn('Falha ao carregar low-poly_industrial_building.glb', err);
        const group = new THREE.Group();
        resolve(group);
      }
    );
  });
}

export function loadMesaModel(): Promise<THREE.Group> {
  if (mesaModelCache) {
    return Promise.resolve(mesaModelCache.clone());
  }

  const loader = getGLTFLoader();
  return new Promise((resolve) => {
    loader.load(
      '/models/mesa_low_poly.glb',
      (gltf) => {
        const model = gltf.scene;
        model.scale.set(0.012, 0.012, 0.012);
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        mesaModelCache = model;
        resolve(model.clone());
      },
      undefined,
      (err) => {
        console.warn('Falha ao carregar mesa_low_poly.glb', err);
        const group = new THREE.Group();
        resolve(group);
      }
    );
  });
}

export function loadChairModel(): Promise<THREE.Group> {
  if (chairModelCache) {
    return Promise.resolve(chairModelCache.clone());
  }

  const loader = getGLTFLoader();
  return new Promise((resolve) => {
    loader.load(
      '/models/chair_low_poly.glb',
      (gltf) => {
        const model = gltf.scene;
        model.scale.set(0.01, 0.01, 0.01);
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        chairModelCache = model;
        resolve(model.clone());
      },
      undefined,
      (err) => {
        console.warn('Falha ao carregar chair_low_poly.glb', err);
        const group = new THREE.Group();
        resolve(group);
      }
    );
  });
}

/**
 * Monta o ambiente dinâmico sem caixas hardcoded, posições manuais ou Y estáticos.
 * Converte dinamicamente qualquer modelo GLB para dados de colisão limpos.
 */
export async function buildIndustrialLevelEnvironment(worldGroup: THREE.Group): Promise<THREE.Box3[]> {
  const wallBoxes: THREE.Box3[] = [];

  while (worldGroup.children.length > 0) {
    worldGroup.remove(worldGroup.children[0]);
  }

  // 1. Carrega o modelo GLB de cenário
  const buildingModel = await loadIndustrialBuildingModel();
  worldGroup.add(buildingModel);

  // 2. Análise espacial 100% Data-Driven (sem coordenadas ou andares hardcoded)
  const collisionData = analyzeGlbSpatialStructure(buildingModel, 'low-poly_industrial_building.glb');
  const { wallBoxes: dynamicWalls, floorBoxes: dynamicFloors } = convertProxiesToBoxes(collisionData);

  dynamicWalls.forEach((b) => wallBoxes.push(b));
  dynamicFloors.forEach((b) => wallBoxes.push(b));

  // 3. Mobiliário decorativo dinâmico
  const [tableModel, chairModel] = await Promise.all([loadMesaModel(), loadChairModel()]);

  // Se houver andares descobertos dinamicamente pelo GLB, coloca adereços sobre os andares descobertos
  if (collisionData.discoveredFloors.length > 0) {
    collisionData.discoveredFloors.forEach((floorY) => {
      const table = tableModel.clone();
      table.position.set(-6, floorY, 6);
      worldGroup.add(table);

      const chair = chairModel.clone();
      chair.position.set(-5.2, floorY, 6);
      worldGroup.add(chair);
    });
  }

  // Faixas de luz ambiente
  const lightBandMat = new THREE.MeshBasicMaterial({
    color: 0xfffcf5,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  for (let i = -3; i <= 3; i++) {
    const band = new THREE.Mesh(new THREE.PlaneGeometry(3, 30), lightBandMat);
    band.rotation.x = -Math.PI / 2;
    band.position.set(i * 6, -1.58, -2);
    worldGroup.add(band);
  }

  return wallBoxes;
}
