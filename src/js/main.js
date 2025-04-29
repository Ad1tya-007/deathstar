import * as THREE from 'three';
import {
  AudioManager,
  CameraManager,
  EnvironmentManager,
} from '../manager/index.js';

// Main scene variables
let scene, camera, renderer;
let cameraManager; // New camera manager instance
let environmentManager; // New environment manager instance
let xwing; // Reference to our X-Wing
let clock; // For frame-independent movement
let lasers = []; // Array to hold laser projectiles
let explosions = []; // Array to hold explosion effects
let targets = []; // Targets that can be shot (TIE fighters, etc.)
let uiElements = {}; // Store UI elements
let isMobile = false; // Flag to track if we're on mobile

// Game settings
const gameSettings = {
  xwingColor: 'red', // Default color: red, can be 'red', 'blue', 'green', 'yellow'

  // Color options with their hex values
  colors: {
    red: { wing: 0xcc0000, laser: 0xff0000 },
    blue: { wing: 0x0066cc, laser: 0x0099ff },
    green: { wing: 0x00cc44, laser: 0x00ff66 },
    yellow: { wing: 0xccaa00, laser: 0xffcc00 },
  },
};

// Create a singleton instance
let audioManager = null;

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

// Check if device is mobile
function checkIfMobile() {
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    ) || window.innerWidth < 800
  );
}

// Initialize the scene
function init() {
  // Check if running on mobile
  isMobile = checkIfMobile();
  console.log('Is mobile device:', isMobile);

  // Create scene
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.0008); // Add fog for better depth effect

  // Create clock for frame-independent movement
  clock = new THREE.Clock();

  // Create renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // Initialize camera manager
  cameraManager = new CameraManager(scene, renderer);
  const { camera: newCamera, audioListener } = cameraManager.init();
  camera = newCamera;

  // Initialize environment manager
  environmentManager = new EnvironmentManager(scene);
  environmentManager.createStarfield();

  // Create the environment
  environmentManager.createPlanet(-500, 100, -1000, 100, 'earth', 0x3498db); // Blue planet
  environmentManager.createPlanet(800, -50, -1200, 150, 'gas-giant', 0xe74c3c); // Red gas giant
  environmentManager.createPlanet(200, 300, -800, 80, 'rocky', 0xf39c12); // Rocky orange planet
  environmentManager.createAsteroidField(0, 0, -500, 300, 50);

  // Create Death Star
  environmentManager.createDeathStar();

  // Initialize audio manager
  audioManager = new AudioManager(audioListener);
  audioManager.loadSounds();

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

  // Add X-Wing model
  createSimpleXWing();

  // Add enemy TIE fighters
  environmentManager.createEnemyFighters();

  // Setup event listeners
  setupEventListeners();

  // Handle window resize
  window.addEventListener('resize', onWindowResize);

  // Initialize UI
  initUI();
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
  // Use the color from settings
  const wingColor = gameSettings.colors[gameSettings.xwingColor].wing;
  const wingMaterial = new THREE.MeshPhongMaterial({ color: wingColor });

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

// Setup event listeners for keyboard and mouse
function setupEventListeners() {
  // Keyboard events
  window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) {
      keys[e.key] = true;
    }

    // Toggle orbital controls for development with 'o' key
    if (e.key === 'o') {
      cameraManager.toggleOrbitControls();
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

// Update the fireLaser function to remove sound playback
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

  // Use the laser color from settings
  const laserColor = gameSettings.colors[gameSettings.xwingColor].laser;
  const laserMaterial = new THREE.MeshBasicMaterial({
    color: laserColor,
    transparent: true,
    opacity: 0.8,
    emissive: laserColor,
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

  // No sound for lasers
}

// Update the updateLasers function to use environmentManager for target destruction
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
    for (let j = environmentManager.getTargets().length - 1; j >= 0; j--) {
      const target = environmentManager.getTargets()[j];

      // Calculate distance
      const distance = laser.mesh.position.distanceTo(target.position);

      // Check if hit
      if (distance < target.radius) {
        // Apply damage
        target.health -= laser.damage;

        // Create explosion effect
        environmentManager.createExplosionEffect(
          laser.mesh.position,
          0.5,
          0xff0000
        );

        // Remove laser
        scene.remove(laser.mesh);
        lasers.splice(i, 1);

        // Check if target destroyed
        if (target.health <= 0) {
          // Create larger explosion
          environmentManager.createExplosionEffect(
            target.position,
            2,
            0xffaa00
          );

          // Remove target
          environmentManager.destroyTarget(j);

          // Increase score
          gameState.score += 100;

          // Update the UI score display
          updateScoreDisplay();
        }

        break; // Laser can only hit one target
      }
    }

    // Check for collision with asteroids
    for (let j = 0; j < environmentManager.asteroids.length; j++) {
      const asteroid = environmentManager.asteroids[j];

      // Calculate distance
      const distance = laser.mesh.position.distanceTo(asteroid.mesh.position);

      // Check if hit
      if (distance < asteroid.radius) {
        // Create explosion effect
        environmentManager.createExplosionEffect(
          laser.mesh.position,
          0.5,
          0xaaaaaa
        );

        // Remove laser
        scene.remove(laser.mesh);
        lasers.splice(i, 1);

        // Small chance to destroy asteroid
        if (Math.random() < 0.25) {
          environmentManager.createExplosionEffect(
            asteroid.mesh.position,
            asteroid.radius,
            0xaaaaaa
          );
          environmentManager.destroyAsteroid(j);

          // Add points for destroying asteroid
          gameState.score += 25;
          updateScoreDisplay();
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
      shipState.rotation.y += 0.02;
    }
    if (keys.d || keys.ArrowRight) {
      shipState.rotation.y -= 0.02;
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
    cameraManager.update(xwing, shipState);
  }

  // Update environment
  environmentManager.updateEnvironment(deltaTime);
  environmentManager.updateStarfield();
  environmentManager.updateEnemies(deltaTime, shipState);

  // Update combat elements
  updateLasers(deltaTime);
  updateExplosions(deltaTime);

  // Render the scene
  renderer.render(scene, camera);
}

// Check for collisions between ship and objects
function checkCollisions() {
  // Skip collision check if ship is invulnerable
  if (shipState.invulnerable) return;

  // X-Wing position
  const shipPosition = shipState.position;

  // Check against all collision objects
  for (const obj of environmentManager.getCollisionObjects()) {
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
  cameraManager.onWindowResize();

  // Check if device type changed (e.g., when rotating a tablet)
  const wasMobile = isMobile;
  isMobile = checkIfMobile();

  // If device type changed, recreate UI
  if (wasMobile !== isMobile) {
    // Remove existing UI elements
    if (uiElements.controlsPanel) {
      document.body.removeChild(uiElements.controlsPanel);
      uiElements.controlsPanel = null;
    }

    if (uiElements.mobileControls) {
      if (uiElements.mobileControls.dpadContainer) {
        document.body.removeChild(uiElements.mobileControls.dpadContainer);
      }
      if (uiElements.mobileControls.actionButtonContainer) {
        document.body.removeChild(
          uiElements.mobileControls.actionButtonContainer
        );
      }
      uiElements.mobileControls = null;
    }

    // Recreate appropriate controls
    if (isMobile) {
      createMobileControls();
    } else {
      createKeyboardControlsPanel();
    }
  }
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

// Enhance initUI function to add a score display at the top left
function initUI() {
  // Create mobile controls if on mobile device
  if (isMobile) {
    createMobileControls();
  } else {
    // Create the keyboard controls panel for desktop
    createKeyboardControlsPanel();
  }

  // Create score panel at top left
  const scorePanel = document.createElement('div');
  scorePanel.style.position = 'fixed';
  scorePanel.style.top = '20px';
  scorePanel.style.left = '20px';
  scorePanel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  scorePanel.style.color = 'white';
  scorePanel.style.padding = '15px';
  scorePanel.style.borderRadius = '10px';
  scorePanel.style.fontFamily = 'Arial, sans-serif';
  scorePanel.style.fontSize = '16px';
  scorePanel.style.zIndex = '1000';
  scorePanel.style.userSelect = 'none';
  scorePanel.style.boxShadow = '0 0 10px rgba(0, 255, 255, 0.5)';
  scorePanel.style.border = '1px solid rgba(0, 255, 255, 0.3)';
  scorePanel.style.minWidth = '180px';

  // Create score display
  const scoreContainer = document.createElement('div');
  scoreContainer.style.display = 'flex';
  scoreContainer.style.justifyContent = 'space-between';
  scoreContainer.style.alignItems = 'center';
  scoreContainer.style.marginBottom = '10px';

  const scoreLabel = document.createElement('div');
  scoreLabel.textContent = 'SCORE:';
  scoreLabel.style.fontWeight = 'bold';
  scoreLabel.style.color = '#00ffff';

  const liveScoreValue = document.createElement('div');
  liveScoreValue.textContent = '0';
  liveScoreValue.style.fontWeight = 'bold';
  liveScoreValue.style.fontSize = '22px';
  liveScoreValue.style.color = '#ffffff';

  scoreContainer.appendChild(scoreLabel);
  scoreContainer.appendChild(liveScoreValue);
  scorePanel.appendChild(scoreContainer);

  // Add to document
  document.body.appendChild(scorePanel);

  // Store references
  uiElements.scorePanel = scorePanel;
  uiElements.liveScoreValue = liveScoreValue;

  // Create DeathStar title at top middle
  const deathStarTitle = document.createElement('div');
  deathStarTitle.textContent = 'DEATHSTAR';
  deathStarTitle.style.position = 'fixed';
  deathStarTitle.style.top = '20px';
  deathStarTitle.style.left = '50%';
  deathStarTitle.style.transform = 'translateX(-50%)';
  deathStarTitle.style.color = '#ffffff';
  deathStarTitle.style.fontFamily = 'Arial, sans-serif';
  deathStarTitle.style.fontSize = '32px';
  deathStarTitle.style.fontWeight = 'bold';
  deathStarTitle.style.letterSpacing = '3px';
  deathStarTitle.style.textShadow = '0 0 10px rgba(255, 255, 255, 0.5)';
  deathStarTitle.style.zIndex = '1000';
  deathStarTitle.style.userSelect = 'none';

  // Add to document
  document.body.appendChild(deathStarTitle);

  // Store reference
  uiElements.deathStarTitle = deathStarTitle;

  // Create icons container for top right
  const iconsContainer = document.createElement('div');
  iconsContainer.style.position = 'fixed';
  iconsContainer.style.top = '20px';
  iconsContainer.style.right = '20px';
  iconsContainer.style.display = 'flex';
  iconsContainer.style.gap = '15px';
  iconsContainer.style.zIndex = '1000';

  // Create music toggle icon
  const musicIcon = document.createElement('div');
  musicIcon.innerHTML = '🔊'; // Default: unmuted
  musicIcon.style.fontSize = '24px';
  musicIcon.style.color = '#ffffff';
  musicIcon.style.cursor = 'pointer';
  musicIcon.style.textShadow = '0 0 5px rgba(255, 255, 255, 0.5)';
  musicIcon.style.width = '30px';
  musicIcon.style.height = '30px';
  musicIcon.style.display = 'flex';
  musicIcon.style.justifyContent = 'center';
  musicIcon.style.alignItems = 'center';
  musicIcon.style.borderRadius = '50%';
  musicIcon.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  musicIcon.style.padding = '5px';
  musicIcon.title = 'Toggle Music';

  // Add click event for music toggle
  musicIcon.addEventListener('click', toggleMusic);

  // Create settings icon
  const settingsIcon = document.createElement('div');
  settingsIcon.innerHTML = '⚙️'; // Gear icon
  settingsIcon.style.fontSize = '24px';
  settingsIcon.style.color = '#ffffff';
  settingsIcon.style.cursor = 'pointer';
  settingsIcon.style.textShadow = '0 0 5px rgba(255, 255, 255, 0.5)';
  settingsIcon.style.width = '30px';
  settingsIcon.style.height = '30px';
  settingsIcon.style.display = 'flex';
  settingsIcon.style.justifyContent = 'center';
  settingsIcon.style.alignItems = 'center';
  settingsIcon.style.borderRadius = '50%';
  settingsIcon.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  settingsIcon.style.padding = '5px';
  settingsIcon.title = 'Settings';

  // Add click event listener for settings
  settingsIcon.addEventListener('click', () => {
    if (!uiElements.settingsPanel) {
      createSettingsPanel();
    }

    // Toggle display
    uiElements.settingsPanel.style.display =
      uiElements.settingsPanel.style.display === 'none' ? 'block' : 'none';

    // Update UI to show current selection
    updateColorSelectionUI();
  });

  // Add icons to container
  iconsContainer.appendChild(musicIcon);
  iconsContainer.appendChild(settingsIcon);

  // Add container to document
  document.body.appendChild(iconsContainer);

  // Store references
  uiElements.iconsContainer = iconsContainer;
  uiElements.musicIcon = musicIcon;
  uiElements.settingsIcon = settingsIcon;

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
  const scoreStatLabel = document.createElement('td');
  scoreStatLabel.textContent = 'SCORE:';
  scoreStatLabel.style.padding = '8px';
  scoreStatLabel.style.color = '#00ffff';
  scoreStatLabel.style.fontWeight = 'bold';
  scoreStatLabel.style.textAlign = 'right';

  const scoreValue = document.createElement('td');
  scoreValue.textContent = '0';
  scoreValue.style.padding = '8px';
  scoreValue.style.textAlign = 'left';
  scoreValue.style.fontWeight = 'bold';

  scoreRow.appendChild(scoreStatLabel);
  scoreRow.appendChild(scoreValue);
  statsTable.appendChild(scoreRow);

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
}

// Add a function to update the score display
function updateScoreDisplay() {
  // Update the score display in top left
  if (uiElements.liveScoreValue) {
    uiElements.liveScoreValue.textContent = gameState.score;
  }
}

// Toggle music function
function toggleMusic() {
  const isMuted = audioManager.toggleMusic();
  if (uiElements.musicIcon) {
    uiElements.musicIcon.innerHTML = isMuted ? '🔇' : '🔊';
  }
}

// Add a function to change the X-Wing color
function changeXWingColor(color) {
  if (!gameSettings.colors[color]) {
    console.error(`Invalid color: ${color}`);
    return;
  }

  // Update the settings
  gameSettings.xwingColor = color;

  // Update the X-Wing material
  if (xwing) {
    // Find all wing meshes (they are at indices 1-4)
    const wingColor = gameSettings.colors[color].wing;
    for (let i = 1; i <= 4; i++) {
      const wing = xwing.children[i];
      if (wing && wing.material) {
        wing.material.color.setHex(wingColor);
      }
    }
  }

  // Update UI if needed
  updateColorSelectionUI();
}

// Create the settings panel
function createSettingsPanel() {
  // Create settings panel container
  const settingsPanel = document.createElement('div');
  settingsPanel.style.position = 'fixed';
  settingsPanel.style.top = '50%';
  settingsPanel.style.left = '50%';
  settingsPanel.style.transform = 'translate(-50%, -50%)';
  settingsPanel.style.width = '300px';
  settingsPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
  settingsPanel.style.borderRadius = '10px';
  settingsPanel.style.padding = '20px';
  settingsPanel.style.boxShadow = '0 0 20px rgba(0, 255, 255, 0.5)';
  settingsPanel.style.zIndex = '1001';
  settingsPanel.style.display = 'none'; // Initially hidden
  settingsPanel.style.fontFamily = 'Arial, sans-serif';
  settingsPanel.style.color = '#fff';
  settingsPanel.style.border = '1px solid rgba(0, 255, 255, 0.5)';

  // Add title
  const title = document.createElement('div');
  title.textContent = 'SETTINGS';
  title.style.fontSize = '24px';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '20px';
  title.style.textAlign = 'center';
  title.style.color = '#00ffff';
  title.style.borderBottom = '1px solid rgba(0, 255, 255, 0.5)';
  title.style.paddingBottom = '10px';
  settingsPanel.appendChild(title);

  // Add X-Wing color selection section
  const colorSection = document.createElement('div');
  colorSection.style.marginBottom = '20px';

  const colorLabel = document.createElement('div');
  colorLabel.textContent = 'X-WING COLOR';
  colorLabel.style.marginBottom = '10px';
  colorLabel.style.fontWeight = 'bold';
  colorSection.appendChild(colorLabel);

  // Add color options
  const colorOptions = document.createElement('div');
  colorOptions.style.display = 'flex';
  colorOptions.style.justifyContent = 'space-between';
  colorOptions.style.marginBottom = '20px';

  // Create color buttons
  const colors = ['red', 'blue', 'green', 'yellow'];

  colors.forEach((color) => {
    const colorButton = document.createElement('div');
    colorButton.style.width = '50px';
    colorButton.style.height = '50px';
    colorButton.style.backgroundColor = color;
    colorButton.style.borderRadius = '50%';
    colorButton.style.cursor = 'pointer';
    colorButton.style.border =
      color === gameSettings.xwingColor
        ? '3px solid white'
        : '3px solid transparent';
    colorButton.style.boxSizing = 'border-box';
    colorButton.dataset.color = color;

    // Add click event
    colorButton.addEventListener('click', () => {
      changeXWingColor(color);
      // Close settings panel
      settingsPanel.style.display = 'none';
    });

    colorOptions.appendChild(colorButton);
  });

  colorSection.appendChild(colorOptions);
  settingsPanel.appendChild(colorSection);

  // Add close button
  const closeButton = document.createElement('button');
  closeButton.textContent = 'CLOSE';
  closeButton.style.width = '100%';
  closeButton.style.padding = '10px';
  closeButton.style.backgroundColor = '#00ffff';
  closeButton.style.color = '#000';
  closeButton.style.border = 'none';
  closeButton.style.borderRadius = '5px';
  closeButton.style.cursor = 'pointer';
  closeButton.style.fontWeight = 'bold';
  closeButton.style.marginTop = '10px';

  // Add hover effect
  closeButton.addEventListener('mouseover', () => {
    closeButton.style.backgroundColor = '#ffffff';
  });
  closeButton.addEventListener('mouseout', () => {
    closeButton.style.backgroundColor = '#00ffff';
  });

  // Add click event
  closeButton.addEventListener('click', () => {
    settingsPanel.style.display = 'none';
  });

  settingsPanel.appendChild(closeButton);

  // Add to body
  document.body.appendChild(settingsPanel);

  // Store reference
  uiElements.settingsPanel = settingsPanel;

  return settingsPanel;
}

// Update the color selection UI to reflect the current color
function updateColorSelectionUI() {
  if (!uiElements.settingsPanel) return;

  // Find all color buttons
  const colorButtons =
    uiElements.settingsPanel.querySelectorAll('[data-color]');
  colorButtons.forEach((button) => {
    if (button.dataset.color === gameSettings.xwingColor) {
      button.style.border = '3px solid white';
    } else {
      button.style.border = '3px solid transparent';
    }
  });
}

// Create keyboard controls panel for desktop
function createKeyboardControlsPanel() {
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
}

// Create mobile controls
function createMobileControls() {
  // Create container for directional buttons (bottom left)
  const dpadContainer = document.createElement('div');
  dpadContainer.style.position = 'fixed';
  dpadContainer.style.bottom = '20px';
  dpadContainer.style.left = '20px';
  dpadContainer.style.width = '150px';
  dpadContainer.style.height = '150px';
  dpadContainer.style.zIndex = '1000';

  // Create D-pad layout
  const buttonSize = '50px';
  const buttonStyle = {
    width: buttonSize,
    height: buttonSize,
    borderRadius: '50%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    border: '2px solid rgba(0, 255, 255, 0.7)',
    color: '#00ffff',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: '24px',
    position: 'absolute',
    cursor: 'pointer',
    userSelect: 'none',
    boxShadow: '0 0 10px rgba(0, 255, 255, 0.3)',
  };

  // Create up button
  const upButton = document.createElement('div');
  Object.assign(upButton.style, buttonStyle);
  upButton.style.top = '0';
  upButton.style.left = '50px';
  upButton.innerHTML = '&uarr;'; // Up arrow
  dpadContainer.appendChild(upButton);

  // Create down button
  const downButton = document.createElement('div');
  Object.assign(downButton.style, buttonStyle);
  downButton.style.bottom = '0';
  downButton.style.left = '50px';
  downButton.innerHTML = '&darr;'; // Down arrow
  dpadContainer.appendChild(downButton);

  // Create left button
  const leftButton = document.createElement('div');
  Object.assign(leftButton.style, buttonStyle);
  leftButton.style.left = '0';
  leftButton.style.top = '50px';
  leftButton.innerHTML = '&larr;'; // Left arrow
  dpadContainer.appendChild(leftButton);

  // Create right button
  const rightButton = document.createElement('div');
  Object.assign(rightButton.style, buttonStyle);
  rightButton.style.right = '0';
  rightButton.style.top = '50px';
  rightButton.innerHTML = '&rarr;'; // Right arrow
  dpadContainer.appendChild(rightButton);

  // Add to document
  document.body.appendChild(dpadContainer);

  // Create action buttons (middle right)
  // Create action button container
  const actionButtonContainer = document.createElement('div');
  actionButtonContainer.style.position = 'fixed';
  actionButtonContainer.style.right = '20px';
  actionButtonContainer.style.top = '50%';
  actionButtonContainer.style.transform = 'translateY(-50%)';
  actionButtonContainer.style.display = 'flex';
  actionButtonContainer.style.flexDirection = 'column';
  actionButtonContainer.style.gap = '20px';
  actionButtonContainer.style.zIndex = '1000';

  // Fire button
  const fireButton = document.createElement('div');
  fireButton.style.width = '70px';
  fireButton.style.height = '70px';
  fireButton.style.borderRadius = '50%';
  fireButton.style.backgroundColor = 'rgba(255, 0, 0, 0.4)';
  fireButton.style.border = '2px solid rgba(255, 0, 0, 0.7)';
  fireButton.style.color = '#ff0000';
  fireButton.style.display = 'flex';
  fireButton.style.justifyContent = 'center';
  fireButton.style.alignItems = 'center';
  fireButton.style.fontSize = '18px';
  fireButton.style.fontWeight = 'bold';
  fireButton.style.cursor = 'pointer';
  fireButton.style.userSelect = 'none';
  fireButton.style.boxShadow = '0 0 15px rgba(255, 0, 0, 0.3)';
  fireButton.innerHTML = 'FIRE';
  actionButtonContainer.appendChild(fireButton);

  // Thrust up button
  const thrustButton = document.createElement('div');
  thrustButton.style.width = '70px';
  thrustButton.style.height = '70px';
  thrustButton.style.borderRadius = '50%';
  thrustButton.style.backgroundColor = 'rgba(0, 255, 0, 0.4)';
  thrustButton.style.border = '2px solid rgba(0, 255, 0, 0.7)';
  thrustButton.style.color = '#00ff00';
  thrustButton.style.display = 'flex';
  thrustButton.style.justifyContent = 'center';
  thrustButton.style.alignItems = 'center';
  thrustButton.style.fontSize = '18px';
  thrustButton.style.fontWeight = 'bold';
  thrustButton.style.cursor = 'pointer';
  thrustButton.style.userSelect = 'none';
  thrustButton.style.boxShadow = '0 0 15px rgba(0, 255, 0, 0.3)';
  thrustButton.textContent = 'UP';
  actionButtonContainer.appendChild(thrustButton);

  // Add to document
  document.body.appendChild(actionButtonContainer);

  // Store references
  uiElements.mobileControls = {
    dpadContainer,
    actionButtonContainer,
    upButton,
    downButton,
    leftButton,
    rightButton,
    fireButton,
    thrustButton,
  };

  // Setup event listeners for mobile buttons
  setupMobileControlListeners();
}

// Setup event listeners for mobile control buttons
function setupMobileControlListeners() {
  const controls = uiElements.mobileControls;

  // Helper function to handle touch events
  function setupTouchHandlers(
    element,
    keyToSimulate,
    activeColor,
    defaultColor
  ) {
    // Touch start - press key
    element.addEventListener('touchstart', (e) => {
      e.preventDefault(); // Prevent scrolling
      keys[keyToSimulate] = true;
      element.style.backgroundColor = activeColor;
    });

    // Touch end - release key
    element.addEventListener('touchend', (e) => {
      e.preventDefault();
      keys[keyToSimulate] = false;
      element.style.backgroundColor = defaultColor;
    });

    // Touch cancel - release key
    element.addEventListener('touchcancel', (e) => {
      e.preventDefault();
      keys[keyToSimulate] = false;
      element.style.backgroundColor = defaultColor;
    });

    // If touch moves out of button, release key
    element.addEventListener('touchmove', (e) => {
      const touch = e.touches[0];
      const rect = element.getBoundingClientRect();
      if (
        touch.clientX < rect.left ||
        touch.clientX > rect.right ||
        touch.clientY < rect.top ||
        touch.clientY > rect.bottom
      ) {
        keys[keyToSimulate] = false;
        element.style.backgroundColor = defaultColor;
      }
    });
  }

  // Direction buttons
  setupTouchHandlers(
    controls.upButton,
    'w',
    'rgba(0, 255, 255, 0.7)',
    'rgba(0, 0, 0, 0.5)'
  );
  setupTouchHandlers(
    controls.downButton,
    's',
    'rgba(0, 255, 255, 0.7)',
    'rgba(0, 0, 0, 0.5)'
  );
  setupTouchHandlers(
    controls.leftButton,
    'a',
    'rgba(0, 255, 255, 0.7)',
    'rgba(0, 0, 0, 0.5)'
  );
  setupTouchHandlers(
    controls.rightButton,
    'd',
    'rgba(0, 255, 255, 0.7)',
    'rgba(0, 0, 0, 0.5)'
  );

  // Fire button
  controls.fireButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    fireLaser();
    controls.fireButton.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
  });

  controls.fireButton.addEventListener('touchend', (e) => {
    e.preventDefault();
    controls.fireButton.style.backgroundColor = 'rgba(255, 0, 0, 0.4)';
  });

  // Up thrust button (space)
  setupTouchHandlers(
    controls.thrustButton,
    ' ',
    'rgba(0, 255, 0, 0.7)',
    'rgba(0, 255, 0, 0.4)'
  );
}

// Initialize and start animation
init();
animate();
