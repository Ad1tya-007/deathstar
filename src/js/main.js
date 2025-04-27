import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Main scene variables
let scene, camera, renderer;
let orbitControls; // Development controls
let starfield;
let xwing; // Reference to our X-Wing
let deathStar; // Reference to the Death Star
let planets = []; // Array to hold planet objects
let asteroids = []; // Array to hold asteroid objects
let clock; // For frame-independent movement
let collisionObjects = []; // Objects that can be collided with
let lasers = []; // Array to hold laser projectiles
let explosions = []; // Array to hold explosion effects
let targets = []; // Targets that can be shot (TIE fighters, etc.)
let uiElements = {}; // Store UI elements

// Add sound effects for lasers and explosions
let audioListener;
let laserSound, explosionSound;

// Physics variables
const shipState = {
  velocity: new THREE.Vector3(0, 0, 0),
  rotation: new THREE.Euler(0, 0, 0),
  position: new THREE.Vector3(0, 0, 0),
  acceleration: 0,
  rotationSpeed: 0,
  maxSpeed: 1.0,
  drag: 0.98,
  currentSpeed: 0, // Current speed of the ship
  speedIncrement: 0.01, // How much to change speed per keypress
  maxForwardSpeed: 1.5, // Maximum forward speed
  maxReverseSpeed: -0.3, // Maximum reverse speed
  barrelRoll: {
    active: false,
    direction: 1, // 1 for right (E), -1 for left (Q)
    progress: 0,
    speed: 0.05,
    duration: Math.PI * 2, // Full 360 degree roll
  },
  collisionRadius: 4, // Radius for collision detection
  invulnerable: false,
  health: 100,
  // Combat properties
  canShoot: true,
  shootCooldown: 0.25, // Time between shots in seconds
  lastShotTime: 0,
  laserSpeed: 500.0, // Speed of laser projectiles
  laserRange: 200.0, // How far lasers can travel (exactly 5 units)
  laserDamage: 25, // Damage per laser hit
};

// Game state
const gameState = {
  isGameOver: false,
  score: 0,
  objective: 'Reach the Death Star trench',
  killCount: 0,
};

// Input state
const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  q: false,
  e: false,
  f: false, // Added F key for firing
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
  ' ': false, // space
};

// Mouse state
const mouse = {
  x: 0,
  y: 0,
  isDown: false,
};

// Initialize the scene
function init() {
  // Create scene
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.0008); // Add fog for better depth effect

  // Create clock for frame-independent movement
  clock = new THREE.Clock();

  // Create camera
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
  );
  camera.position.z = 10;
  camera.position.y = 0;

  // Add audio listener to camera
  audioListener = new THREE.AudioListener();
  camera.add(audioListener);

  // Load sound effects
  loadSoundEffects();

  // Create renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // Add orbit controls for development (can be toggled off later)
  orbitControls = new OrbitControls(camera, renderer.domElement);
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.05;
  orbitControls.enabled = false; // Disable by default, use 'o' key to toggle

  // Add ambient light
  const ambientLight = new THREE.AmbientLight(0x404040);
  scene.add(ambientLight);

  // Add directional light (sun)
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(100, 100, 100);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 500;
  scene.add(directionalLight);

  // Create starfield background
  createStarfield();

  // Create the environment
  createEnvironment();

  // Create Death Star
  createDeathStar();

  // Add X-Wing model
  createSimpleXWing();

  // Add enemy TIE fighters
  createEnemyFighters();

  // Setup event listeners
  setupEventListeners();

  // Handle window resize
  window.addEventListener('resize', onWindowResize);

  // Initialize UI
  initUI();
}

// Create a simple starfield background
function createStarfield() {
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
  starfield = new THREE.Points(starsGeometry, starsMaterial);
  scene.add(starfield);
}

// Create space environment with planets, asteroids
function createEnvironment() {
  // Add some planets
  createPlanet(-500, 100, -1000, 100, 'earth', 0x3498db); // Blue planet
  createPlanet(800, -50, -1200, 150, 'gas-giant', 0xe74c3c); // Red gas giant
  createPlanet(200, 300, -800, 80, 'rocky', 0xf39c12); // Rocky orange planet

  // Add asteroid field between player and Death Star
  createAsteroidField(0, 0, -500, 300, 50);
}

// Create a simple planet
function createPlanet(x, y, z, radius, type, color) {
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

  scene.add(planet);
  planets.push({
    mesh: planet,
    radius: radius,
    rotationSpeed: Math.random() * 0.005,
  });

  // Add to collision objects
  collisionObjects.push({
    mesh: planet,
    position: planet.position,
    radius: radius,
    type: 'planet',
  });
}

// Create an asteroid field
function createAsteroidField(centerX, centerY, centerZ, radius, count) {
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

    scene.add(asteroid);

    // Add to asteroids array
    asteroids.push({
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
    collisionObjects.push({
      mesh: asteroid,
      position: asteroid.position,
      radius: scale,
      type: 'asteroid',
    });
  }
}

// Create the Death Star
function createDeathStar() {
  // Create the main sphere
  const deathStarGeometry = new THREE.SphereGeometry(300, 64, 64);
  const deathStarMaterial = new THREE.MeshPhongMaterial({
    color: 0xcccccc,
    shininess: 10,
    flatShading: false,
  });

  deathStar = new THREE.Mesh(deathStarGeometry, deathStarMaterial);
  deathStar.position.set(0, 0, -2000); // Far in the distance

  // Create the superlaser indent
  const superlaser = new THREE.Mesh(
    new THREE.CircleGeometry(60, 32),
    new THREE.MeshBasicMaterial({ color: 0x333333 })
  );
  superlaser.position.z = 299; // Just outside the sphere
  deathStar.add(superlaser);

  // Create the equatorial trench
  const trenchGeometry = new THREE.TorusGeometry(300, 10, 16, 100);
  const trenchMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
  const trench = new THREE.Mesh(trenchGeometry, trenchMaterial);
  trench.rotation.x = Math.PI / 2;
  deathStar.add(trench);

  // Add Death Star to scene
  scene.add(deathStar);

  // Add to collision objects
  collisionObjects.push({
    mesh: deathStar,
    position: deathStar.position,
    radius: 300,
    type: 'deathstar',
  });
}

// Create a simple X-Wing model
function createSimpleXWing() {
  // Create a simple X-Wing using basic geometry
  const group = new THREE.Group();

  // Main body
  const bodyGeometry = new THREE.BoxGeometry(3, 1, 6);
  const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x999999 });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  group.add(body);

  // Wings
  const wingGeometry = new THREE.BoxGeometry(8, 0.2, 3);
  const wingMaterial = new THREE.MeshPhongMaterial({ color: 0xcc0000 });

  const wingTop1 = new THREE.Mesh(wingGeometry, wingMaterial);
  wingTop1.position.set(4, 0.6, 0);
  wingTop1.rotation.z = Math.PI * 0.1;
  group.add(wingTop1);

  const wingTop2 = new THREE.Mesh(wingGeometry, wingMaterial);
  wingTop2.position.set(-4, 0.6, 0);
  wingTop2.rotation.z = -Math.PI * 0.1;
  group.add(wingTop2);

  const wingBottom1 = new THREE.Mesh(wingGeometry, wingMaterial);
  wingBottom1.position.set(4, -0.6, 0);
  wingBottom1.rotation.z = -Math.PI * 0.1;
  group.add(wingBottom1);

  const wingBottom2 = new THREE.Mesh(wingGeometry, wingMaterial);
  wingBottom2.position.set(-4, -0.6, 0);
  wingBottom2.rotation.z = Math.PI * 0.1;
  group.add(wingBottom2);

  // Cockpit
  const cockpitGeometry = new THREE.SphereGeometry(0.8, 16, 16);
  const cockpitMaterial = new THREE.MeshPhongMaterial({
    color: 0x88ccff,
    transparent: true,
    opacity: 0.7,
  });
  const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
  cockpit.position.set(0, 0.5, -1);
  group.add(cockpit);

  // Engine glow
  const engineGlowGeometry = new THREE.CylinderGeometry(0.5, 0.3, 1.5, 16);
  const engineGlowMaterial = new THREE.MeshPhongMaterial({
    color: 0x00ffff,
    emissive: 0x00ffff,
    emissiveIntensity: 0.5,
  });

  const engineLeft = new THREE.Mesh(engineGlowGeometry, engineGlowMaterial);
  engineLeft.position.set(1.5, 0, 3);
  engineLeft.rotation.x = Math.PI / 2;
  group.add(engineLeft);

  const engineRight = new THREE.Mesh(engineGlowGeometry, engineGlowMaterial);
  engineRight.position.set(-1.5, 0, 3);
  engineRight.rotation.x = Math.PI / 2;
  group.add(engineRight);

  // Ensure the X-Wing is properly aligned initially
  group.rotation.set(0, 0, 0);

  // Add to scene
  scene.add(group);

  // Store reference to X-Wing
  xwing = group;

  // Initialize position
  shipState.position = new THREE.Vector3(0, 0, 0);
  xwing.position.copy(shipState.position);
}

// Load sound effects
function loadSoundEffects() {
  // Laser sound
  const laserBuffer = new THREE.AudioLoader().load(
    'https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/sounds/ping.mp3',
    function (buffer) {
      laserSound = new THREE.Audio(audioListener);
      laserSound.setBuffer(buffer);
      laserSound.setVolume(0.5);
    }
  );

  // Explosion sound
  const explosionBuffer = new THREE.AudioLoader().load(
    'https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/sounds/376737_Skullbeatz___Bad_Cat_Maste.mp3',
    function (buffer) {
      explosionSound = new THREE.Audio(audioListener);
      explosionSound.setBuffer(buffer);
      explosionSound.setVolume(0.5);
    }
  );
}

// Create enemy TIE fighters
function createEnemyFighters() {
  // Create 10 TIE fighters
  for (let i = 0; i < 10; i++) {
    createTieFighter(
      Math.random() * 400 - 200, // x
      Math.random() * 200 - 100, // y
      Math.random() * -800 - 200 // z
    );
  }
}

// Create a single TIE fighter
function createTieFighter(x, y, z) {
  // Create a simple TIE fighter using basic geometry
  const group = new THREE.Group();

  // Center pod (spherical)
  const podGeometry = new THREE.SphereGeometry(3, 16, 16);
  const podMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
  const pod = new THREE.Mesh(podGeometry, podMaterial);
  group.add(pod);

  // Wings (hexagonal)
  const wingGeometry = new THREE.CylinderGeometry(8, 8, 1, 6);
  const wingMaterial = new THREE.MeshPhongMaterial({ color: 0x666666 });

  const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
  leftWing.rotation.z = Math.PI / 2;
  leftWing.position.set(-5, 0, 0);
  group.add(leftWing);

  const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
  rightWing.rotation.z = Math.PI / 2;
  rightWing.position.set(5, 0, 0);
  group.add(rightWing);

  // Add red glow for engines
  const engineGlowGeometry = new THREE.SphereGeometry(0.5, 8, 8);
  const engineGlowMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.8,
  });

  const engine1 = new THREE.Mesh(engineGlowGeometry, engineGlowMaterial);
  engine1.position.set(0, 0, 2);
  group.add(engine1);

  // Position in scene
  group.position.set(x, y, z);
  scene.add(group);

  // Add to targets array with properties
  targets.push({
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

// Setup event listeners for keyboard and mouse
function setupEventListeners() {
  // Keyboard events
  window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) {
      keys[e.key] = true;
    }

    // Toggle orbital controls for development with 'o' key
    if (e.key === 'o') {
      orbitControls.enabled = !orbitControls.enabled;
    }

    // Trigger barrel roll with Q or E if not already active
    if ((e.key === 'q' || e.key === 'e') && !shipState.barrelRoll.active) {
      startBarrelRoll(e.key === 'e' ? 1 : -1);
    }

    // Fire laser with F key
    if (e.key === 'f') {
      fireLaser();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) {
      keys[e.key] = false;
    }
  });

  // Mouse movement for aiming
  window.addEventListener('mousemove', (e) => {
    // Convert mouse position to normalized device coordinates (-1 to +1)
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  // Mouse buttons for shooting - keep tracking but don't fire
  window.addEventListener('mousedown', () => {
    mouse.isDown = true;
  });

  window.addEventListener('mouseup', () => {
    mouse.isDown = false;
  });
}

// Update the fireLaser function to create longer and thicker lasers
function fireLaser() {
  // Check if we can shoot
  const currentTime = clock.getElapsedTime();
  if (currentTime - shipState.lastShotTime < shipState.shootCooldown) {
    return; // Still on cooldown
  }

  // Update last shot time and reduce ammo
  shipState.lastShotTime = currentTime;

  // Create laser geometry - longer and thicker for better visibility
  const laserGeometry = new THREE.CylinderGeometry(0.5, 0.5, 5, 8); // 5x thicker and 5x longer
  const laserMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.8,
    emissive: 0xff0000,
    emissiveIntensity: 1.0,
  });

  // Create a single laser from the nose of the X-Wing
  const laser = new THREE.Mesh(laserGeometry, laserMaterial);

  // Position the laser at the nose of the X-Wing
  const nosePosition = new THREE.Vector3(0, 0, -3); // Nose position in local space
  nosePosition.applyMatrix4(xwing.matrixWorld); // Convert to world space

  laser.position.copy(nosePosition);

  // Rotate to match ship direction
  laser.quaternion.copy(xwing.quaternion);
  laser.rotateX(Math.PI / 2); // Align with ship's forward direction

  // Add to scene
  scene.add(laser);

  // Get exact direction the X-Wing is facing
  const forwardDir = new THREE.Vector3(0, 0, -1)
    .applyQuaternion(xwing.quaternion)
    .normalize();

  // Add to lasers array with exact travel distance
  lasers.push({
    mesh: laser,
    velocity: forwardDir.multiplyScalar(shipState.laserSpeed),
    startPosition: nosePosition.clone(),
    distance: 0,
    maxDistance: shipState.laserRange,
    damage: shipState.laserDamage,
  });

  // Play laser sound
  if (laserSound && laserSound.isPlaying) {
    laserSound.stop();
  }
  if (laserSound) {
    laserSound.play();
  }
}

// Update the updateLasers function to be more precise with distance calculation and no physics
function updateLasers(deltaTime) {
  // Update each laser
  for (let i = lasers.length - 1; i >= 0; i--) {
    const laser = lasers[i];

    // Move laser forward
    laser.mesh.position.add(laser.velocity.clone().multiplyScalar(deltaTime));

    // Calculate exact distance traveled from starting point
    const distanceTraveled = laser.mesh.position.distanceTo(
      laser.startPosition
    );

    // Check if laser has traveled its maximum distance
    if (distanceTraveled >= laser.maxDistance) {
      // Remove laser once it travels exactly 5 units
      scene.remove(laser.mesh);
      lasers.splice(i, 1);
      continue;
    }

    // Check for collision with targets
    for (let j = targets.length - 1; j >= 0; j--) {
      const target = targets[j];

      // Calculate distance
      const distance = laser.mesh.position.distanceTo(target.position);

      // Check if hit
      if (distance < target.radius) {
        // Apply damage
        target.health -= laser.damage;

        // Create explosion effect
        createExplosionEffect(laser.mesh.position, 0.5, 0xff0000);

        // Remove laser
        scene.remove(laser.mesh);
        lasers.splice(i, 1);

        // Check if target destroyed
        if (target.health <= 0) {
          // Create larger explosion
          createExplosionEffect(target.position, 2, 0xffaa00);

          // Remove target
          scene.remove(target.mesh);
          targets.splice(j, 1);

          // Increase score
          gameState.score += 100;
          gameState.killCount++;

          // Play explosion sound
          if (explosionSound) {
            explosionSound.play();
          }
        }

        break; // Laser can only hit one target
      }
    }

    // Check for collision with asteroids
    for (let j = 0; j < asteroids.length; j++) {
      const asteroid = asteroids[j];

      // Calculate distance
      const distance = laser.mesh.position.distanceTo(asteroid.mesh.position);

      // Check if hit
      if (distance < asteroid.radius) {
        // Create explosion effect
        createExplosionEffect(laser.mesh.position, 0.5, 0xaaaaaa);

        // Remove laser
        scene.remove(laser.mesh);
        lasers.splice(i, 1);

        // Small chance to destroy asteroid
        if (Math.random() < 0.25) {
          createExplosionEffect(
            asteroid.mesh.position,
            asteroid.radius,
            0xaaaaaa
          );
          scene.remove(asteroid.mesh);

          // Find and remove from collision objects
          const asteroidIndex = collisionObjects.findIndex(
            (obj) => obj.mesh === asteroid.mesh
          );
          if (asteroidIndex !== -1) {
            collisionObjects.splice(asteroidIndex, 1);
          }

          // Remove from asteroids array
          asteroids.splice(j, 1);
        }

        break;
      }
    }
  }
}

// Create explosion effect
function createExplosionEffect(position, size, color) {
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
  particles.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

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
  scene.add(particleSystem);

  // Add to explosions array
  explosions.push({
    system: particleSystem,
    velocities: velocities,
    age: 0,
    lifetime: 1, // Seconds
    size,
    originalSize: size,
  });
}

// Update explosions
function updateExplosions(deltaTime) {
  for (let i = explosions.length - 1; i >= 0; i--) {
    const explosion = explosions[i];

    // Update age
    explosion.age += deltaTime;

    // Remove if too old
    if (explosion.age > explosion.lifetime) {
      scene.remove(explosion.system);
      explosions.splice(i, 1);
      continue;
    }

    // Update particles
    const positions = explosion.system.geometry.attributes.position;
    const count = positions.count;

    for (let j = 0; j < count; j++) {
      // Update position based on velocity
      positions.array[j * 3] += explosion.velocities[j * 3] * deltaTime;
      positions.array[j * 3 + 1] += explosion.velocities[j * 3 + 1] * deltaTime;
      positions.array[j * 3 + 2] += explosion.velocities[j * 3 + 2] * deltaTime;
    }

    positions.needsUpdate = true;

    // Fade out
    const progress = explosion.age / explosion.lifetime;
    explosion.system.material.opacity = 1 - progress;
    explosion.system.material.size =
      explosion.originalSize * (1 - progress * 0.5);
  }
}

// Update enemy TIE fighters
function updateEnemies(deltaTime) {
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];

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

    // Occasionally fire at player
    if (distanceToPlayer < 150 && Math.random() < 0.005) {
      createEnemyLaser(target);
    }
  }
}

// Update the createEnemyLaser function to also have thicker and longer lasers
function createEnemyLaser(target) {
  // Create laser geometry
  const laserGeometry = new THREE.CylinderGeometry(0.5, 0.5, 5, 8); // 5x thicker and 5x longer
  const laserMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ff00, // Green for enemy lasers
    transparent: true,
    opacity: 0.8,
    emissive: 0x00ff00,
    emissiveIntensity: 1.0,
  });

  // Create laser mesh
  const laser = new THREE.Mesh(laserGeometry, laserMaterial);

  // Position at enemy
  laser.position.copy(target.position);

  // Direction toward player
  const direction = new THREE.Vector3()
    .subVectors(shipState.position, target.position)
    .normalize();

  // Align laser with direction
  laser.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);

  // Add to scene
  scene.add(laser);

  // Add to lasers array with special tag
  lasers.push({
    mesh: laser,
    velocity: direction.multiplyScalar(1.5), // Slower than player lasers
    startPosition: target.position.clone(),
    distance: 0,
    maxDistance: 5, // Also limit enemy lasers to 5 units
    damage: 10,
    isEnemy: true,
  });
}

// Update the updateShipPhysics function to remove auto-fire on mouse click
function updateShipPhysics(deltaTime) {
  // Get forward vector (in local space, Z-axis points backward in Three.js)
  const forwardVector = new THREE.Vector3(0, 0, -1);
  forwardVector.applyQuaternion(xwing.quaternion);

  // Create a horizontal forward vector for movement without vertical component
  const horizontalForward = new THREE.Vector3(
    forwardVector.x,
    0,
    forwardVector.z
  ).normalize();

  // Update ship speed based on key inputs
  if (keys.w || keys.ArrowUp) {
    // Increase speed up to max
    shipState.currentSpeed = Math.min(
      shipState.currentSpeed + shipState.speedIncrement,
      shipState.maxForwardSpeed
    );
  } else if (keys.s || keys.ArrowDown) {
    // Decrease speed (can go negative for reverse)
    shipState.currentSpeed = Math.max(
      shipState.currentSpeed - shipState.speedIncrement,
      shipState.maxReverseSpeed
    );
  }

  // Apply very slight drag to speed when neither W nor S is pressed
  if (!keys.w && !keys.s && !keys.ArrowUp && !keys.ArrowDown) {
    if (Math.abs(shipState.currentSpeed) < 0.01) {
      shipState.currentSpeed = 0; // Stop completely if very slow
    } else {
      shipState.currentSpeed *= 0.998; // Very slow deceleration
    }
  }

  // Apply rotation based on keys (if not barrel rolling)
  if (!shipState.barrelRoll.active) {
    if (keys.a || keys.ArrowLeft) {
      shipState.rotation.y += 0.05;
    }
    if (keys.d || keys.ArrowRight) {
      shipState.rotation.y -= 0.05;
    }
  }

  // Apply vertical movement as a separate control
  if (keys[' ']) {
    // Space key - pure vertical movement
    shipState.velocity.y += 0.01;
  } else {
    // Apply slight gravity when not using vertical thrusters
    shipState.velocity.y -= 0.002;
  }

  // Apply current speed to velocity using the horizontal forward vector
  // First reset the horizontal velocity components
  shipState.velocity.x = horizontalForward.x * shipState.currentSpeed;
  shipState.velocity.z = horizontalForward.z * shipState.currentSpeed;

  // Apply drag to vertical velocity only
  shipState.velocity.y *= shipState.drag;

  // Limit vertical speed
  if (Math.abs(shipState.velocity.y) > shipState.maxSpeed * 0.5) {
    shipState.velocity.y =
      Math.sign(shipState.velocity.y) * shipState.maxSpeed * 0.5;
  }

  // Update position
  shipState.position.add(shipState.velocity);

  // Apply position and rotation to X-Wing
  xwing.position.copy(shipState.position);
  xwing.rotation.y = shipState.rotation.y;

  // If not barrel rolling, apply normal flight tilts
  if (!shipState.barrelRoll.active) {
    // Tilt the ship slightly based on horizontal turning only
    // NOT based on forward movement
    const tiltFactor = 0.5;
    if (keys.a || keys.ArrowLeft) {
      xwing.rotation.z = Math.min(xwing.rotation.z + 0.01, tiltFactor);
    } else if (keys.d || keys.ArrowRight) {
      xwing.rotation.z = Math.max(xwing.rotation.z - 0.01, -tiltFactor);
    } else {
      // Return to level when not turning
      xwing.rotation.z *= 0.95;
    }

    // Pitch based on speed
    const pitchAmount = shipState.currentSpeed * 0.3;
    xwing.rotation.x = -pitchAmount; // Negative because we want to pitch down when moving forward
  }

  // Check for F key press for continuous firing
  if (keys.f) {
    fireLaser();
  }

  // Update speed display
  updateSpeedDisplay();

  // Update barrel roll if active
  updateBarrelRoll(deltaTime);

  // Check for collisions
  checkCollisions();

  // Check for collisions with enemy lasers
  if (!shipState.invulnerable) {
    for (let i = lasers.length - 1; i >= 0; i--) {
      const laser = lasers[i];

      // Skip player's own lasers
      if (!laser.isEnemy) continue;

      // Distance to player
      const distance = laser.mesh.position.distanceTo(shipState.position);

      // Check collision
      if (distance < shipState.collisionRadius) {
        // Player hit!
        shipState.health -= laser.damage;

        // Remove enemy laser
        scene.remove(laser.mesh);
        lasers.splice(i, 1);

        // Create explosion effect
        createExplosionEffect(shipState.position.clone(), 1, 0xff0000);

        // Temporary invulnerability
        shipState.invulnerable = true;
        setTimeout(() => {
          shipState.invulnerable = false;
        }, 1000);

        // Check for game over
        if (shipState.health <= 0) {
          gameOver('Ship destroyed by enemy fire!');
        }

        break;
      }
    }
  }
}

// Game over function
function gameOver(message) {
  // Mark game as over
  gameState.isGameOver = true;

  // Log to console for debugging
  console.log('Game Over: ' + message);
  console.log(`Final Score: ${gameState.score}`);
  console.log(`Enemy fighters destroyed: ${gameState.killCount}`);

  // Update the game over screen with message and stats
  if (uiElements.gameOverScreen) {
    // Update message
    if (uiElements.gameOverMessage) {
      uiElements.gameOverMessage.textContent = message;
    }

    // Update stats
    if (uiElements.scoreValue) {
      uiElements.scoreValue.textContent = gameState.score;
    }

    if (uiElements.enemiesValue) {
      uiElements.enemiesValue.textContent = gameState.killCount;
    }

    // Show game over screen with fade-in effect
    uiElements.gameOverScreen.style.display = 'flex';
    uiElements.gameOverScreen.style.opacity = '0';

    // Fade in animation
    let opacity = 0;
    const fadeIn = setInterval(() => {
      opacity += 0.05;
      uiElements.gameOverScreen.style.opacity = opacity;
      if (opacity >= 1) {
        clearInterval(fadeIn);
      }
    }, 30);

    // Add dramatic camera shake effect
    const originalPosition = camera.position.clone();
    let shakeIntensity = 1;
    const shakeInterval = setInterval(() => {
      camera.position.x =
        originalPosition.x + (Math.random() - 0.5) * shakeIntensity;
      camera.position.y =
        originalPosition.y + (Math.random() - 0.5) * shakeIntensity;
      camera.position.z =
        originalPosition.z + (Math.random() - 0.5) * shakeIntensity;

      shakeIntensity *= 0.9; // Decrease intensity over time
      if (shakeIntensity < 0.01) {
        clearInterval(shakeInterval);
        camera.position.copy(originalPosition);
      }
    }, 50);

    // Create a large explosion at the player's position
    createExplosionEffect(shipState.position, 10, 0xff5500);

    // Hide the ship
    if (xwing) {
      xwing.visible = false;
    }
  }
}

// Animation loop - update to include combat elements
function animate() {
  requestAnimationFrame(animate);

  // Get delta time for frame-independent movement
  const deltaTime = clock.getDelta();

  // Skip updates if game is over
  if (gameState.isGameOver) return;

  // Update physics and movement
  if (xwing) {
    updateShipPhysics(deltaTime);
    updateCamera();
  }

  // Update environment
  updateEnvironment(deltaTime);

  // Update combat elements
  updateLasers(deltaTime);
  updateExplosions(deltaTime);
  updateEnemies(deltaTime);

  // Update orbit controls if enabled
  if (orbitControls.enabled) {
    orbitControls.update();
  }

  // Slowly rotate the starfield for a dynamic effect
  if (starfield) {
    starfield.rotation.x += 0.0001;
    starfield.rotation.y += 0.0001;
  }

  // Render the scene
  renderer.render(scene, camera);
}

// Update camera to follow the ship
function updateCamera() {
  if (!orbitControls.enabled) {
    // Position camera behind and slightly above the ship
    const cameraOffset = new THREE.Vector3(0, 3, 15);
    const cameraPosition = new THREE.Vector3();

    // Transform offset to ship's local space
    cameraOffset.applyQuaternion(xwing.quaternion);
    cameraPosition.copy(shipState.position).add(cameraOffset);

    // Smoothly move camera to new position
    camera.position.lerp(cameraPosition, 0.05);

    // Look at ship with slight offset for better view
    const lookAtPosition = shipState.position
      .clone()
      .add(new THREE.Vector3(0, 1, 0));
    camera.lookAt(lookAtPosition);
  }
}

// Update the environment elements (planets, asteroids)
function updateEnvironment(deltaTime) {
  // Rotate planets
  planets.forEach((planet) => {
    planet.mesh.rotation.y += planet.rotationSpeed;
  });

  // Move and rotate asteroids
  asteroids.forEach((asteroid, index) => {
    // Apply rotation
    asteroid.mesh.rotation.x += asteroid.rotationSpeed.x;
    asteroid.mesh.rotation.y += asteroid.rotationSpeed.y;
    asteroid.mesh.rotation.z += asteroid.rotationSpeed.z;

    // Apply movement
    asteroid.mesh.position.x += asteroid.velocity.x;
    asteroid.mesh.position.y += asteroid.velocity.y;
    asteroid.mesh.position.z += asteroid.velocity.z;

    // Update collision object position
    collisionObjects[planets.length + index].position = asteroid.mesh.position;

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
  if (deathStar) {
    deathStar.rotation.y += 0.0002;
  }
}

// Check for collisions between ship and objects
function checkCollisions() {
  // Skip collision check if ship is invulnerable
  if (shipState.invulnerable) return;

  // X-Wing position
  const shipPosition = shipState.position;

  // Check against all collision objects
  for (const obj of collisionObjects) {
    // Calculate distance
    const distance = shipPosition.distanceTo(obj.position);

    // Check if colliding (sum of radii > distance)
    if (distance < shipState.collisionRadius + obj.radius) {
      handleCollision(obj);
      break; // Only handle one collision at a time
    }
  }
}

// Handle a collision with an object
function handleCollision(object) {
  switch (object.type) {
    case 'asteroid':
      // Asteroid collision is now fatal
      shipState.health = 0;
      gameOver('Your X-Wing was destroyed by an asteroid!');
      break;

    case 'planet':
      // Planet collision is fatal
      shipState.health = 0;
      gameOver('Your X-Wing crashed into a planet!');
      break;

    case 'deathstar':
      // Reaching the Death Star is the goal
      gameOver("Mission Complete! You've reached the Death Star!");
      break;
  }
}

// Start a barrel roll in the specified direction
function startBarrelRoll(direction) {
  shipState.barrelRoll.active = true;
  shipState.barrelRoll.direction = direction;
  shipState.barrelRoll.progress = 0;

  // Temporary invulnerability during barrel roll
  shipState.invulnerable = true;
}

// Update the barrel roll animation
function updateBarrelRoll(deltaTime) {
  if (shipState.barrelRoll.active) {
    // Increase progress
    shipState.barrelRoll.progress += shipState.barrelRoll.speed;

    // Apply the roll rotation around the Z axis (forward axis of the ship)
    const rollAmount =
      shipState.barrelRoll.direction * shipState.barrelRoll.progress;
    xwing.rotation.z = rollAmount;

    // Complete the barrel roll after a full rotation
    if (shipState.barrelRoll.progress >= shipState.barrelRoll.duration) {
      shipState.barrelRoll.active = false;
      shipState.barrelRoll.progress = 0;
      xwing.rotation.z = 0; // Reset roll rotation

      // Remove invulnerability after barrel roll completes
      shipState.invulnerable = false;
    }
  }
}

// Handle window resize
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Add a function to update speed display
function updateSpeedDisplay() {
  // Skip if UI elements are not initialized
  if (!uiElements.speedMeterFill || !uiElements.speedValueDisplay) return;

  // Calculate speed percentage (normalized between -1 and 1)
  const speedPercent = shipState.currentSpeed / shipState.maxForwardSpeed;

  // Update speed meter appearance based on direction
  if (speedPercent >= 0) {
    // Forward speed (green)
    uiElements.speedMeterFill.style.width = speedPercent * 50 + '%';
    uiElements.speedMeterFill.style.left = '50%';
    uiElements.speedMeterFill.style.backgroundColor = '#00ff00';
  } else {
    // Reverse speed (red)
    uiElements.speedMeterFill.style.width = Math.abs(speedPercent) * 50 + '%';
    uiElements.speedMeterFill.style.left =
      50 - Math.abs(speedPercent) * 50 + '%';
    uiElements.speedMeterFill.style.backgroundColor = '#ff3300';
  }

  // Convert to "MGLT" (Megalight per hour) - Star Wars speed unit
  const speedValue = Math.abs(Math.round(speedPercent * 100));
  const direction = speedPercent >= 0 ? 'FORWARD' : 'REVERSE';

  // Update numeric display
  uiElements.speedValueDisplay.textContent = `${speedValue} MGLT`;
  uiElements.speedValueDisplay.style.color =
    speedPercent >= 0 ? '#00ff00' : '#ff3300';

  // Update direction indicator
  if (!uiElements.directionIndicator) {
    uiElements.directionIndicator = document.createElement('div');
    uiElements.directionIndicator.style.fontSize = '12px';
    uiElements.directionIndicator.style.marginTop = '5px';
    uiElements.speedPanel.appendChild(uiElements.directionIndicator);
  }

  uiElements.directionIndicator.textContent = direction;
  uiElements.directionIndicator.style.color =
    speedPercent >= 0 ? '#00ff00' : '#ff3300';
}

// Add a new function to initialize the UI elements
function initUI() {
  // Create a controls panel container
  const controlsPanel = document.createElement('div');
  controlsPanel.style.position = 'fixed';
  controlsPanel.style.bottom = '20px';
  controlsPanel.style.left = '20px';
  controlsPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  controlsPanel.style.color = 'white';
  controlsPanel.style.padding = '15px';
  controlsPanel.style.borderRadius = '10px';
  controlsPanel.style.fontFamily = 'Arial, sans-serif';
  controlsPanel.style.fontSize = '14px';
  controlsPanel.style.zIndex = '1000';
  controlsPanel.style.userSelect = 'none';
  controlsPanel.style.boxShadow = '0 0 10px rgba(0, 255, 255, 0.5)';
  controlsPanel.style.border = '1px solid rgba(0, 255, 255, 0.3)';

  // Add heading
  const heading = document.createElement('div');
  heading.textContent = 'CONTROLS';
  heading.style.fontWeight = 'bold';
  heading.style.marginBottom = '10px';
  heading.style.borderBottom = '1px solid rgba(0, 255, 255, 0.5)';
  heading.style.paddingBottom = '5px';
  heading.style.color = '#00ffff';
  controlsPanel.appendChild(heading);

  // Add control instructions
  const controls = [
    { key: 'W / ↑', action: 'Increase speed' },
    { key: 'S / ↓', action: 'Decrease speed' },
    { key: 'A / ←', action: 'Turn left' },
    { key: 'D / →', action: 'Turn right' },
    { key: 'Q', action: 'Barrel roll left' },
    { key: 'E', action: 'Barrel roll right' },
    { key: 'F', action: 'Fire lasers' },
    { key: 'SPACE', action: 'Move upward' },
  ];

  // Create a table for better alignment
  const table = document.createElement('table');
  table.style.borderCollapse = 'collapse';
  table.style.width = '100%';

  controls.forEach((control) => {
    const row = document.createElement('tr');

    const keyCell = document.createElement('td');
    keyCell.textContent = control.key;
    keyCell.style.padding = '4px 8px 4px 0';
    keyCell.style.fontWeight = 'bold';
    keyCell.style.color = '#ffcc00';
    keyCell.style.whiteSpace = 'nowrap';

    const actionCell = document.createElement('td');
    actionCell.textContent = control.action;
    actionCell.style.padding = '4px 0';

    row.appendChild(keyCell);
    row.appendChild(actionCell);
    table.appendChild(row);
  });

  controlsPanel.appendChild(table);

  // Add minimize/expand button
  const toggleButton = document.createElement('div');
  toggleButton.textContent = '[-]';
  toggleButton.style.position = 'absolute';
  toggleButton.style.top = '10px';
  toggleButton.style.right = '10px';
  toggleButton.style.cursor = 'pointer';
  toggleButton.style.color = '#00ffff';

  let isExpanded = true;
  const tableContainer = table.parentNode;

  toggleButton.addEventListener('click', () => {
    if (isExpanded) {
      table.style.display = 'none';
      toggleButton.textContent = '[+]';
    } else {
      table.style.display = 'table';
      toggleButton.textContent = '[-]';
    }
    isExpanded = !isExpanded;
  });

  controlsPanel.appendChild(toggleButton);

  // Add to document
  document.body.appendChild(controlsPanel);

  // Store reference to control panel
  uiElements.controlsPanel = controlsPanel;

  // Create speed indicator panel
  const speedPanel = document.createElement('div');
  speedPanel.style.position = 'fixed';
  speedPanel.style.bottom = '20px';
  speedPanel.style.right = '20px';
  speedPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  speedPanel.style.color = 'white';
  speedPanel.style.padding = '15px';
  speedPanel.style.borderRadius = '10px';
  speedPanel.style.fontFamily = 'Arial, sans-serif';
  speedPanel.style.fontSize = '14px';
  speedPanel.style.zIndex = '1000';
  speedPanel.style.userSelect = 'none';
  speedPanel.style.boxShadow = '0 0 10px rgba(0, 255, 255, 0.5)';
  speedPanel.style.border = '1px solid rgba(0, 255, 255, 0.3)';
  speedPanel.style.textAlign = 'center';
  speedPanel.style.minWidth = '120px';

  // Add heading
  const speedHeading = document.createElement('div');
  speedHeading.textContent = 'SPEED';
  speedHeading.style.fontWeight = 'bold';
  speedHeading.style.marginBottom = '10px';
  speedHeading.style.borderBottom = '1px solid rgba(0, 255, 255, 0.5)';
  speedHeading.style.paddingBottom = '5px';
  speedHeading.style.color = '#00ffff';
  speedPanel.appendChild(speedHeading);

  // Add speed meter container
  const speedMeterContainer = document.createElement('div');
  speedMeterContainer.style.position = 'relative';
  speedMeterContainer.style.height = '20px';
  speedMeterContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  speedMeterContainer.style.borderRadius = '5px';
  speedMeterContainer.style.overflow = 'hidden';
  speedMeterContainer.style.marginBottom = '8px';
  speedMeterContainer.style.border = '1px solid rgba(255, 255, 255, 0.2)';

  // Create speed meter fill
  const speedMeterFill = document.createElement('div');
  speedMeterFill.style.height = '100%';
  speedMeterFill.style.width = '50%'; // Initial value
  speedMeterFill.style.backgroundColor = '#00ff00'; // Green for positive speed
  speedMeterFill.style.position = 'absolute';
  speedMeterFill.style.left = '50%'; // Center point
  speedMeterFill.style.top = '0';
  speedMeterFill.style.transition =
    'width 0.1s ease-out, background-color 0.2s';
  speedMeterContainer.appendChild(speedMeterFill);

  // Add center line marker
  const centerLine = document.createElement('div');
  centerLine.style.position = 'absolute';
  centerLine.style.left = '50%';
  centerLine.style.top = '0';
  centerLine.style.height = '100%';
  centerLine.style.width = '2px';
  centerLine.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
  centerLine.style.zIndex = '2';
  speedMeterContainer.appendChild(centerLine);

  speedPanel.appendChild(speedMeterContainer);

  // Add numeric speed display
  const speedValueDisplay = document.createElement('div');
  speedValueDisplay.style.fontSize = '18px';
  speedValueDisplay.style.fontWeight = 'bold';
  speedValueDisplay.style.color = '#ffffff';
  speedValueDisplay.textContent = '0 MGLT';
  speedPanel.appendChild(speedValueDisplay);

  // Add to document
  document.body.appendChild(speedPanel);

  // Store references
  uiElements.speedPanel = speedPanel;
  uiElements.speedMeterFill = speedMeterFill;
  uiElements.speedValueDisplay = speedValueDisplay;

  // Create game over screen (initially hidden)
  const gameOverScreen = document.createElement('div');
  gameOverScreen.style.position = 'fixed';
  gameOverScreen.style.top = '0';
  gameOverScreen.style.left = '0';
  gameOverScreen.style.width = '100%';
  gameOverScreen.style.height = '100%';
  gameOverScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  gameOverScreen.style.color = '#ffffff';
  gameOverScreen.style.display = 'flex';
  gameOverScreen.style.flexDirection = 'column';
  gameOverScreen.style.justifyContent = 'center';
  gameOverScreen.style.alignItems = 'center';
  gameOverScreen.style.zIndex = '2000';
  gameOverScreen.style.fontFamily = 'Arial, sans-serif';
  gameOverScreen.style.display = 'none'; // Initially hidden

  // Game over title
  const gameOverTitle = document.createElement('div');
  gameOverTitle.textContent = 'GAME OVER';
  gameOverTitle.style.fontSize = '72px';
  gameOverTitle.style.fontWeight = 'bold';
  gameOverTitle.style.color = '#ff0000';
  gameOverTitle.style.textShadow = '0 0 15px #ff0000';
  gameOverTitle.style.marginBottom = '30px';
  gameOverTitle.style.letterSpacing = '5px';
  gameOverScreen.appendChild(gameOverTitle);

  // Game over message
  const gameOverMessage = document.createElement('div');
  gameOverMessage.textContent = 'Your X-Wing has been destroyed!';
  gameOverMessage.style.fontSize = '24px';
  gameOverMessage.style.marginBottom = '40px';
  gameOverMessage.style.maxWidth = '600px';
  gameOverMessage.style.textAlign = 'center';
  gameOverMessage.style.lineHeight = '1.5';
  gameOverScreen.appendChild(gameOverMessage);

  // Statistics container
  const statsContainer = document.createElement('div');
  statsContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
  statsContainer.style.padding = '20px';
  statsContainer.style.borderRadius = '10px';
  statsContainer.style.marginBottom = '40px';
  statsContainer.style.minWidth = '300px';
  statsContainer.style.border = '1px solid rgba(255, 255, 255, 0.2)';

  // Stats table
  const statsTable = document.createElement('table');
  statsTable.style.width = '100%';
  statsTable.style.borderCollapse = 'collapse';

  // Add score stat
  const scoreRow = document.createElement('tr');
  const scoreLabel = document.createElement('td');
  scoreLabel.textContent = 'SCORE:';
  scoreLabel.style.padding = '8px';
  scoreLabel.style.color = '#00ffff';
  scoreLabel.style.fontWeight = 'bold';
  scoreLabel.style.textAlign = 'right';

  const scoreValue = document.createElement('td');
  scoreValue.textContent = '0';
  scoreValue.style.padding = '8px';
  scoreValue.style.textAlign = 'left';
  scoreValue.style.fontWeight = 'bold';

  scoreRow.appendChild(scoreLabel);
  scoreRow.appendChild(scoreValue);
  statsTable.appendChild(scoreRow);

  // Add enemies destroyed stat
  const enemiesRow = document.createElement('tr');
  const enemiesLabel = document.createElement('td');
  enemiesLabel.textContent = 'FIGHTERS DESTROYED:';
  enemiesLabel.style.padding = '8px';
  enemiesLabel.style.color = '#00ffff';
  enemiesLabel.style.fontWeight = 'bold';
  enemiesLabel.style.textAlign = 'right';

  const enemiesValue = document.createElement('td');
  enemiesValue.textContent = '0';
  enemiesValue.style.padding = '8px';
  enemiesValue.style.textAlign = 'left';
  enemiesValue.style.fontWeight = 'bold';

  enemiesRow.appendChild(enemiesLabel);
  enemiesRow.appendChild(enemiesValue);
  statsTable.appendChild(enemiesRow);

  statsContainer.appendChild(statsTable);
  gameOverScreen.appendChild(statsContainer);

  // Restart button
  const restartButton = document.createElement('div');
  restartButton.textContent = 'RESTART MISSION';
  restartButton.style.backgroundColor = '#00ffff';
  restartButton.style.color = '#000000';
  restartButton.style.padding = '15px 30px';
  restartButton.style.borderRadius = '5px';
  restartButton.style.cursor = 'pointer';
  restartButton.style.fontWeight = 'bold';
  restartButton.style.fontSize = '18px';
  restartButton.style.letterSpacing = '1px';
  restartButton.style.boxShadow = '0 0 15px rgba(0, 255, 255, 0.5)';
  restartButton.style.transition = 'all 0.2s';

  // Hover effect for button
  restartButton.addEventListener('mouseover', () => {
    restartButton.style.backgroundColor = '#ffffff';
    restartButton.style.boxShadow = '0 0 20px rgba(0, 255, 255, 0.8)';
  });

  restartButton.addEventListener('mouseout', () => {
    restartButton.style.backgroundColor = '#00ffff';
    restartButton.style.boxShadow = '0 0 15px rgba(0, 255, 255, 0.5)';
  });

  // Click handler for restart
  restartButton.addEventListener('click', () => {
    location.reload(); // Simple reload for now
  });

  gameOverScreen.appendChild(restartButton);

  // Add to document
  document.body.appendChild(gameOverScreen);

  // Store references for later use
  uiElements.gameOverScreen = gameOverScreen;
  uiElements.gameOverMessage = gameOverMessage;
  uiElements.scoreValue = scoreValue;
  uiElements.enemiesValue = enemiesValue;
}

// Initialize and start animation
init();
animate();
