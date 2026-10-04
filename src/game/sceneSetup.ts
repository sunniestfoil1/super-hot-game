import * as THREE from 'three';
import { buildPlayerArmHierarchy, ArmMeshes } from './armHierarchy';
import { createGlbShotgunGeometry, createGlbUziGeometry } from './extraModelLoader';
import { initPostProcessing, resizePostProcessing, PostProcessingResult } from './postProcessing';
import { loadPistolTemplate, createPistolInstance, PistolInstance } from './pistolModel';
import { loadEyesTemplate } from './eyeModel';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface SceneSetupResult {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  playerWeaponGroup: THREE.Group;
  playerLeftFistGroup: THREE.Group;
  playerRightFistGroup: THREE.Group;
  armHierarchy: ArmMeshes;
  muzzleFlash: THREE.PointLight;
  worldGroup: THREE.Group;
  dirLight: THREE.DirectionalLight;
  postProcessing: PostProcessingResult | null;
  ensurePostProcessing: () => PostProcessingResult;
  mountWeaponModels: () => void;
  playerPistol: PistolInstance | null;
  onResize: (w: number, h: number) => void;
}

export const initThreeScene = (container: HTMLDivElement): SceneSetupResult => {
  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb8b4ac);
  scene.fog = new THREE.FogExp2(0xb8b4ac, 0.007);

  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 150);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    logarithmicDepthBuffer: false,
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;
  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envMap = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envMap;
  scene.environmentIntensity = 0.35;
  pmremGenerator.dispose();

  // --- LIGHTING — ambient baixo = sombras de janela definidas ---
  const ambientLight = new THREE.AmbientLight(0xfff8f0, 0.28);
  scene.add(ambientLight);

  const hemiLight = new THREE.HemisphereLight(0xfff5e0, 0xb8c0cc, 0.35);
  scene.add(hemiLight);

  // Sol / janela — duro e direcional
  const dirLight = new THREE.DirectionalLight(0xfff8f0, 2.2);
  dirLight.position.set(10, 22, 4);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 4096;
  dirLight.shadow.mapSize.height = 4096;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 80;
  dirLight.shadow.camera.left = -30;
  dirLight.shadow.camera.right = 30;
  dirLight.shadow.camera.top = 30;
  dirLight.shadow.camera.bottom = -30;
  dirLight.shadow.bias = -0.0003;
  dirLight.shadow.normalBias = 0.02;
  dirLight.shadow.radius = 1.5;
  scene.add(dirLight);

  const windowLight2 = new THREE.DirectionalLight(0xe8f0ff, 0.45);
  windowLight2.position.set(-14, 16, -6);
  windowLight2.castShadow = true;
  windowLight2.shadow.mapSize.width = 1024;
  windowLight2.shadow.mapSize.height = 1024;
  windowLight2.shadow.camera.near = 0.5;
  windowLight2.shadow.camera.far = 60;
  windowLight2.shadow.camera.left = -20;
  windowLight2.shadow.camera.right = 20;
  windowLight2.shadow.camera.top = 20;
  windowLight2.shadow.camera.bottom = -20;
  windowLight2.shadow.bias = -0.0003;
  scene.add(windowLight2);

  const fillLight = new THREE.DirectionalLight(0xfff0e0, 0.10);
  fillLight.position.set(0, -4, 0);
  scene.add(fillLight);

  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  // Player Weapon Mesh Group — pistol.glb only (no box fallback)
  const playerWeaponGroup = new THREE.Group();
  const gunMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.5, metalness: 0.55, flatShading: true });

  let playerPistol: PistolInstance | null = null;

  // Mount heavy GLBs only when gameplay starts (lazy load).
  const mountWeaponModels = () => {
    if (playerPistol) return;
    Promise.all([loadPistolTemplate(), loadEyesTemplate()]).then(() => {
      playerPistol = createPistolInstance();
      if (playerPistol && playerWeaponGroup) {
        playerWeaponGroup.add(playerPistol.root);
      }
    }).catch((err) => {
      console.error('Failed to load pistol.glb / eyes GLB:', err);
    });
  };

  // 2. Shotgun (From free_low_poly_shotgun__escopeta.glb)
  const shotgunMesh = new THREE.Mesh(createGlbShotgunGeometry(), gunMat);
  shotgunMesh.name = 'weapon-shotgun';
  shotgunMesh.position.set(0, -0.04, 0.05);
  shotgunMesh.visible = false;
  playerWeaponGroup.add(shotgunMesh);

  // 3. Rifle / SMG (From low-poly_mini_uzi.glb)
  const uziMesh = new THREE.Mesh(createGlbUziGeometry(), gunMat);
  uziMesh.name = 'weapon-rifle';
  uziMesh.position.set(0, -0.06, 0.08);
  uziMesh.visible = false;
  playerWeaponGroup.add(uziMesh);

  playerWeaponGroup.position.set(0.3, -0.26, -0.55);
  camera.add(playerWeaponGroup);

  // Fill light so textured pistol.glb isn't a black PBR silhouette
  const gunFill = new THREE.PointLight(0xfff2e0, 0.18, 0.9);
  gunFill.position.set(0.05, 0.08, 0.15);
  playerWeaponGroup.add(gunFill);

  // Build Player Arms with Blue Sleeves and Black Tactical Hands
  const armHierarchy = buildPlayerArmHierarchy(camera);
  const {
    leftArmGroup: playerLeftFistGroup,
    rightArmGroup: playerRightFistGroup,
  } = armHierarchy;

  scene.add(camera);

  const muzzleFlash = new THREE.PointLight(0xffffff, 0, 4);
  muzzleFlash.position.set(0, 0, -0.4);
  playerWeaponGroup.add(muzzleFlash);

  // --- POST-PROCESSING ---
  // Post-processing é custoso; inicializa só quando o jogo começar.
  let postProcessing: PostProcessingResult | null = null;

  const ensurePostProcessing = () => {
    if (!postProcessing) {
      postProcessing = initPostProcessing(renderer, scene, camera, width, height);
    }
    return postProcessing;
  };

  const onResize = (w: number, h: number) => {
    if (postProcessing) {
      resizePostProcessing(postProcessing, w, h);
    }
  };

  return {
    scene,
    camera,
    renderer,
    playerWeaponGroup,
    playerLeftFistGroup,
    playerRightFistGroup,
    armHierarchy,
    muzzleFlash,
    worldGroup,
    dirLight,
    postProcessing,
    ensurePostProcessing,
    mountWeaponModels,
    get playerPistol() {
      return playerPistol;
    },
    onResize,
  };
};
