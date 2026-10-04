import * as THREE from 'three';

export interface CollisionProxyData {
  id: string;
  type: 'floor' | 'wall' | 'pillar' | 'stair';
  min: [number, number, number];
  max: [number, number, number];
}

export interface MapCollisionJson {
  version: number;
  source: string;
  discoveredFloors: number[];
  proxies: CollisionProxyData[];
  telemetry: {
    nodesCount: number;
    meshesCount: number;
    trianglesCount: number;
    floorsCount: number;
    wallsCount: number;
    pillarsCount: number;
    ignoredDecorCount: number;
  };
}

/**
 * GLB SPATIAL ANALYZER & TRIANGLE SURFACE CLUSTERING (DATA-DRIVEN)
 * Analisa dinamicamente a malha do GLB por camadas de altura (tiers) e orientação de superfícies.
 * Elimina volumes que ultrapassam telhados e preserva portas, janelas e vãos abertos.
 */
export function analyzeGlbSpatialStructure(glbGroup: THREE.Group, sourceName = 'map.glb'): MapCollisionJson {
  let nodesCount = 0;
  let meshesCount = 0;
  let trianglesCount = 0;
  let ignoredDecorCount = 0;

  glbGroup.updateMatrixWorld(true);

  const horizontalVertices: THREE.Vector3[] = [];
  const verticalTriangles: { v0: THREE.Vector3; v1: THREE.Vector3; v2: THREE.Vector3; normal: THREE.Vector3 }[] = [];
  const glbMeshes: THREE.Mesh[] = [];

  const tempV0 = new THREE.Vector3();
  const tempV1 = new THREE.Vector3();
  const tempV2 = new THREE.Vector3();
  const tempNormal = new THREE.Vector3();

  glbGroup.traverse((obj) => {
    nodesCount++;
    // Extração de Metadados do GLB Toolkit (node.userData / node.extras)
    if (obj.userData && Object.keys(obj.userData).length > 0) {
      console.log(`[GLB METADATA TOOLKIT] Nó "${obj.name}" possui metadados extras:`, obj.userData);
    }

    if ((obj as THREE.Mesh).isMesh) {
      meshesCount++;
      const mesh = obj as THREE.Mesh;
      if (!mesh.geometry) return;

      glbMeshes.push(mesh);
      const geo = mesh.geometry;
      const posAttr = geo.attributes.position;
      const normAttr = geo.attributes.normal;
      const index = geo.index;
      const matrix = mesh.matrixWorld;

      if (!posAttr) return;

      const numTriangles = index ? index.count / 3 : posAttr.count / 3;
      trianglesCount += numTriangles;

      for (let i = 0; i < numTriangles; i++) {
        let i0 = i * 3;
        let i1 = i * 3 + 1;
        let i2 = i * 3 + 2;
        if (index) {
          i0 = index.getX(i0);
          i1 = index.getX(i1);
          i2 = index.getX(i2);
        }

        tempV0.fromBufferAttribute(posAttr, i0).applyMatrix4(matrix);
        tempV1.fromBufferAttribute(posAttr, i1).applyMatrix4(matrix);
        tempV2.fromBufferAttribute(posAttr, i2).applyMatrix4(matrix);

        if (normAttr) {
          tempNormal.fromBufferAttribute(normAttr, i0).transformDirection(matrix).normalize();
        } else {
          // Normal calculada por produto vetorial se ausente
          const edge1 = tempV1.clone().sub(tempV0);
          const edge2 = tempV2.clone().sub(tempV0);
          tempNormal.crossVectors(edge1, edge2).normalize();
        }

        if (Math.abs(tempNormal.y) > 0.75) {
          horizontalVertices.push(tempV0.clone());
        } else if (Math.abs(tempNormal.y) < 0.35) {
          // Triângulo vertical (parede/pilar)
          verticalTriangles.push({
            v0: tempV0.clone(),
            v1: tempV1.clone(),
            v2: tempV2.clone(),
            normal: tempNormal.clone(),
          });
        }
      }
    }
  });

  // 1. DESCOBERTA DINÂMICA DE ANDARES (Histograma de Altura Y)
  const floorBucketMap = new Map<number, number>();
  horizontalVertices.forEach((v) => {
    const roundedY = Math.round(v.y * 10) / 10;
    floorBucketMap.set(roundedY, (floorBucketMap.get(roundedY) || 0) + 1);
  });

  const discoveredFloors: number[] = [];
  floorBucketMap.forEach((count, y) => {
    if (count > 40) {
      discoveredFloors.push(y);
    }
  });
  discoveredFloors.sort((a, b) => a - b);

  if (discoveredFloors.length === 0) {
    discoveredFloors.push(0);
  }

  // 2. GERAÇÃO DE PROXIES DATA-DRIVEN POR CAMADA DE ALTURA (TIERS)
  const proxies: CollisionProxyData[] = [];
  let proxyIdx = 0;

  // Analisar cada andar descoberto para limitar a altura das paredes ao andar correspondente
  for (let fIdx = 0; fIdx < discoveredFloors.length; fIdx++) {
    const currentFloorY = discoveredFloors[fIdx];
    const nextFloorY = fIdx < discoveredFloors.length - 1 ? discoveredFloors[fIdx + 1] : currentFloorY + 3.5;
    const tierHeight = Math.max(2.4, nextFloorY - currentFloorY);

    // Filtrar triângulos verticais pertencentes a esta camada de altura
    const tierTriangles = verticalTriangles.filter((t) => {
      const minY = Math.min(t.v0.y, t.v1.y, t.v2.y);
      return minY >= currentFloorY - 0.5 && minY < nextFloorY + 0.5;
    });

    if (tierTriangles.length === 0) continue;

    // Agrupar triângulos verticais em caixas justas por proximidade no plano horizontal (X/Z)
    const tierBoxes = clusterTrianglesToBoxes(tierTriangles, currentFloorY, tierHeight, () => `proxy_${++proxyIdx}`);
    tierBoxes.forEach((b) => proxies.push(b));
  }

  // 3. PROXIES DE PILARES E OBSTÁCULOS DISCRETOS
  glbMeshes.forEach((mesh) => {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const localBb = mesh.geometry.boundingBox;
    if (!localBb) return;

    const worldBox = new THREE.Box3().copy(localBb).applyMatrix4(mesh.matrixWorld);
    const dx = worldBox.max.x - worldBox.min.x;
    const dy = worldBox.max.y - worldBox.min.y;
    const dz = worldBox.max.z - worldBox.min.z;

    // Pilares e colunas pequenas (< 1.5m em X e Z)
    if (dy > 1.2 && dx <= 1.5 && dz <= 1.5) {
      proxies.push({
        id: `pillar_${++proxyIdx}`,
        type: 'pillar',
        min: [worldBox.min.x, worldBox.min.y, worldBox.min.z],
        max: [worldBox.max.x, worldBox.max.y, worldBox.max.z],
      });
    } else if (dy < 0.45 && dx > 0.8 && dz > 0.8) {
      // Pisos e passarelas
      proxies.push({
        id: `floor_${++proxyIdx}`,
        type: 'floor',
        min: [worldBox.min.x, worldBox.min.y, worldBox.min.z],
        max: [worldBox.max.x, worldBox.max.y, worldBox.max.z],
      });
    } else if (dx < 0.2 && dy < 0.2 && dz < 0.2) {
      ignoredDecorCount++;
    }
  });

  const floorsCount = proxies.filter((p) => p.type === 'floor').length;
  const wallsCount = proxies.filter((p) => p.type === 'wall').length;
  const pillarsCount = proxies.filter((p) => p.type === 'pillar').length;

  const result: MapCollisionJson = {
    version: 1,
    source: sourceName,
    discoveredFloors,
    proxies,
    telemetry: {
      nodesCount,
      meshesCount,
      trianglesCount,
      floorsCount,
      wallsCount,
      pillarsCount,
      ignoredDecorCount,
    },
  };

  console.log('[GLB SPATIAL ANALYZER] Análise concluída com sucesso:', result.telemetry);
  console.log('- Andares descobertos no GLB:', discoveredFloors);

  return result;
}

/**
 * Agrupa triângulos verticais de uma camada de altura específica em caixas de colisão justas (Wall Proxies).
 * Preserva portas, janelas e aberturas ao dividir painéis nos vãos livres.
 */
function clusterTrianglesToBoxes(
  triangles: { v0: THREE.Vector3; v1: THREE.Vector3; v2: THREE.Vector3; normal: THREE.Vector3 }[],
  floorY: number,
  tierHeight: number,
  idGen: () => string
): CollisionProxyData[] {
  const boxes: CollisionProxyData[] = [];
  if (triangles.length === 0) return boxes;

  // Grade de discretização horizontal (células de 1.0m x 1.0m)
  const cellGrid = new Map<string, { minX: number; maxX: number; minZ: number; maxZ: number }>();

  triangles.forEach((t) => {
    const minX = Math.min(t.v0.x, t.v1.x, t.v2.x);
    const maxX = Math.max(t.v0.x, t.v1.x, t.v2.x);
    const minZ = Math.min(t.v0.z, t.v1.z, t.v2.z);
    const maxZ = Math.max(t.v0.z, t.v1.z, t.v2.z);

    const cellX = Math.floor(minX / 1.5);
    const cellZ = Math.floor(minZ / 1.5);
    const key = `${cellX}_${cellZ}`;

    let cell = cellGrid.get(key);
    if (!cell) {
      cell = { minX, maxX, minZ, maxZ };
      cellGrid.set(key, cell);
    } else {
      cell.minX = Math.min(cell.minX, minX);
      cell.maxX = Math.max(cell.maxX, maxX);
      cell.minZ = Math.min(cell.minZ, minZ);
      cell.maxZ = Math.max(cell.maxZ, maxZ);
    }
  });

  // Converte células agrupadas em Box Colliders com a altura restrita à camada atual
  cellGrid.forEach((cell) => {
    const dx = cell.maxX - cell.minX;
    const dz = cell.maxZ - cell.minZ;

    // Espessura mínima de parede para estabilidade física
    const padX = dx < 0.3 ? (0.3 - dx) / 2 : 0;
    const padZ = dz < 0.3 ? (0.3 - dz) / 2 : 0;

    boxes.push({
      id: idGen(),
      type: 'wall',
      min: [cell.minX - padX, floorY, cell.minZ - padZ],
      max: [cell.maxX + padX, floorY + tierHeight, cell.maxZ + padZ],
    });
  });

  return boxes;
}

/**
 * Converte os dados estruturados de proxies para THREE.Box3 consumível pela física
 */
export function convertProxiesToBoxes(data: MapCollisionJson): { wallBoxes: THREE.Box3[]; floorBoxes: THREE.Box3[] } {
  const wallBoxes: THREE.Box3[] = [];
  const floorBoxes: THREE.Box3[] = [];

  data.proxies.forEach((p) => {
    const box = new THREE.Box3(new THREE.Vector3(...p.min), new THREE.Vector3(...p.max));
    if (p.type === 'floor') {
      floorBoxes.push(box);
    } else {
      wallBoxes.push(box);
    }
  });

  return { wallBoxes, floorBoxes };
}
