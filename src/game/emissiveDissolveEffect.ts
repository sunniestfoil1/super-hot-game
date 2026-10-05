import * as THREE from 'three';
import { Enemy } from './types';

// Shared Dissolve Shader Material Manager
export interface DissolveGhost {
  group: THREE.Group;
  materials: THREE.Material[];
  uniforms: Array<{ progress: { value: number } }>;
  life: number;
  maxLife: number;
}

const activeDissolveGhosts: DissolveGhost[] = [];

/**
 * Creates custom Emissive Dissolve Material with Simplex 3D Noise GLSL shader
 */
export const createEmissiveDissolveMaterial = () => {
  const progressUniform = { value: 0.0 };

  const mat = new THREE.MeshStandardMaterial({
    color: 0xff002b,
    emissive: 0xff0033,
    emissiveIntensity: 2.5,
    roughness: 0.1,
    metalness: 0.9,
    transparent: true,
    flatShading: true,
    side: THREE.DoubleSide,
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.dissolveProgress = progressUniform;
    shader.uniforms.noiseScale = { value: 9.5 };
    shader.uniforms.edgeWidth = { value: 0.12 };
    shader.uniforms.edgeColor = { value: new THREE.Color(0xff1144) };
    shader.uniforms.glowColor = { value: new THREE.Color(0xffffff) };

    shader.vertexShader = `
      varying vec3 vWorldPos;
      ${shader.vertexShader}
    `;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      `
      #include <worldpos_vertex>
      vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
      `
    );

    shader.fragmentShader = `
      uniform float dissolveProgress;
      uniform float noiseScale;
      uniform float edgeWidth;
      uniform vec3 edgeColor;
      uniform vec3 glowColor;
      varying vec3 vWorldPos;

      // Procedural 3D Noise
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
      vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

      float snoise3D(vec3 v) {
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        i = mod289(i);
        vec4 p = permute(permute(permute(
                  i.z + vec4(0.0, i1.z, i2.z, 1.0))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0));
        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);
        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
        p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
      }

      ${shader.fragmentShader}
    `;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `
      #include <dithering_fragment>
      float noiseVal = snoise3D(vWorldPos * noiseScale) * 0.5 + 0.5;
      if (noiseVal < dissolveProgress) {
        discard;
      }
      float edge = smoothstep(dissolveProgress, dissolveProgress + edgeWidth, noiseVal);
      if (edge < 0.9) {
        gl_FragColor.rgb = mix(glowColor * 5.0, edgeColor * 3.0, edge);
      }
      `
    );
  };

  return { mat, progressUniform };
};

/**
 * Spawns an Emissive Dissolve Matrix Ghost of the dying enemy body
 */
export const spawnEnemyEmissiveDissolveGhost = (
  scene: THREE.Scene,
  enemy: Enemy
) => {
  enemy.root.updateMatrixWorld(true);
  const ghostGroup = new THREE.Group();
  ghostGroup.position.copy(enemy.position);
  ghostGroup.rotation.y = enemy.rotationY;

  const materials: THREE.Material[] = [];
  const uniforms: Array<{ progress: { value: number } }> = [];

  const parts: THREE.Mesh[] = [
    enemy.head, enemy.neck, enemy.chest, enemy.waist,
    enemy.leftUpperArm, enemy.leftForearm, enemy.rightUpperArm, enemy.rightForearm,
    enemy.leftThigh, enemy.leftCalf, enemy.rightThigh, enemy.rightCalf,
  ].filter((p) => p && p.parent);

  parts.forEach((part) => {
    const { mat, progressUniform } = createEmissiveDissolveMaterial();
    materials.push(mat);
    uniforms.push({ progress: progressUniform });

    const cloneMesh = new THREE.Mesh(part.geometry, mat);
    cloneMesh.position.copy(part.position);
    cloneMesh.rotation.copy(part.rotation);
    cloneMesh.scale.copy(part.scale);
    ghostGroup.add(cloneMesh);
  });

  scene.add(ghostGroup);

  activeDissolveGhosts.push({
    group: ghostGroup,
    materials,
    uniforms,
    life: 0,
    maxLife: 1.8, // 1.8 seconds complete falling animation + Matrix dissolve transition
  });
};

/**
 * Updates active dissolve ghosts progress in game loop
 */
export const updateEmissiveDissolveGhosts = (scene: THREE.Scene, gameDt: number) => {
  for (let i = activeDissolveGhosts.length - 1; i >= 0; i--) {
    const ghost = activeDissolveGhosts[i];
    ghost.life += gameDt;
    const progress = Math.min(1.0, ghost.life / ghost.maxLife);

    // Falling / Collapse animation momentum (walking_to_dying trajectory)
    ghost.group.position.y = Math.max(0.05, ghost.group.position.y - gameDt * 0.85);
    ghost.group.rotation.x += gameDt * 0.55;

    ghost.uniforms.forEach((u) => {
      u.progress.value = progress;
    });

    if (progress >= 1.0) {
      scene.remove(ghost.group);
      ghost.group.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
        }
      });
      ghost.materials.forEach((m) => m.dispose());
      activeDissolveGhosts.splice(i, 1);
    }
  }
};
