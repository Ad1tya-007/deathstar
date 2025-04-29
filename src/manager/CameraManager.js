import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

class CameraManager {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.camera = null;
    this.orbitControls = null;
    this.isOrbitControlsEnabled = false;
  }

  init() {
    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    );
    this.camera.position.z = 10;
    this.camera.position.y = 0;

    // Add orbit controls for development
    this.orbitControls = new OrbitControls(
      this.camera,
      this.renderer.domElement
    );
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.05;
    this.orbitControls.enabled = false; // Disable by default

    // Add audio listener to camera
    const audioListener = new THREE.AudioListener();
    this.camera.add(audioListener);

    return { camera: this.camera, audioListener };
  }

  update(xwing, shipState) {
    if (!this.orbitControls.enabled) {
      // Position camera behind and slightly above the ship
      const cameraOffset = new THREE.Vector3(0, 3, 15);
      const cameraPosition = new THREE.Vector3();

      // Transform offset to ship's local space
      cameraOffset.applyQuaternion(xwing.quaternion);
      cameraPosition.copy(shipState.position).add(cameraOffset);

      // Smoothly move camera to new position
      this.camera.position.lerp(cameraPosition, 0.05);

      // Look at ship with slight offset for better view
      const lookAtPosition = shipState.position
        .clone()
        .add(new THREE.Vector3(0, 1, 0));
      this.camera.lookAt(lookAtPosition);
    } else {
      this.orbitControls.update();
    }
  }

  toggleOrbitControls() {
    this.orbitControls.enabled = !this.orbitControls.enabled;
    return this.orbitControls.enabled;
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  getCamera() {
    return this.camera;
  }

  getOrbitControls() {
    return this.orbitControls;
  }
}

export default CameraManager;
