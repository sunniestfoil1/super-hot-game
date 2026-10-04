import * as THREE from 'three';
import handAnatomyData from './handAnatomyData.json';

export interface AnatomicHandMeshes {
  geometry: THREE.BufferGeometry;
  basePositions: Float32Array;
  currentPositions: Float32Array;
  vertexBones: number[];
}

/**
 * Creates anatomically deforming hand geometry with distinct finger flexions
 * (Thumb, Index, Middle, Ring, Pinky, and Palm)
 */
export function createAnatomicHand(): AnatomicHandMeshes {
  const geo = new THREE.BufferGeometry();
  const basePositions = new Float32Array(handAnatomyData.positions);
  const currentPositions = new Float32Array(handAnatomyData.positions);
  const normals = new Float32Array(handAnatomyData.normals);
  const vertexBones = handAnatomyData.vertexBones;

  geo.setAttribute('position', new THREE.BufferAttribute(currentPositions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  if (handAnatomyData.indices && handAnatomyData.indices.length > 0) {
    geo.setIndex(handAnatomyData.indices);
  }

  return {
    geometry: geo,
    basePositions,
    currentPositions,
    vertexBones,
  };
}

export interface FingerCurlFactors {
  thumb: number;  // 0 (open) to 1 (fully clenched)
  index: number;
  middle: number;
  ring: number;
  pinky: number;
}

/**
 * Anatomic vertex deformation applying physiological joint rotation
 */
export function deformHandFingers(
  hand: AnatomicHandMeshes,
  curls: FingerCurlFactors
) {
  const { basePositions, currentPositions, vertexBones, geometry } = hand;

  for (let i = 0; i < vertexBones.length; i++) {
    const bone = vertexBones[i];
    const idx = i * 3;
    const bx = basePositions[idx];
    const by = basePositions[idx + 1];
    const bz = basePositions[idx + 2];

    let curl = 0;
    // 5..8: Index
    if (bone >= 5 && bone <= 8) curl = curls.index;
    // 9..12: Middle
    else if (bone >= 9 && bone <= 12) curl = curls.middle;
    // 13..16: Ring
    else if (bone >= 13 && bone <= 16) curl = curls.ring;
    // 17..20: Pinky
    else if (bone >= 17 && bone <= 20) curl = curls.pinky;
    // 21..24: Thumb
    else if (bone >= 21 && bone <= 24) curl = curls.thumb;

    if (curl === 0) {
      currentPositions[idx] = bx;
      currentPositions[idx + 1] = by;
      currentPositions[idx + 2] = bz;
    } else {
      // Natural biomechanical inward knuckle curl
      const angle = curl * 1.35;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // Pivot around finger base
      const localZ = bz;
      const localY = by;
      currentPositions[idx] = bx;
      currentPositions[idx + 1] = localY * cosA - localZ * sinA;
      currentPositions[idx + 2] = localY * sinA + localZ * cosA;
    }
  }

  geometry.attributes.position.needsUpdate = true;
  geometry.computeVertexNormals();
}
