import * as THREE from 'three';
import glbManData from './glbManData.json';
import glbBulletData from './glbBulletData.json';
import glbHandData from './glbHandData.json';
import { Enemy } from './types';

// Shared Anatomical Materials (Faceless Translucent Red Crystal with Faceted Gem Shine)
export const createEnemyMaterials = () => {
  const activeMat = new THREE.MeshStandardMaterial({
    color: 0xff002b,
    emissive: 0xff002b,
    emissiveIntensity: 1.45,
    roughness: 0.18,
    metalness: 0.82,
    transparent: false,
    flatShading: true,
  });

  const stunnedMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    emissive: 0x475569,
    emissiveIntensity: 0.45,
    roughness: 0.6,
    metalness: 0.3,
    transparent: false,
    flatShading: true,
  });

  return { activeMat, stunnedMat };
};

export const applyEnemyMaterial = (enemy: Enemy, mat: THREE.Material) => {
  enemy.head.material = mat;
  enemy.neck.material = mat;
  enemy.chest.material = mat;
  enemy.waist.material = mat;
  enemy.leftUpperArm.material = mat;
  enemy.leftForearm.material = mat;
  enemy.rightUpperArm.material = mat;
  enemy.rightForearm.material = mat;
  enemy.leftThigh.material = mat;
  enemy.leftCalf.material = mat;
  enemy.rightThigh.material = mat;
  enemy.rightCalf.material = mat;
};

export const createGlbPartGeometry = (
  partName: string,
  fallbackGeo: () => THREE.BufferGeometry
): THREE.BufferGeometry => {
  const data = (glbManData as Record<string, { positions: number[]; normals: number[] }>)[partName];
  if (data && data.positions && data.positions.length > 0) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
    if (data.normals && data.normals.length > 0) {
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
    } else {
      geo.computeVertexNormals();
    }
    return geo;
  }
  return fallbackGeo();
};

const sharedNativeBulletGeo = new THREE.CylinderGeometry(0.025, 0.045, 0.35, 8);
sharedNativeBulletGeo.rotateX(Math.PI / 2); // Align forward along Z axis

export const createGlbBulletGeometry = (): THREE.BufferGeometry => {
  return sharedNativeBulletGeo;
};

export const createGlbHandGeometry = (): THREE.BufferGeometry => {
  if (glbHandData && glbHandData.positions && glbHandData.positions.length > 0) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(glbHandData.positions, 3));
    if (glbHandData.normals && glbHandData.normals.length > 0) {
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(glbHandData.normals, 3));
    } else {
      geo.computeVertexNormals();
    }
    return geo;
  }
  return new THREE.BoxGeometry(0.14, 0.14, 0.24);
};
