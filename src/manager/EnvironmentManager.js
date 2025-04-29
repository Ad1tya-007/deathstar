import * as THREE from 'three';

class EnvironmentManager {
  constructor(scene) {
    this.scene = scene;
    this.starfield = null;
    this.planets = [];
    this.asteroids = [];
    this.collisionObjects = [];
    this.deathStar = null;
    this.targets = [];
  }

  createStarfield() {
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.1,
    });

    const starsVertices = [];
    for (let i = 0; i < 20000; i++) {
      const x = (Math.random() - 0.5) * 4000;
      const y = (Math.random() - 0.5) * 4000;
      const z = (Math.random() - 0.5) * 4000;
      starsVertices.push(x, y, z);
    }

    starsGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(starsVertices, 3)
    );
    this.starfield = new THREE.Points(starsGeometry, starsMaterial);
    this.scene.add(this.starfield);
  }

  updateStarfield() {
    if (this.starfield) {
      this.starfield.rotation.x += 0.0001;
      this.starfield.rotation.y += 0.0001;
    }
  }

  getStarfield() {
    return this.starfield;
  }

  createPlanet(x, y, z, radius, type, color) {
    const planetGeometry = new THREE.SphereGeometry(radius, 64, 64);

    let planetMaterial;

    switch (type) {
      case 'gas-giant':
        // Create gas giant with cloud-like texture
        planetMaterial = new THREE.MeshPhongMaterial({
          color: color,
          emissive: 0x222222,
          flatShading: false,
          shininess: 0,
        });
        break;
      case 'rocky':
        // Create rocky planet with bumpy surface
        planetMaterial = new THREE.MeshStandardMaterial({
          color: color,
          roughness: 0.9,
          metalness: 0.1,
          flatShading: true,
        });
        break;
      case 'earth':
      default:
        // Create earth-like planet
        planetMaterial = new THREE.MeshPhongMaterial({
          color: color,
          specular: 0x333333,
          shininess: 5,
        });
    }

    const planet = new THREE.Mesh(planetGeometry, planetMaterial);
    planet.position.set(x, y, z);
    planet.castShadow = true;
    planet.receiveShadow = true;

    // Add rings to gas giants
    if (type === 'gas-giant') {
      const ringGeometry = new THREE.RingGeometry(radius + 20, radius + 60, 64);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0xffd700,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5,
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = Math.PI / 2;
      planet.add(ring);
    }

    this.scene.add(planet);
    this.planets.push({
      mesh: planet,
      radius: radius,
      rotationSpeed: Math.random() * 0.005,
    });

    // Add to collision objects
    this.collisionObjects.push({
      mesh: planet,
      position: planet.position,
      radius: radius,
      type: 'planet',
    });
  }

  createAsteroidField(centerX, centerY, centerZ, radius, count) {
    const asteroidGeometry = new THREE.DodecahedronGeometry(1, 0);
    const asteroidMaterial = new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 0.9,
      metalness: 0.1,
    });

    for (let i = 0; i < count; i++) {
      // Random position within the field radius
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * radius;
      const x = centerX + Math.cos(angle) * distance;
      const y = centerY + (Math.random() - 0.5) * radius;
      const z = centerZ + Math.sin(angle) * distance;

      // Random size
      const scale = 2 + Math.random() * 8;

      // Create asteroid mesh
      const asteroid = new THREE.Mesh(asteroidGeometry, asteroidMaterial);
      asteroid.position.set(x, y, z);
      asteroid.scale.set(scale, scale, scale);

      // Add random rotation
      asteroid.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );

      this.scene.add(asteroid);

      // Add to asteroids array
      this.asteroids.push({
        mesh: asteroid,
        radius: scale,
        rotationSpeed: {
          x: Math.random() * 0.02 - 0.01,
          y: Math.random() * 0.02 - 0.01,
          z: Math.random() * 0.02 - 0.01,
        },
        velocity: {
          x: Math.random() * 0.1 - 0.05,
          y: Math.random() * 0.1 - 0.05,
          z: Math.random() * 0.1 - 0.05,
        },
      });

      // Add to collision objects
      this.collisionObjects.push({
        mesh: asteroid,
        position: asteroid.position,
        radius: scale,
        type: 'asteroid',
      });
    }
  }

  createDeathStar() {
    // Create the main sphere
    const deathStarGeometry = new THREE.SphereGeometry(300, 64, 64);
    const deathStarMaterial = new THREE.MeshPhongMaterial({
      color: 0xcccccc,
      shininess: 10,
      flatShading: false,
    });

    this.deathStar = new THREE.Mesh(deathStarGeometry, deathStarMaterial);
    this.deathStar.position.set(0, 0, -2000); // Far in the distance

    // Create the superlaser indent
    const superlaser = new THREE.Mesh(
      new THREE.CircleGeometry(60, 32),
      new THREE.MeshBasicMaterial({ color: 0x333333 })
    );
    superlaser.position.z = 299; // Just outside the sphere
    this.deathStar.add(superlaser);

    // Create the equatorial trench
    const trenchGeometry = new THREE.TorusGeometry(300, 10, 16, 100);
    const trenchMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
    const trench = new THREE.Mesh(trenchGeometry, trenchMaterial);
    trench.rotation.x = Math.PI / 2;
    this.deathStar.add(trench);

    // Add Death Star to scene
    this.scene.add(this.deathStar);

    // Add to collision objects
    this.collisionObjects.push({
      mesh: this.deathStar,
      position: this.deathStar.position,
      radius: 300,
      type: 'deathstar',
    });
  }

  destroyAsteroid(asteroidIndex) {
    const asteroid = this.asteroids[asteroidIndex];
    if (!asteroid) return;

    // Remove from scene
    this.scene.remove(asteroid.mesh);

    // Remove from asteroids array
    this.asteroids.splice(asteroidIndex, 1);

    // Find and remove from collision objects
    const collisionIndex = this.collisionObjects.findIndex(
      (obj) => obj.mesh === asteroid.mesh
    );
    if (collisionIndex !== -1) {
      this.collisionObjects.splice(collisionIndex, 1);
    }
  }

  createExplosionEffect(position, size, color) {
    // Create particle system for explosion
    const particleCount = 50;
    const particles = new THREE.BufferGeometry();

    const positions = [];
    const velocities = [];
    const colors = [];

    // Yellow-orange color for explosion
    const baseColor = new THREE.Color(color);

    for (let i = 0; i < particleCount; i++) {
      // Random position within sphere
      const x = (Math.random() - 0.5) * 0.5;
      const y = (Math.random() - 0.5) * 0.5;
      const z = (Math.random() - 0.5) * 0.5;

      positions.push(x, y, z);

      // Random velocity outward
      const speed = 2 + Math.random() * 5;
      velocities.push(x * speed, y * speed, z * speed);

      // Vary color slightly
      const colorVariation = Math.random() * 0.2;
      colors.push(
        baseColor.r,
        baseColor.g * (0.8 + colorVariation),
        baseColor.b * (0.5 + colorVariation)
      );
    }

    particles.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3)
    );
    particles.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(colors, 3)
    );

    // Material with custom shader to make particles fade out
    const particleMaterial = new THREE.PointsMaterial({
      size: size,
      transparent: true,
      opacity: 1,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
    });

    // Create particle system
    const particleSystem = new THREE.Points(particles, particleMaterial);
    particleSystem.position.copy(position);
    this.scene.add(particleSystem);

    // Add to explosions array
    this.explosions = this.explosions || [];
    this.explosions.push({
      system: particleSystem,
      velocities: velocities,
      age: 0,
      lifetime: 1, // Seconds
      size,
      originalSize: size,
    });
  }

  updateExplosions(deltaTime) {
    if (!this.explosions) return;

    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const explosion = this.explosions[i];

      // Update age
      explosion.age += deltaTime;

      // Remove if too old
      if (explosion.age > explosion.lifetime) {
        this.scene.remove(explosion.system);
        this.explosions.splice(i, 1);
        continue;
      }

      // Update particles
      const positions = explosion.system.geometry.attributes.position;
      const count = positions.count;

      for (let j = 0; j < count; j++) {
        // Update position based on velocity
        positions.array[j * 3] += explosion.velocities[j * 3] * deltaTime;
        positions.array[j * 3 + 1] +=
          explosion.velocities[j * 3 + 1] * deltaTime;
        positions.array[j * 3 + 2] +=
          explosion.velocities[j * 3 + 2] * deltaTime;
      }

      positions.needsUpdate = true;

      // Fade out
      const progress = explosion.age / explosion.lifetime;
      explosion.system.material.opacity = 1 - progress;
      explosion.system.material.size =
        explosion.originalSize * (1 - progress * 0.5);
    }
  }

  updateEnvironment(deltaTime) {
    // Rotate planets
    this.planets.forEach((planet) => {
      planet.mesh.rotation.y += planet.rotationSpeed;
    });

    // Move and rotate asteroids
    this.asteroids.forEach((asteroid, index) => {
      // Apply rotation
      asteroid.mesh.rotation.x += asteroid.rotationSpeed.x;
      asteroid.mesh.rotation.y += asteroid.rotationSpeed.y;
      asteroid.mesh.rotation.z += asteroid.rotationSpeed.z;

      // Apply movement
      asteroid.mesh.position.x += asteroid.velocity.x;
      asteroid.mesh.position.y += asteroid.velocity.y;
      asteroid.mesh.position.z += asteroid.velocity.z;

      // Update collision object position
      this.collisionObjects[this.planets.length + index].position =
        asteroid.mesh.position;

      // Reset asteroids that drift too far
      const distanceFromCenter = asteroid.mesh.position.distanceTo(
        new THREE.Vector3(0, 0, -500)
      );
      if (distanceFromCenter > 500) {
        // Reset position
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 300;
        asteroid.mesh.position.set(
          Math.cos(angle) * distance,
          (Math.random() - 0.5) * 300,
          -500 + Math.sin(angle) * distance
        );
      }
    });

    // Slowly rotate the Death Star
    if (this.deathStar) {
      this.deathStar.rotation.y += 0.0002;
    }

    // Update explosions
    this.updateExplosions(deltaTime);
  }

  getDeathStar() {
    return this.deathStar;
  }

  getCollisionObjects() {
    return this.collisionObjects;
  }

  createTieFighter(x, y, z) {
    // Create a simple TIE fighter using basic geometry
    const group = new THREE.Group();

    // Center pod (spherical)
    const podGeometry = new THREE.SphereGeometry(2, 32, 32);
    const podMaterial = new THREE.MeshPhongMaterial({
      color: 0xcccccc,
      shininess: 30,
      specular: 0x666666,
    });
    const pod = new THREE.Mesh(podGeometry, podMaterial);
    group.add(pod);

    // Add cockpit window
    const windowGeometry = new THREE.SphereGeometry(
      1.5,
      32,
      32,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2
    );
    const windowMaterial = new THREE.MeshPhongMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.7,
      shininess: 100,
      specular: 0xffffff,
    });
    const cockpit = new THREE.Mesh(windowGeometry, windowMaterial);
    cockpit.rotation.x = Math.PI;
    cockpit.position.z = 0.5;
    pod.add(cockpit);

    // Wings (hexagonal)
    const wingGeometry = new THREE.CylinderGeometry(8, 8, 0.5, 6);
    const wingMaterial = new THREE.MeshPhongMaterial({
      color: 0xdddddd,
      shininess: 20,
      specular: 0x666666,
    });

    const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    leftWing.rotation.z = Math.PI / 2;
    leftWing.position.set(-5, 0, 0);
    group.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    rightWing.rotation.z = Math.PI / 2;
    rightWing.position.set(5, 0, 0);
    group.add(rightWing);

    // Add wing details
    const wingDetailGeometry = new THREE.CylinderGeometry(7.5, 7.5, 0.2, 6);
    const wingDetailMaterial = new THREE.MeshPhongMaterial({
      color: 0xbbbbbb,
      shininess: 30,
      specular: 0x555555,
    });

    const leftWingDetail = new THREE.Mesh(
      wingDetailGeometry,
      wingDetailMaterial
    );
    leftWingDetail.rotation.z = Math.PI / 2;
    leftWingDetail.position.set(-5, 0, 0);
    group.add(leftWingDetail);

    const rightWingDetail = new THREE.Mesh(
      wingDetailGeometry,
      wingDetailMaterial
    );
    rightWingDetail.rotation.z = Math.PI / 2;
    rightWingDetail.position.set(5, 0, 0);
    group.add(rightWingDetail);

    // Add engine glow
    const engineGlowGeometry = new THREE.SphereGeometry(0.8, 16, 16);
    const engineGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.8,
    });

    const engine1 = new THREE.Mesh(engineGlowGeometry, engineGlowMaterial);
    engine1.position.set(0, 0, 2);
    group.add(engine1);

    // Add engine exhaust
    const exhaustGeometry = new THREE.ConeGeometry(0.5, 2, 8);
    const exhaustMaterial = new THREE.MeshBasicMaterial({
      color: 0xff3300,
      transparent: true,
      opacity: 0.6,
    });

    const exhaust1 = new THREE.Mesh(exhaustGeometry, exhaustMaterial);
    exhaust1.rotation.x = Math.PI / 2;
    exhaust1.position.set(0, 0, 3);
    group.add(exhaust1);

    // Add wing struts
    const strutGeometry = new THREE.CylinderGeometry(0.3, 0.3, 5, 8);
    const strutMaterial = new THREE.MeshPhongMaterial({
      color: 0xbbbbbb,
      shininess: 20,
      specular: 0x555555,
    });

    const leftStrut = new THREE.Mesh(strutGeometry, strutMaterial);
    leftStrut.rotation.z = Math.PI / 2;
    leftStrut.position.set(-2.5, 0, 0);
    group.add(leftStrut);

    const rightStrut = new THREE.Mesh(strutGeometry, strutMaterial);
    rightStrut.rotation.z = Math.PI / 2;
    rightStrut.position.set(2.5, 0, 0);
    group.add(rightStrut);

    // Add wing edges
    const edgeGeometry = new THREE.TorusGeometry(8, 0.2, 8, 6);
    const edgeMaterial = new THREE.MeshPhongMaterial({
      color: 0xdddddd,
      shininess: 30,
      specular: 0x666666,
    });

    const leftEdge = new THREE.Mesh(edgeGeometry, edgeMaterial);
    leftEdge.rotation.x = Math.PI / 2;
    leftEdge.position.set(-5, 0, 0);
    group.add(leftEdge);

    const rightEdge = new THREE.Mesh(edgeGeometry, edgeMaterial);
    rightEdge.rotation.x = Math.PI / 2;
    rightEdge.position.set(5, 0, 0);
    group.add(rightEdge);

    // Position in scene
    group.position.set(x, y, z);
    this.scene.add(group);

    // Add to targets array with properties
    this.targets.push({
      mesh: group,
      position: group.position,
      radius: 8, // Collision radius
      health: 50,
      velocity: new THREE.Vector3(
        Math.random() * 0.2 - 0.1,
        Math.random() * 0.1 - 0.05,
        Math.random() * 0.2 - 0.1
      ),
      rotation: new THREE.Vector3(
        Math.random() * 0.01,
        Math.random() * 0.01,
        Math.random() * 0.01
      ),
    });
  }

  createEnemyFighters() {
    // Create 10 TIE fighters
    for (let i = 0; i < 10; i++) {
      this.createTieFighter(
        Math.random() * 400 - 200, // x
        Math.random() * 200 - 100, // y
        Math.random() * -800 - 200 // z
      );
    }
  }

  updateEnemies(deltaTime, shipState) {
    for (let i = 0; i < this.targets.length; i++) {
      const target = this.targets[i];

      // Move target
      target.mesh.position.add(target.velocity);

      // Random rotation
      target.mesh.rotation.x += target.rotation.x;
      target.mesh.rotation.y += target.rotation.y;
      target.mesh.rotation.z += target.rotation.z;

      // Update position
      target.position.copy(target.mesh.position);

      // Basic AI: chase player if close, otherwise wander
      const distanceToPlayer = target.position.distanceTo(shipState.position);

      if (distanceToPlayer < 200) {
        // Move toward player with some randomness
        const toPlayer = new THREE.Vector3().subVectors(
          shipState.position,
          target.position
        );
        toPlayer.normalize().multiplyScalar(0.15 * deltaTime * 60);

        // Add some randomness
        toPlayer.x += (Math.random() - 0.5) * 0.05;
        toPlayer.y += (Math.random() - 0.5) * 0.05;
        toPlayer.z += (Math.random() - 0.5) * 0.05;

        target.velocity.lerp(toPlayer, 0.01);
      }

      // Limit velocity
      if (target.velocity.length() > 0.2) {
        target.velocity.normalize().multiplyScalar(0.2);
      }

      // Keep within game bounds
      if (Math.abs(target.position.x) > 500) {
        target.velocity.x *= -1;
      }
      if (Math.abs(target.position.y) > 300) {
        target.velocity.y *= -1;
      }
      if (target.position.z < -1500 || target.position.z > 500) {
        target.velocity.z *= -1;
      }
    }
  }

  destroyTarget(targetIndex) {
    const target = this.targets[targetIndex];
    if (!target) return;

    // Remove from scene
    this.scene.remove(target.mesh);

    // Remove from targets array
    this.targets.splice(targetIndex, 1);
  }

  getTargets() {
    return this.targets;
  }
}

export default EnvironmentManager;
