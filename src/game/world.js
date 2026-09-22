import * as THREE from 'three';
import { createCharacter } from './character.js';
import { enemyPositionAt, platformCenterAt } from './physics.js';
import { CONFIG } from './config.js';

const SKY_VERTEX = `
varying vec3 vWorldPosition;
void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAGMENT = `
uniform vec3 topColor;
uniform vec3 bottomColor;
uniform float offset;
uniform float exponent;
varying vec3 vWorldPosition;
void main() {
  float h = normalize(vWorldPosition + offset).y;
  gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
}`;

function makeCloud(scale) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xbfe4ff,
    emissiveIntensity: 0.45,
    roughness: 1,
    metalness: 0,
    transparent: true,
    opacity: 0.92
  });
  const cloud = new THREE.Group();
  const blobs = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i < blobs; i += 1) {
    const blob = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), material);
    blob.position.set((i - blobs / 2) * 1.1, Math.random() * 0.5, Math.random() * 0.8 - 0.4);
    blob.scale.setScalar(0.7 + Math.random() * 0.6);
    cloud.add(blob);
  }
  cloud.scale.setScalar(scale);
  return cloud;
}

/**
 * Builds and animates the Three.js representation of a level.
 */
export class World {
  constructor(canvas, level, options = {}) {
    this.level = level;
    this.reducedMotion = !!options.reducedMotion;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xbfe9ff, 55, 190);

    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 600);
    this.camera.position.set(0, 6, -10);

    this.#buildSky();
    this.#buildLights();
    this.#buildPlatforms();
    this.#buildCoins();
    this.#buildEnemies();
    this.#buildHazards();
    this.#buildCheckpoints();
    this.#buildGoal();

    this.player = createCharacter();
    this.scene.add(this.player);

    this.sparkles = [];
    this.resize();
  }

  #buildSky() {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(400, 32, 20),
      new THREE.ShaderMaterial({
        uniforms: {
          topColor: { value: new THREE.Color(0x2f80ed) },
          bottomColor: { value: new THREE.Color(0xd9f2ff) },
          offset: { value: 20 },
          exponent: { value: 0.65 }
        },
        vertexShader: SKY_VERTEX,
        fragmentShader: SKY_FRAGMENT,
        side: THREE.BackSide,
        depthWrite: false
      })
    );
    this.scene.add(sky);

    this.clouds = new THREE.Group();
    for (let i = 0; i < 26; i += 1) {
      const cloud = makeCloud(1.4 + Math.random() * 2.6);
      cloud.position.set(
        (Math.random() - 0.5) * 160,
        -8 + Math.random() * 40,
        Math.random() * 190 - 30
      );
      cloud.userData.drift = 0.6 + Math.random() * 1.2;
      this.clouds.add(cloud);
    }
    this.scene.add(this.clouds);
  }

  #buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xcfeeff, 0x4d6a86, 1.05));
    const sun = new THREE.DirectionalLight(0xfff2d5, 2.1);
    sun.position.set(28, 48, -18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 160;
    sun.shadow.camera.left = -45;
    sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45;
    sun.shadow.camera.bottom = -45;
    sun.shadow.bias = -0.0008;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
  }

  #buildPlatforms() {
    this.platformMeshes = new Map();
    for (const platform of this.level.platforms) {
      const group = new THREE.Group();
      const top = new THREE.Mesh(
        new THREE.BoxGeometry(platform.w, platform.h, platform.d),
        new THREE.MeshStandardMaterial({ color: platform.grassColor, roughness: 0.85 })
      );
      top.castShadow = true;
      top.receiveShadow = true;
      group.add(top);

      const rock = new THREE.Mesh(
        new THREE.ConeGeometry(Math.min(platform.w, platform.d) * 0.52, platform.h * 3.2, 10),
        new THREE.MeshStandardMaterial({ color: platform.color, roughness: 0.95, flatShading: true })
      );
      rock.position.y = -platform.h * 1.9;
      rock.rotation.x = Math.PI;
      rock.castShadow = true;
      group.add(rock);

      if (platform.motion) {
        const halo = new THREE.Mesh(
          new THREE.TorusGeometry(Math.min(platform.w, platform.d) * 0.62, 0.07, 8, 28),
          new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffa53b, emissiveIntensity: 0.7 })
        );
        halo.rotation.x = Math.PI / 2;
        halo.position.y = platform.h / 2 + 0.05;
        group.add(halo);
      }

      group.position.set(platform.x, platform.y, platform.z);
      this.scene.add(group);
      this.platformMeshes.set(platform.id, group);
    }
  }

  #buildCoins() {
    this.coinMeshes = new Map();
    const geometry = new THREE.TorusGeometry(0.34, 0.13, 10, 22);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffd23f,
      emissive: 0xff9f1c,
      emissiveIntensity: 0.55,
      metalness: 0.5,
      roughness: 0.25
    });
    for (const coin of this.level.coins) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(coin.x, coin.y, coin.z);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.coinMeshes.set(coin.id, mesh);
    }
  }

  #buildEnemies() {
    this.enemyMeshes = new Map();
    for (const enemy of this.level.enemies) {
      const group = new THREE.Group();
      const bodyMesh = new THREE.Mesh(
        new THREE.SphereGeometry(CONFIG.enemyRadius, 18, 14),
        new THREE.MeshStandardMaterial({ color: 0xa06bff, roughness: 0.5 })
      );
      bodyMesh.castShadow = true;
      group.add(bodyMesh);
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 12, 10),
          new THREE.MeshStandardMaterial({ color: 0xffffff })
        );
        eye.position.set(side * 0.25, 0.2, 0.62);
        group.add(eye);
        const iris = new THREE.Mesh(
          new THREE.SphereGeometry(0.07, 10, 8),
          new THREE.MeshStandardMaterial({ color: 0x241a3a })
        );
        iris.position.set(side * 0.27, 0.2, 0.73);
        group.add(iris);
      }
      this.scene.add(group);
      this.enemyMeshes.set(enemy.id, group);
    }
  }

  #buildHazards() {
    this.hazardMeshes = new Map();
    for (const hazard of this.level.hazards) {
      const mesh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(hazard.radius, 0),
        new THREE.MeshStandardMaterial({
          color: 0x3d2b56,
          emissive: 0xff3b6b,
          emissiveIntensity: 0.6,
          flatShading: true,
          roughness: 0.4
        })
      );
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.hazardMeshes.set(hazard.id, mesh);
    }
  }

  #buildCheckpoints() {
    this.checkpointFlags = new Map();
    for (const checkpoint of this.level.checkpoints) {
      const group = new THREE.Group();
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 2.6, 10),
        new THREE.MeshStandardMaterial({ color: 0xf1f5ff, roughness: 0.5 })
      );
      pole.position.y = 1.3;
      pole.castShadow = true;
      group.add(pole);
      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(1.1, 0.7),
        new THREE.MeshStandardMaterial({ color: 0x9aa7c7, side: THREE.DoubleSide, roughness: 0.7 })
      );
      flag.position.set(0.58, 2.1, 0);
      group.add(flag);
      group.position.set(checkpoint.x, checkpoint.y - 0.4, checkpoint.z);
      this.scene.add(group);
      this.checkpointFlags.set(checkpoint.id, flag);
    }
  }

  #buildGoal() {
    const goal = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.5, 0.18, 14, 40),
      new THREE.MeshStandardMaterial({ color: 0x7af5d0, emissive: 0x33d6a6, emissiveIntensity: 0.9 })
    );
    goal.add(ring);
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.7, 0),
      new THREE.MeshStandardMaterial({ color: 0xfff4c2, emissive: 0xffd166, emissiveIntensity: 1.1, flatShading: true })
    );
    goal.add(core);
    goal.position.set(this.level.goal.x, this.level.goal.y, this.level.goal.z);
    this.scene.add(goal);
    this.goal = goal;
    this.goalRing = ring;
    this.goalCore = core;
  }

  /** Small burst of sparkles when a coin is collected. */
  spawnSparkle(position) {
    if (this.reducedMotion) return;
    const material = new THREE.MeshBasicMaterial({ color: 0xfff0a8, transparent: true });
    const group = new THREE.Group();
    for (let i = 0; i < 8; i += 1) {
      const bit = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), material);
      const angle = (i / 8) * Math.PI * 2;
      bit.userData.velocity = new THREE.Vector3(Math.cos(angle) * 2.4, 2.6, Math.sin(angle) * 2.4);
      group.add(bit);
    }
    group.position.set(position.x, position.y, position.z);
    group.userData.life = 0.6;
    this.scene.add(group);
    this.sparkles.push(group);
  }

  #updateSparkles(dt) {
    for (let i = this.sparkles.length - 1; i >= 0; i -= 1) {
      const group = this.sparkles[i];
      group.userData.life -= dt;
      for (const bit of group.children) {
        bit.position.addScaledVector(bit.userData.velocity, dt);
        bit.userData.velocity.y -= 6 * dt;
        bit.material.opacity = Math.max(0, group.userData.life / 0.6);
      }
      if (group.userData.life <= 0) {
        group.children.forEach((bit) => bit.geometry.dispose());
        group.children[0]?.material.dispose();
        this.scene.remove(group);
        this.sparkles.splice(i, 1);
      }
    }
  }

  /** Syncs meshes with the simulation state and renders a frame. */
  update(state, dt) {
    const time = state.time;
    const calm = this.reducedMotion;

    for (const platform of this.level.platforms) {
      if (!platform.motion) continue;
      const center = platformCenterAt(platform, time);
      this.platformMeshes.get(platform.id)?.position.set(center.x, center.y, center.z);
    }

    for (const coin of this.level.coins) {
      const mesh = this.coinMeshes.get(coin.id);
      if (!mesh) continue;
      if (coin.collected) {
        mesh.visible = false;
        continue;
      }
      mesh.rotation.y += dt * (calm ? 0.6 : 2.4);
      mesh.position.y = coin.y + (calm ? 0 : Math.sin(time * 2 + coin.z) * 0.14);
    }

    for (const enemy of this.level.enemies) {
      const mesh = this.enemyMeshes.get(enemy.id);
      if (!mesh) continue;
      if (!enemy.alive) {
        mesh.visible = false;
        continue;
      }
      const pos = enemyPositionAt(enemy, time);
      mesh.position.set(pos.x, pos.y, pos.z);
      const squash = calm ? 1 : 1 + Math.sin(time * 6 + enemy.phase) * 0.07;
      mesh.scale.set(2 - squash, squash, 2 - squash);
      mesh.lookAt(state.player.position.x, pos.y, state.player.position.z);
    }

    for (const hazard of this.level.hazards) {
      const mesh = this.hazardMeshes.get(hazard.id);
      if (!mesh) continue;
      const pos = platformCenterAt(hazard, time);
      mesh.position.set(pos.x, pos.y, pos.z);
      if (!calm) {
        mesh.rotation.x += dt * 1.4;
        mesh.rotation.y += dt * 1.9;
      }
    }

    for (const checkpoint of this.level.checkpoints) {
      const flag = this.checkpointFlags.get(checkpoint.id);
      if (!flag) continue;
      flag.material.color.set(checkpoint.reached ? 0x4ade80 : 0x9aa7c7);
      if (!calm) flag.rotation.y = Math.sin(time * 2.4 + checkpoint.z) * 0.3;
    }

    if (!calm) {
      this.goalRing.rotation.z += dt * 0.8;
      this.goalRing.rotation.y = Math.sin(time * 0.6) * 0.4;
      this.goalCore.rotation.y += dt * 1.6;
      this.goalCore.position.y = Math.sin(time * 1.6) * 0.2;
      for (const cloud of this.clouds.children) {
        cloud.position.x += cloud.userData.drift * dt * 0.4;
        if (cloud.position.x > 90) cloud.position.x = -90;
      }
    }

    const p = state.player;
    this.player.position.set(p.position.x, p.position.y - CONFIG.playerHalfHeight + 0.55, p.position.z);
    const targetRotation = p.facing;
    this.player.rotation.y += ((targetRotation - this.player.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 12);
    this.player.animate(time, Math.hypot(p.velocity.x, p.velocity.z), p.grounded, p.velocity.y, calm);

    this.sun.target.position.set(p.position.x, p.position.y, p.position.z);
    this.sun.position.set(p.position.x + 28, p.position.y + 48, p.position.z - 18);

    this.#updateSparkles(dt);
    this.#updateCamera(p, dt);
    this.renderer.render(this.scene, this.camera);
  }

  #updateCamera(player, dt) {
    const desired = new THREE.Vector3(
      player.position.x * 0.6,
      player.position.y + CONFIG.cameraHeight,
      player.position.z - CONFIG.cameraDistance
    );
    const lerp = Math.min(1, dt * CONFIG.cameraLerp);
    this.camera.position.lerp(desired, lerp);
    this.camera.lookAt(player.position.x * 0.8, player.position.y + 1.2, player.position.z + 3);
  }

  /** Renders a single frame without advancing gameplay (menus, pause). */
  render() {
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    this.renderer.dispose();
  }
}
