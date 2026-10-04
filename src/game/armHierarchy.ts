import * as THREE from 'three';
import { loadGlbHandTemplate, createRiggedGlbHand, GlbRiggedHand, setHandFingerCurls } from './glbHandRig';

export interface ArmMeshes {
  leftArmGroup: THREE.Group;
  rightArmGroup: THREE.Group;
  leftHandRig: GlbRiggedHand | null;
  rightHandRig: GlbRiggedHand | null;
}

export function buildPlayerArmHierarchy(camera: THREE.PerspectiveCamera): ArmMeshes {
  // Left Floating Hand Group
  const leftArmGroup = new THREE.Group();
  leftArmGroup.position.set(-0.20, -0.22, -0.38);
  camera.add(leftArmGroup);

  // Right Floating Hand Group
  const rightArmGroup = new THREE.Group();
  rightArmGroup.position.set(0.20, -0.22, -0.38);
  camera.add(rightArmGroup);

  const meshes: ArmMeshes = {
    leftArmGroup,
    rightArmGroup,
    leftHandRig: null,
    rightHandRig: null,
  };

  // Asynchronously load the official the_hand.glb with complete skeleton rig
  loadGlbHandTemplate().then((template) => {
    const leftHand = createRiggedGlbHand(template, true);
    const rightHand = createRiggedGlbHand(template, false);

    leftArmGroup.add(leftHand.model);
    rightArmGroup.add(rightHand.model);

    // Initial neutral posture: fingers slightly curled in relaxed combat stance
    setHandFingerCurls(leftHand, { thumb: 0.6, index: 0.65, middle: 0.65, ring: 0.65, pinky: 0.65 });
    setHandFingerCurls(rightHand, { thumb: 0.6, index: 0.65, middle: 0.65, ring: 0.65, pinky: 0.65 });

    meshes.leftHandRig = leftHand;
    meshes.rightHandRig = rightHand;
  }).catch((err) => {
    console.error('Failed to load the_hand.glb skeleton:', err);
  });

  return meshes;
}
