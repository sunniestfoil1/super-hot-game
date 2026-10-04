import * as THREE from 'three';
import dollyData from './garrafa_de_dolly.json';
import knifeData from './valorants_knife_low_poly.json';
import eyeData from './procedural_eyes_for_ray_ii.json';

export const createGlbBottleGeometry = (): THREE.BufferGeometry => {
  if (dollyData && dollyData.positions && dollyData.positions.length > 0) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(dollyData.positions, 3));
    if (dollyData.normals && dollyData.normals.length > 0) {
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(dollyData.normals, 3));
    } else {
      geo.computeVertexNormals();
    }
    geo.scale(0.003, 0.003, 0.003);
    return geo;
  }
  return new THREE.CylinderGeometry(0.06, 0.06, 0.32, 8);
};

export const createGlbKnifeGeometry = (): THREE.BufferGeometry => {
  if (knifeData && knifeData.positions && knifeData.positions.length > 0) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(knifeData.positions, 3));
    if (knifeData.normals && knifeData.normals.length > 0) {
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(knifeData.normals, 3));
    } else {
      geo.computeVertexNormals();
    }
    geo.scale(0.012, 0.012, 0.012);
    return geo;
  }
  return new THREE.BoxGeometry(0.04, 0.28, 0.03);
};

export const createGlbEyeGeometry = (): THREE.BufferGeometry => {
  if (eyeData && eyeData.positions && eyeData.positions.length > 0) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(eyeData.positions, 3));
    if (eyeData.normals && eyeData.normals.length > 0) {
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(eyeData.normals, 3));
    } else {
      geo.computeVertexNormals();
    }
    geo.scale(0.008, 0.008, 0.008);
    return geo;
  }
  return new THREE.SphereGeometry(0.04, 8, 8);
};

import shotgunData from './shotgun_model.json';
import uziData from './uzi_model.json';

export const createGlbShotgunGeometry = (): THREE.BufferGeometry => {
  if (shotgunData && shotgunData.positions && shotgunData.positions.length > 0) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(shotgunData.positions, 3));
    if (shotgunData.normals && shotgunData.normals.length > 0) {
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(shotgunData.normals, 3));
    } else {
      geo.computeVertexNormals();
    }
    // Center model at origin: center is [-2.51, 0.01, 2.81]
    geo.translate(2.51, -0.01, -2.81);
    // Rotate so barrel points forward (-Z)
    geo.rotateX(-Math.PI / 2);
    // Scale length to realistic shotgun size (~0.85m)
    geo.scale(0.12, 0.12, 0.12);
    return geo;
  }
  return new THREE.BoxGeometry(0.1, 0.16, 0.85);
};

export const createGlbUziGeometry = (): THREE.BufferGeometry => {
  if (uziData && uziData.positions && uziData.positions.length > 0) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(uziData.positions, 3));
    if (uziData.normals && uziData.normals.length > 0) {
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(uziData.normals, 3));
    } else {
      geo.computeVertexNormals();
    }
    // Center model: center is [0.55, 0.13, 0.00]
    geo.translate(-0.55, -0.13, 0);
    // In Uzi model, X is along length. Rotate so barrel points -Z
    geo.rotateY(Math.PI / 2);
    // Scale to compact SMG/Uzi size (~0.38m)
    geo.scale(0.15, 0.15, 0.15);
    return geo;
  }
  return new THREE.BoxGeometry(0.08, 0.22, 0.38);
};
