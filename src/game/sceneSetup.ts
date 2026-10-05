import * as THREE from 'three';
import { buildPlayerArmHierarchy, ArmMeshes } from './armHierarchy';
import { createGlbShotgunGeometry, createGlbUziGeometry, createGlbBottleGeometry, createGlbKnifeGeometry, createGlbAshtrayGeometry } from './extraModelLoader';
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
  scene.background = new THREE.Color(0xdcd8d0);
  scene.fog = new THREE.FogExp2(0xdcd8d0, 0.0035);

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
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
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

  // Luz ambiente secundária de preenchimento (sem render pass de sombra redundante)
  const windowLight2 = new THREE.DirectionalLight(0xe8f0ff, 0.45);
  windowLight2.position.set(-14, 16, -6);
  windowLight2.castShadow = false;
  scene.add(windowLight2);

  const fillLight = new THREE.DirectionalLight(0xfff0e0, 0.10);
  fillLight.position.set(0, -4, 0);
  scene.add(fillLight);

  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  // Player Weapon Mesh Group
  const playerWeaponGroup = new THREE.Group();
  const gunMat = new THREE.MeshStandardMaterial({
    color: 0x22242a,
    roughness: 0.38,
    metalness: 0.65,
    flatShading: true,
  });

  let playerPistol: PistolInstance | null = null;

  // Mount heavy GLBs immediately on scene init so weapon appears on the menu screen.
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

  // Load pistol + eyes immediately on scene setup so they appear on the menu screen
  mountWeaponModels();

  // 2. Shotgun (From free_low_poly_shotgun__escopeta.glb)
  const shotgunMesh = new THREE.Mesh(createGlbShotgunGeometry(), gunMat);
  shotgunMesh.name = 'weapon-shotgun';
  shotgunMesh.position.set(0, -0.04, 0.05);
  shotgunMesh.visible = false;
  playerWeaponGroup.add(shotgunMesh);

  // 3. Rifle / SMG (From low-poly_mini_uzi.glb)
  const uziMesh = new THREE.Mesh(
      createGlbUziGeometry(),
      new THREE.MeshStandardMaterial({
        color: 0x242830,
        roughness: 0.32,
        metalness: 0.75,
      })
    );
  uziMesh.name = 'weapon-rifle';
  uziMesh.position.set(0, -0.06, 0.08);
  uziMesh.visible = false;
  playerWeaponGroup.add(uziMesh);

  // 4. Bottle (From garrafa_de_dolly.glb)
  const bottleMesh = new THREE.Mesh(
    createGlbBottleGeometry(),
    new THREE.MeshStandardMaterial({
      color: 0x228b22,
      roughness: 0.2,
      metalness: 0.1,
      transparent: true,
      opacity: 0.85,
    })
  );
  bottleMesh.name = 'weapon-bottle';
  bottleMesh.position.set(0, -0.06, 0.08);
  bottleMesh.visible = false;
  playerWeaponGroup.add(bottleMesh);

  // 5. Knife (From valorants_knife_low_poly.glb)
  const knifeMesh = new THREE.Mesh(
    createGlbKnifeGeometry(),
    new THREE.MeshStandardMaterial({
      color: 0x44444c,
      roughness: 0.3,
      metalness: 0.8,
    })
  );
  knifeMesh.name = 'weapon-knife';
  knifeMesh.position.set(0, -0.06, 0.08);
  knifeMesh.visible = false;
  playerWeaponGroup.add(knifeMesh);

  // 6. Ashtray (From ashtray.glb)
  const ashtrayMesh = new THREE.Mesh(
    createGlbAshtrayGeometry(),
    new THREE.MeshStandardMaterial({
      color: 0x8899a6,
      roughness: 0.15,
      metalness: 0.2,
      transparent: true,
      opacity: 0.9,
    })
  );
  ashtrayMesh.name = 'weapon-ashtray';
  ashtrayMesh.position.set(0, -0.06, 0.08);
  ashtrayMesh.visible = false;
  playerWeaponGroup.add(ashtrayMesh);

  // Build Player Arms with Blue Sleeves and Black Tactical Hands
  const armHierarchy = buildPlayerArmHierarchy(camera);
  const {
    leftArmGroup: playerLeftFistGroup,
    rightArmGroup: playerRightFistGroup,
  } = armHierarchy;

  playerWeaponGroup.position.set(0.06, 0.02, -0.04);
  playerRightFistGroup.add(playerWeaponGroup);

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
