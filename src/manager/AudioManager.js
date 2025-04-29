import * as THREE from 'three';

// AudioManager class to handle all game audio
class AudioManager {
  constructor(listener) {
    this.listener = listener;
    this.loader = new THREE.AudioLoader();
    this.music = null;
    this.isMusicMuted = false;
    console.log('AudioManager initialized - music only');
  }

  // Load only background music
  loadSounds() {
    console.log('Loading only background music');
    this.loadMusic();
  }

  // Load background music
  loadMusic() {
    console.log('Loading background music');
    this.loader.load(
      'https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/sounds/358232_j_s_song.mp3',
      (buffer) => {
        this.music = new THREE.Audio(this.listener);
        this.music.setBuffer(buffer);
        this.music.setVolume(0.3);
        this.music.setLoop(true);

        // Auto-play music if not muted
        if (!this.isMusicMuted) {
          this.playMusic();
        }
        console.log('Background music loaded');
      },
      // Progress callback
      (xhr) => {
        console.log(`Music ${(xhr.loaded / xhr.total) * 100}% loaded`);
      },
      // Error callback
      (err) => {
        console.error('Error loading background music:', err);
      }
    );
  }

  // Play music if not already playing
  playMusic() {
    if (this.music && !this.music.isPlaying) {
      this.music.play();
      console.log('Music started playing');
    }
  }

  // Toggle music on/off
  toggleMusic() {
    if (this.music) {
      if (this.isMusicMuted) {
        this.music.play();
        this.isMusicMuted = false;
        console.log('Music unmuted');
      } else {
        this.music.pause();
        this.isMusicMuted = true;
        console.log('Music muted');
      }
      return this.isMusicMuted;
    } else {
      console.warn('Music not loaded yet');
      return this.isMusicMuted;
    }
  }
}

export default AudioManager;
