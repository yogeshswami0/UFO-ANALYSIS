import * as THREE from 'three';

// Create a procedurally generated UFO mesh
function createUFOMesh() {
  const ufoGroup = new THREE.Group();

  // 1. Saucer Main Disk (Metallic Dark Silver)
  const diskGeom = new THREE.CylinderGeometry(5, 6, 0.8, 32);
  const diskMat = new THREE.MeshStandardMaterial({
    color: 0x3a3d40,
    metalness: 0.9,
    roughness: 0.2,
    flatShading: true
  });
  const disk = new THREE.Mesh(diskGeom, diskMat);
  ufoGroup.add(disk);

  // 2. Upper Cockpit Dome (Glowing Glass or Shiny Dark Blue)
  const domeGeom = new THREE.SphereGeometry(2.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const domeMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.6,
    roughness: 0.1,
    metalness: 0.9,
    emissive: 0x005577
  });
  const dome = new THREE.Mesh(domeGeom, domeMat);
  dome.position.y = 0.4;
  ufoGroup.add(dome);

  // 3. Lower Engine Core (Emits Tractor Beam)
  const bottomGeom = new THREE.SphereGeometry(2.5, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const bottomMat = new THREE.MeshBasicMaterial({
    color: 0x39ff14,
    transparent: true,
    opacity: 0.8
  });
  const bottom = new THREE.Mesh(bottomGeom, bottomMat);
  bottom.position.y = -0.3;
  ufoGroup.add(bottom);

  // 4. Perimeter Light Ring (Flashing orbs around disk rim)
  const lightCount = 12;
  const lightGroup = new THREE.Group();
  const lightGeom = new THREE.SphereGeometry(0.22, 16, 16);
  
  const lightMeshes = [];
  for (let i = 0; i < lightCount; i++) {
    const angle = (i / lightCount) * Math.PI * 2;
    const lightMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const lightMesh = new THREE.Mesh(lightGeom, lightMat);
    
    // Position lights on disk edge
    lightMesh.position.x = Math.cos(angle) * 5.6;
    lightMesh.position.z = Math.sin(angle) * 5.6;
    lightMesh.position.y = 0;
    
    lightGroup.add(lightMesh);
    lightMeshes.push(lightMesh); // Save reference to animate later
  }
  ufoGroup.add(lightGroup);
  ufoGroup.userData = { lightMeshes };

  // 5. Tractor Beam (Volumetric transparent cone)
  const beamGeom = new THREE.ConeGeometry(5, 18, 32, 1, true);
  beamGeom.translate(0, -9, 0); // Shift pivot point to cone tip
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x39ff14,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const beam = new THREE.Mesh(beamGeom, beamMat);
  beam.position.y = -0.5;
  ufoGroup.add(beam);
  ufoGroup.userData.beam = beam;

  return ufoGroup;
}

// 1. INTRO FULLSCREEN SCENE
export function initIntroScene(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  const width = container.clientWidth;
  const height = container.clientHeight;

  // Scene
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x020305, 0.015);

  // Camera
  const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
  camera.position.z = 22;
  camera.position.y = 2;

  // Renderer
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) {
    console.error("WebGL not supported for Intro scene:", e);
    return null;
  }
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x112233, 1.5);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0x00f0ff, 2.5);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);

  const ufoLight = new THREE.PointLight(0x39ff14, 3, 20);
  ufoLight.position.set(0, -2, 0);
  scene.add(ufoLight);

  // Add UFO
  const ufo = createUFOMesh();
  scene.add(ufo);

  // Add Stars Particle System
  const starCount = 1500;
  const starGeom = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  const starSpeeds = new Float32Array(starCount);

  for (let i = 0; i < starCount; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 80;     // X
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 60; // Y
    starPos[i * 3 + 2] = -Math.random() * 100;       // Z
    starSpeeds[i] = 0.2 + Math.random() * 0.4;       // Speed moving forward
  }

  starGeom.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.18,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending
  });

  const starField = new THREE.Points(starGeom, starMat);
  scene.add(starField);

  // Animation Loop
  let frame = 0;
  let animationId = null;

  function animate() {
    animationId = requestAnimationFrame(animate);
    frame++;

    // Hover floating effect
    ufo.position.y = Math.sin(frame * 0.02) * 0.8;
    ufo.rotation.y += 0.008;
    ufo.rotation.x = Math.sin(frame * 0.01) * 0.1;

    // Light ring animation (circular chase sequence)
    const lights = ufo.userData.lightMeshes;
    const beam = ufo.userData.beam;
    
    lights.forEach((l, index) => {
      // Cycle brightness based on sine wave shifted by index
      const pulse = Math.sin(frame * 0.15 - index * 0.5) * 0.5 + 0.5;
      l.material.color.setHSL(0.5 + pulse * 0.15, 1, 0.5);
      l.scale.setScalar(0.8 + pulse * 0.4);
    });

    // Pulse tractor beam opacity
    if (beam) {
      beam.material.opacity = 0.12 + Math.sin(frame * 0.08) * 0.06;
      beam.rotation.y -= 0.005;
    }

    // Move starfield forward
    const positions = starField.geometry.attributes.position.array;
    for (let i = 0; i < starCount; i++) {
      positions[i * 3 + 2] += starSpeeds[i]; // Move Z closer
      // Reset if star passes camera
      if (positions[i * 3 + 2] > 10) {
        positions[i * 3] = (Math.random() - 0.5) * 80;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 60;
        positions[i * 3 + 2] = -100;
      }
    }
    starField.geometry.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
  }

  animate();

  // Resize Handler
  function onResize() {
    if (!container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);

  // Return clean-up function
  return {
    destroy: () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    }
  };
}

// 2. HEADER MINI SPINNING UFO LOGO
export function initLogoScene(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  const size = container.clientWidth;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 8;
  camera.position.y = 1.5;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) {
    console.error("WebGL not supported for Logo scene:", e);
    return null;
  }
  renderer.setSize(size, size);
  container.appendChild(renderer.domElement);

  // Wireframe UFO logo
  const logoGroup = new THREE.Group();

  const discGeom = new THREE.CylinderGeometry(2, 2.5, 0.4, 16);
  const wireframeMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    wireframe: true,
    transparent: true,
    opacity: 0.6
  });
  const disc = new THREE.Mesh(discGeom, wireframeMat);
  logoGroup.add(disc);

  const domeGeom = new THREE.SphereGeometry(0.9, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const dome = new THREE.Mesh(domeGeom, wireframeMat);
  dome.position.y = 0.2;
  logoGroup.add(dome);

  scene.add(logoGroup);

  let animationId = null;
  function animate() {
    animationId = requestAnimationFrame(animate);
    logoGroup.rotation.y += 0.02;
    logoGroup.rotation.x = 0.2;
    renderer.render(scene, camera);
  }
  animate();

  return {
    destroy: () => {
      cancelAnimationFrame(animationId);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    }
  };
}

// 3. ALIEN WIREFRAME HOLOGRAM DISPLAY
export function initAlienScene(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  const width = container.clientWidth;
  const height = container.clientHeight;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.z = 10;
  camera.position.y = 1;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) {
    console.error("WebGL not supported for Alien scene:", e);
    return null;
  }
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  // Holographic Alien Head group
  const alienGroup = new THREE.Group();

  // Create wireframe alien head using multiple simple geometries
  const headGeom = new THREE.SphereGeometry(1.8, 16, 16);
  // Staging shape scale to make it alien-like (narrow chin, wide cranium)
  const posArr = headGeom.attributes.position;
  for (let i = 0; i < posArr.count; i++) {
    const y = posArr.getY(i);
    // Narrow the chin (lower Y is scaled down in X and Z)
    if (y < 0) {
      const factor = 1.0 + y * 0.4; // Chin narrow factor
      posArr.setX(i, posArr.getX(i) * factor);
      posArr.setZ(i, posArr.getZ(i) * factor);
    } else {
      // Bulge the temples
      const factor = 1.0 + (y / 1.8) * 0.25;
      posArr.setX(i, posArr.getX(i) * factor);
      posArr.setZ(i, posArr.getZ(i) * factor);
    }
    // Pull head back slightly
    posArr.setZ(i, posArr.getZ(i) - 0.2);
  }
  headGeom.computeVertexNormals();

  const holoMat = new THREE.MeshBasicMaterial({
    color: 0x39ff14,
    wireframe: true,
    transparent: true,
    opacity: 0.55
  });

  const skull = new THREE.Mesh(headGeom, holoMat);
  alienGroup.add(skull);

  // Big black slanted eyes
  const eyeGeom = new THREE.SphereGeometry(0.7, 16, 16);
  eyeGeom.scale(1.2, 0.6, 0.5); // Elongated almond shape
  
  const eyeMat = new THREE.MeshBasicMaterial({
    color: 0x051a02,
    wireframe: false,
    transparent: true,
    opacity: 0.95
  });

  const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
  leftEye.position.set(-0.8, 0.2, 1.2);
  leftEye.rotation.set(0.2, 0.4, -0.4); // Slant eyes
  alienGroup.add(leftEye);

  const rightEye = leftEye.clone();
  rightEye.position.x = 0.8;
  rightEye.rotation.y = -0.4;
  rightEye.rotation.z = 0.4;
  alienGroup.add(rightEye);

  // Hologram grid platform below head
  const gridHelper = new THREE.GridHelper(8, 16, 0x00f0ff, 0x004455);
  gridHelper.position.y = -2.8;
  scene.add(gridHelper);

  scene.add(alienGroup);

  // Ambient particles floating around head
  const pCount = 50;
  const pGeom = new THREE.BufferGeometry();
  const pPos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    pPos[i * 3] = (Math.random() - 0.5) * 8;
    pPos[i * 3 + 1] = (Math.random() - 0.5) * 6;
    pPos[i * 3 + 2] = (Math.random() - 0.5) * 8;
  }
  pGeom.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({
    color: 0x39ff14,
    size: 0.08,
    transparent: true,
    opacity: 0.8
  });
  const particles = new THREE.Points(pGeom, pMat);
  scene.add(particles);

  let animationId = null;
  let frame = 0;

  function animate() {
    animationId = requestAnimationFrame(animate);
    frame++;

    // Spin head
    alienGroup.rotation.y = Math.sin(frame * 0.005) * 0.8;
    alienGroup.position.y = Math.sin(frame * 0.02) * 0.15;
    
    // Simulate flickering hologram glitches
    if (Math.random() < 0.025) {
      holoMat.opacity = 0.2 + Math.random() * 0.6;
      alienGroup.position.x = (Math.random() - 0.5) * 0.15; // Glitch shift
    } else {
      holoMat.opacity = 0.55;
      alienGroup.position.x = 0;
    }

    // Slowly rotate environment grid
    gridHelper.rotation.y += 0.002;
    particles.rotation.y -= 0.001;

    renderer.render(scene, camera);
  }
  animate();

  function onResize() {
    if (!container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);

  return {
    destroy: () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    }
  };
}
