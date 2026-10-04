import * as THREE from 'three';

class CollisionDebugger {
  private debugGroup: THREE.Group | null = null;
  private isVisible = false;
  private playerMeshHelper: THREE.Mesh | null = null;

  public toggleDebug(
    scene: THREE.Scene,
    wallBoxes: THREE.Box3[],
    floorBoxes: THREE.Box3[] = [],
    pillarBoxes: THREE.Box3[] = [],
    playerPos?: THREE.Vector3
  ) {
    this.isVisible = !this.isVisible;
    if (this.isVisible) {
      this.enableDebug(scene, wallBoxes, floorBoxes, pillarBoxes, playerPos);
    } else {
      this.disableDebug(scene);
    }
    return this.isVisible;
  }

  public getIsVisible(): boolean {
    return this.isVisible;
  }

  public enableDebug(
    scene: THREE.Scene,
    wallBoxes: THREE.Box3[],
    floorBoxes: THREE.Box3[] = [],
    pillarBoxes: THREE.Box3[] = [],
    playerPos?: THREE.Vector3
  ) {
    this.disableDebug(scene);
    this.debugGroup = new THREE.Group();
    this.debugGroup.name = 'collision-proxy-debug-group';

    const redMat = new THREE.MeshBasicMaterial({ color: 0xff0033, wireframe: true });
    const greenMat = new THREE.MeshBasicMaterial({ color: 0x00ff66, wireframe: true });
    const yellowMat = new THREE.MeshBasicMaterial({ color: 0xffcc00, wireframe: true });
    const blueMat = new THREE.MeshBasicMaterial({ color: 0x0099ff, wireframe: true });

    // 1. Proxies de Parede (Vermelho)
    wallBoxes.forEach((box) => {
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
      const mesh = new THREE.Mesh(geo, redMat);
      mesh.position.copy(center);
      this.debugGroup?.add(mesh);
    });

    // 2. Proxies de Piso / Plataforma (Verde)
    floorBoxes.forEach((box) => {
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
      const mesh = new THREE.Mesh(geo, greenMat);
      mesh.position.copy(center);
      this.debugGroup?.add(mesh);
    });

    // 3. Proxies de Pilares (Amarelo)
    pillarBoxes.forEach((box) => {
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
      const mesh = new THREE.Mesh(geo, yellowMat);
      mesh.position.copy(center);
      this.debugGroup?.add(mesh);
    });

    // 4. Hitbox Anatômica Completa do Jogador (Cabeça + Torso + Pernas em Azul/Ciano)
    if (playerPos) {
      const playerHitboxGroup = new THREE.Group();
      playerHitboxGroup.name = 'player-hitbox-debug-group';

      // Cabeça (Esfera)
      const headGeo = new THREE.SphereGeometry(0.20, 10, 10);
      const headMesh = new THREE.Mesh(headGeo, blueMat);
      headMesh.position.set(0, 0, 0);

      // Torso / Peito (Caixa)
      const torsoGeo = new THREE.BoxGeometry(0.44, 0.55, 0.30);
      const torsoMesh = new THREE.Mesh(torsoGeo, blueMat);
      torsoMesh.position.set(0, -0.45, 0);

      // Pernas / Quadril (Caixa)
      const legsGeo = new THREE.BoxGeometry(0.38, 0.95, 0.28);
      const legsMesh = new THREE.Mesh(legsGeo, blueMat);
      legsMesh.position.set(0, -1.20, 0);

      playerHitboxGroup.add(headMesh, torsoMesh, legsMesh);
      playerHitboxGroup.position.copy(playerPos);
      this.playerMeshHelperGroup = playerHitboxGroup;
      this.debugGroup.add(playerHitboxGroup);
    }

    scene.add(this.debugGroup);
    console.log('[COLLISION DEBUGGER] Modo Collision Proxy Debug ATIVADO (F8 / F9)');
  }

  private playerMeshHelperGroup: THREE.Group | null = null;

  public updatePlayerPos(playerPos: THREE.Vector3) {
    if (this.playerMeshHelperGroup && this.isVisible) {
      this.playerMeshHelperGroup.position.copy(playerPos);
    }
  }

  public disableDebug(scene: THREE.Scene) {
    if (this.debugGroup) {
      scene.remove(this.debugGroup);
      this.debugGroup.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          (obj as THREE.Mesh).geometry?.dispose();
        }
      });
      this.debugGroup = null;
      this.playerMeshHelperGroup = null;
    }
    this.isVisible = false;
  }
}

export const collisionDebugger = new CollisionDebugger();
