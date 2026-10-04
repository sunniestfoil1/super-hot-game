import * as THREE from 'three';
import { calculateEmoteTransforms, EmoteType } from './emoteAnimations';
import { GlbRiggedHand, setHandFingerCurls } from './glbHandRig';
import { WeaponType } from './types';
import { applyPistolRecoil, PistolInstance } from './pistolModel';
import { createEyeMesh } from './eyeModel';

interface AnimatePlayerArmsContext {
  hasGun: boolean;
  weaponType?: WeaponType | null;
  playerWeaponGroup: THREE.Group;
  playerLeftFistGroup: THREE.Group;
  playerRightFistGroup: THREE.Group;
  leftHandRig?: GlbRiggedHand | null;
  rightHandRig?: GlbRiggedHand | null;
  playerPistol?: PistolInstance | null;
  isMoving: boolean;
  currentTime: number;
  rawDt: number;
  recoilAmount: number;
  punchProgress: number;
  punchType: 'jab' | 'cross' | 'hook' | 'uppercut';
  activeEmote?: EmoteType;
  emoteProgress?: number;
  onPunchProgressUpdate: (newProgress: number, isPunching: boolean) => void;
  onRecoilUpdate: (newRecoil: number) => void;
}

let heldEyeL: THREE.Group | null = null;
let heldEyeR: THREE.Group | null = null;
let bloodDripsL: THREE.Mesh[] = [];
let bloodDripsR: THREE.Mesh[] = [];
let bloodDripGroupL: THREE.Group | null = null;
let bloodDripGroupR: THREE.Group | null = null;

const BLOOD_DRIP_COUNT = 10;
const BLOOD_DRIP_COLOR = 0x8a0005;

function createBloodDripGroup() {
  const group = new THREE.Group();
  const drops: THREE.Mesh[] = [];
  const geo = new THREE.PlaneGeometry(0.004, 0.018 + Math.random() * 0.018);
  const mat = new THREE.MeshBasicMaterial({
    color: BLOOD_DRIP_COLOR,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  for (let i = 0; i < BLOOD_DRIP_COUNT; i++) {
    const mesh = new THREE.Mesh(geo, mat.clone());
    mesh.visible = false;
    mesh.userData = {
      baseX: (Math.random() - 0.5) * 0.04,
      baseY: 0.02 + Math.random() * 0.04,
      baseZ: (Math.random() - 0.5) * 0.04,
      phase: Math.random() * Math.PI * 2,
      speed: 0.06 + Math.random() * 0.10,
      length: 0.012 + Math.random() * 0.018,
      delay: Math.random() * 0.25,
    };
    group.add(mesh);
    drops.push(mesh);
  }

  return { group, drops };
}

function ensureBloodDrips(leftFist: THREE.Group, rightFist: THREE.Group) {
  if (!bloodDripGroupL) {
    const l = createBloodDripGroup();
    bloodDripGroupL = l.group;
    bloodDripsL = l.drops;
    bloodDripGroupL.visible = false;
    leftFist.add(bloodDripGroupL);
  }
  if (!bloodDripGroupR) {
    const r = createBloodDripGroup();
    bloodDripGroupR = r.group;
    bloodDripsR = r.drops;
    bloodDripGroupR.visible = false;
    rightFist.add(bloodDripGroupR);
  }
}

function updateBloodDrips(
  drops: THREE.Mesh[],
  group: THREE.Group | null,
  time: number,
  emoteProgress: number,
  rawDt: number
) {
  if (!group) return;
  const active = emoteProgress >= 0.15 && emoteProgress < 0.95;
  group.visible = active;

  if (!active) {
    drops.forEach((m) => {
      m.visible = false;
    });
    return;
  }

  const localT = Math.max(0, (emoteProgress - 0.15) / 0.8);
  drops.forEach((m) => {
    const ud = m.userData as {
      baseX: number;
      baseY: number;
      baseZ: number;
      phase: number;
      speed: number;
      length: number;
      delay: number;
    };
    const dripProgress = Math.max(0, localT - ud.delay);
    if (dripProgress <= 0) {
      m.visible = false;
      return;
    }

    m.visible = true;
    const fall = Math.min(1, dripProgress * ud.speed);
    const stretch = 0.6 + fall * 2.2;
    m.position.set(
      ud.baseX + Math.sin(time * 0.002 + ud.phase) * 0.002,
      ud.baseY - fall * 0.12,
      ud.baseZ
    );
    m.scale.set(1, stretch, 1);
    const mat = Array.isArray(m.material) ? m.material[0] : m.material;
    if (mat) mat.opacity = Math.max(0, 0.9 * (1 - fall));
  });
}

function setBloodDripsVisible(visible: boolean) {
  if (bloodDripGroupL) bloodDripGroupL.visible = visible;
  if (bloodDripGroupR) bloodDripGroupR.visible = visible;
  if (!visible) {
    bloodDripsL.forEach((m) => (m.visible = false));
    bloodDripsR.forEach((m) => (m.visible = false));
  }
}

function ensureHeldEyes(leftFist: THREE.Group, rightFist: THREE.Group) {
  if (!heldEyeL) {
    heldEyeL = createEyeMesh('L', false);
    if (heldEyeL) {
      heldEyeL.position.set(0.02, 0.04, 0.06);
      heldEyeL.rotation.y = Math.PI;
      heldEyeL.visible = false;
      leftFist.add(heldEyeL);
    }
  }
  if (!heldEyeR) {
    heldEyeR = createEyeMesh('R', false);
    if (heldEyeR) {
      heldEyeR.position.set(-0.02, 0.04, 0.06);
      heldEyeR.rotation.y = Math.PI;
      heldEyeR.visible = false;
      rightFist.add(heldEyeR);
    }
  }
}

function setHeldEyesVisible(visible: boolean) {
  if (heldEyeL) heldEyeL.visible = visible;
  if (heldEyeR) heldEyeR.visible = visible;
}

export const animatePlayerArms = (ctx: AnimatePlayerArmsContext) => {
  const {
    hasGun,
    weaponType = 'pistol',
    playerWeaponGroup,
    playerLeftFistGroup,
    playerRightFistGroup,
    leftHandRig,
    rightHandRig,
    playerPistol = null,
    isMoving,
    currentTime,
    rawDt,
    recoilAmount,
    punchProgress,
    punchType,
    activeEmote = 'none',
    emoteProgress = 0,
    onPunchProgressUpdate,
    onRecoilUpdate,
  } = ctx;

  const isEmoting = activeEmote !== 'none' && emoteProgress > 0 && emoteProgress < 1;
  const isPunchActive = punchProgress > 0;
  const showWeapon = hasGun && !isEmoting && !isPunchActive;

  playerWeaponGroup.visible = showWeapon;

  playerLeftFistGroup.visible = true;
  playerRightFistGroup.visible = true;

  ensureHeldEyes(playerLeftFistGroup, playerRightFistGroup);
  ensureBloodDrips(playerLeftFistGroup, playerRightFistGroup);

  if (showWeapon) {
    const pistolMesh = playerWeaponGroup.getObjectByName('weapon-pistol');
    const shotgunMesh = playerWeaponGroup.getObjectByName('weapon-shotgun');
    const rifleMesh = playerWeaponGroup.getObjectByName('weapon-rifle');

    if (pistolMesh) pistolMesh.visible = weaponType === 'pistol';
    if (shotgunMesh) shotgunMesh.visible = weaponType === 'shotgun';
    if (rifleMesh) rifleMesh.visible = weaponType === 'rifle';

    setHeldEyesVisible(false);

    // Right hand grips the pistol (not frozen mid-emote)
    if (rightHandRig) {
      setHandFingerCurls(rightHandRig, {
        thumb: 0.75,
        index: 0.35, // trigger finger
        middle: 0.85,
        ring: 0.88,
        pinky: 0.9,
      });
    }
    playerRightFistGroup.position.set(0.26, -0.28, -0.48);
    playerRightFistGroup.rotation.set(0.35, -0.15, -0.25);

    // Left hand supports the weapon from the left side/front (two-handed grip)
    if (leftHandRig) {
      setHandFingerCurls(leftHandRig, {
        thumb: 0.75,
        index: 0.50,
        middle: 0.70,
        ring: 0.75,
        pinky: 0.85,
      });
    }
    playerLeftFistGroup.position.set(-0.20, -0.22, -0.58);
    playerLeftFistGroup.rotation.set(0.30, 0.15, 0.25);
  }

  if (recoilAmount > 0) {
    onRecoilUpdate(Math.max(0, recoilAmount - rawDt * 2.8));
  }

  // Official pistol slide + trigger driven by recoil
  if (playerPistol && weaponType === 'pistol') {
    applyPistolRecoil(playerPistol, showWeapon ? recoilAmount : 0);
  }

  if (showWeapon) {
    const isShotgun = weaponType === 'shotgun';
    const isRifle = weaponType === 'rifle';
    const baseOffset = isShotgun
      ? { x: 0.28, y: -0.22, z: -0.58 }
      : isRifle
      ? { x: 0.26, y: -0.24, z: -0.52 }
      : { x: 0.30, y: -0.26, z: -0.55 };

    const kickZ = recoilAmount * (isShotgun ? 0.65 : isRifle ? 0.35 : 0.45);
    const kickY = recoilAmount * (isShotgun ? 0.45 : isRifle ? 0.25 : 0.35);

    playerWeaponGroup.position.set(
      baseOffset.x + (isMoving ? Math.sin(currentTime * 0.008) * 0.02 : 0),
      baseOffset.y + kickY,
      baseOffset.z + kickZ
    );
    playerWeaponGroup.rotation.x = -recoilAmount * (isShotgun ? 0.45 : isRifle ? 0.25 : 0.35);
    return;
  }

  playerWeaponGroup.rotation.x = 0;
  const idleBob = isMoving ? Math.sin(currentTime * 0.01) * 0.015 : 0;

  if (isEmoting) {
    const emote = calculateEmoteTransforms(activeEmote, emoteProgress, currentTime);
    if (emote.active) {
      if (leftHandRig) setHandFingerCurls(leftHandRig, emote.leftFingerCurls);
      if (rightHandRig) setHandFingerCurls(rightHandRig, emote.rightFingerCurls);

      playerLeftFistGroup.position.set(
        -0.20 + emote.leftPosOffset.x,
        -0.22 + emote.leftPosOffset.y + idleBob,
        -0.38 + emote.leftPosOffset.z
      );
      playerLeftFistGroup.rotation.copy(emote.leftRotOffset);

      playerRightFistGroup.position.set(
        0.20 + emote.rightPosOffset.x,
        -0.22 + emote.rightPosOffset.y + idleBob,
        -0.38 + emote.rightPosOffset.z
      );
      playerRightFistGroup.rotation.copy(emote.rightRotOffset);

      const isEyeEmote = activeEmote === 'arranca_olho';
      const showEyes = isEyeEmote && emoteProgress >= 0.15 && emoteProgress < 0.96;
      setHeldEyesVisible(showEyes);
      if (showEyes && heldEyeL && heldEyeR) {
        const present = Math.min(1, Math.max(0, (emoteProgress - 0.35) / 0.35));
        const crush = Math.max(0, (emoteProgress - 0.72) / 0.22);
        const base = 0.006 + present * 0.008;
        const s = base * (1 - crush * 0.92);
        heldEyeL.scale.setScalar(s);
        heldEyeR.scale.setScalar(s);
        heldEyeL.position.set(0.02, 0.03 + present * 0.025, 0.04 + present * 0.05);
        heldEyeR.position.set(-0.02, 0.03 + present * 0.025, 0.04 + present * 0.05);
      }

      const showBlood = isEyeEmote && emoteProgress >= 0.28 && emoteProgress < 0.92;
      setBloodDripsVisible(showBlood);
      if (showBlood) {
        updateBloodDrips(bloodDripsL, bloodDripGroupL, currentTime, emoteProgress, rawDt);
        updateBloodDrips(bloodDripsR, bloodDripGroupR, currentTime, emoteProgress, rawDt);
      }
      return;
    }
  }

  setHeldEyesVisible(false);

  const neutralCurl = punchProgress > 0 ? 0.95 : 0.60;
  if (leftHandRig) {
    setHandFingerCurls(leftHandRig, {
      thumb: punchProgress > 0 ? 0.95 : 0.65,
      index: neutralCurl,
      middle: neutralCurl,
      ring: neutralCurl,
      pinky: neutralCurl,
    });
  }
  if (rightHandRig) {
    setHandFingerCurls(rightHandRig, {
      thumb: punchProgress > 0 ? 0.95 : 0.65,
      index: neutralCurl,
      middle: neutralCurl,
      ring: neutralCurl,
      pinky: neutralCurl,
    });
  }

  if (punchProgress > 0) {
    const newProgress = Math.max(0, punchProgress - rawDt * (punchType === 'uppercut' ? 5.0 : 6.8));
    onPunchProgressUpdate(newProgress, newProgress > 0);
    const curve = Math.sin(newProgress * Math.PI);

    if (punchType === 'jab') {
      playerLeftFistGroup.position.set(-0.18 + curve * 0.08, -0.26 + curve * 0.04, -0.42 - curve * 0.44);
      playerLeftFistGroup.rotation.set(curve * 0.12, curve * 0.08, curve * 0.2);
      playerRightFistGroup.position.set(0.24, -0.28 + idleBob, -0.38);
      playerRightFistGroup.rotation.set(0.05, -0.12, -0.08);
    } else if (punchType === 'cross') {
      playerRightFistGroup.position.set(0.18 - curve * 0.22, -0.26 + curve * 0.03, -0.42 - curve * 0.50);
      playerRightFistGroup.rotation.set(curve * 0.1, -curve * 0.25, -curve * 0.22);
      playerLeftFistGroup.position.set(-0.22, -0.28 + idleBob, -0.38);
      playerLeftFistGroup.rotation.set(0.05, 0.12, 0.08);
    } else if (punchType === 'hook') {
      playerLeftFistGroup.position.set(-0.14 + curve * 0.52, -0.26 - curve * 0.02, -0.42 - curve * 0.18);
      playerLeftFistGroup.rotation.set(-curve * 0.15, -curve * 0.85, curve * 0.75);
      playerRightFistGroup.position.set(0.26 - curve * 0.1, -0.30 + idleBob, -0.38);
      playerRightFistGroup.rotation.set(0.1, -0.15, -0.12);
    } else if (punchType === 'uppercut') {
      playerRightFistGroup.position.set(0.20 - curve * 0.14, -0.38 + curve * 0.46, -0.42 - curve * 0.28);
      playerRightFistGroup.rotation.set(curve * 1.1, curve * 0.2, -curve * 0.3);
      playerLeftFistGroup.position.set(-0.26, -0.28 + idleBob, -0.38);
      playerLeftFistGroup.rotation.set(0.05, 0.12, 0.08);
    }
  } else {
    onPunchProgressUpdate(0, false);
    const breath = Math.sin(currentTime * 0.003) * 0.008;
    playerLeftFistGroup.position.set(-0.22, -0.26 + idleBob + breath, -0.42);
    playerLeftFistGroup.rotation.set(0.1, 0.15, 0.1);
    playerRightFistGroup.position.set(0.22, -0.26 - idleBob + breath, -0.40);
    playerRightFistGroup.rotation.set(0.15, -0.15, -0.1);
  }
};
