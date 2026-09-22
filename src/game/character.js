import * as THREE from 'three';

/**
 * "Pip", the original Cloud Kingdom hero: a small sky sprite built entirely
 * from procedural geometry (no external or third-party assets).
 */
export function createCharacter() {
  const group = new THREE.Group();

  const skin = new THREE.MeshStandardMaterial({ color: 0x4fc3f7, roughness: 0.45, metalness: 0.05 });
  const belly = new THREE.MeshStandardMaterial({ color: 0xfff3d1, roughness: 0.6 });
  const scarfMat = new THREE.MeshStandardMaterial({ color: 0xff7a59, roughness: 0.7 });
  const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  const pupil = new THREE.MeshStandardMaterial({ color: 0x1a2340, roughness: 0.2 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.34, 6, 18), skin);
  body.position.y = 0.05;
  body.castShadow = true;
  group.add(body);

  const bellyPatch = new THREE.Mesh(new THREE.SphereGeometry(0.27, 18, 14), belly);
  bellyPatch.position.set(0, 0.0, 0.18);
  bellyPatch.scale.set(1, 1.05, 0.6);
  group.add(bellyPatch);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 22, 18), skin);
  head.position.y = 0.62;
  head.castShadow = true;
  group.add(head);

  const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.3, 10), scarfMat);
  tuft.position.set(0, 0.95, -0.03);
  tuft.rotation.x = -0.35;
  group.add(tuft);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 12), eyeWhite);
    eye.position.set(side * 0.14, 0.66, 0.28);
    group.add(eye);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), pupil);
    iris.position.set(side * 0.15, 0.66, 0.36);
    group.add(iris);

    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.16, 4, 10), skin);
    arm.position.set(side * 0.38, 0.12, 0);
    arm.rotation.z = side * 0.45;
    arm.castShadow = true;
    group.add(arm);
  }

  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.07, 10, 22), scarfMat);
  scarf.position.y = 0.34;
  scarf.rotation.x = Math.PI / 2;
  group.add(scarf);

  const legs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.16, 4, 10), scarfMat);
    leg.position.set(side * 0.16, -0.42, 0);
    leg.castShadow = true;
    group.add(leg);
    legs.push(leg);
  }

  const parts = { group, body, head, legs, tuft };

  /**
   * @param {number} time seconds since start
   * @param {number} speed horizontal speed (world units / s)
   * @param {boolean} grounded whether the hero touches a platform
   * @param {number} verticalVelocity used for squash & stretch
   * @param {boolean} calm true when reduced motion is requested
   */
  group.animate = (time, speed, grounded, verticalVelocity, calm = false) => {
    const stride = calm ? 0 : Math.min(speed / 8, 1);
    const swing = grounded ? Math.sin(time * 12) * 0.5 * stride : 0.3;
    legs[0].rotation.x = swing;
    legs[1].rotation.x = -swing;
    const bob = calm ? 0 : Math.sin(time * 6) * 0.03 * stride;
    body.position.y = 0.05 + bob;
    head.position.y = 0.62 + bob * 1.2;
    // Squash & stretch: the horizontal scale moves opposite to the vertical one
    // (2 - stretch) so the hero keeps roughly the same volume while jumping.
    const stretch = grounded ? 1 : THREE.MathUtils.clamp(1 + verticalVelocity * 0.012, 0.85, 1.15);
    group.scale.set(2 - stretch, stretch, 2 - stretch);
    if (!calm) parts.tuft.rotation.z = Math.sin(time * 4) * 0.15;
  };

  return group;
}
