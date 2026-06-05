import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Convert Lat/Lng to 3D Cartesian coordinates
function latLngToVector3(lat, lng, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.sin(theta),
    radius * Math.cos(phi),
    -radius * Math.sin(phi) * Math.cos(theta)
  );
}

// Map shape to color
const shapeColors = {
  'Light': 0xffd700,      // Gold
  'Circle': 0x39ff14,     // Green
  'Sphere': 0x39ff14,     // Green
  'Triangle': 0xbc00dd,   // Purple
  'Disk': 0x00f0ff,       // Cyan
  'Oval': 0x00f0ff,       // Cyan
  'Cigar': 0x00f0ff,       // Cyan
  'Cylinder': 0x00f0ff,    // Cyan
  'Fireball': 0xff3300,   // Red
  'Flash': 0xff7700,      // Orange
  'Formation': 0xff7700,  // Orange
  'Chevron': 0xff7700,    // Orange
  'Other': 0xffffff,      // White
  'Unknown': 0x8fa0a6     // Gray
};

export function initGlobe(containerId, dataPoints, onPointSelected) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  const width = container.clientWidth;
  const height = container.clientHeight;

  // Scene
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05070a, 0.02);

  // Camera
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 5, 12);

  // Renderer
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) {
    console.error("WebGL not supported for Globe scene:", e);
    const loader = document.getElementById('globe-loader');
    if (loader) {
      loader.innerHTML = '<p style="color: #ff3333; font-family: monospace; font-size: 12px; text-shadow: 0 0 8px rgba(255, 0, 0, 0.4);">WEBGL ACCELERATION NOT AVAILABLE</p><p style="font-size: 9px; color: #8fa0a6; margin-top: 5px; font-family: monospace; letter-spacing: 0.5px;">CHECK GPU SETTINGS. ANALYTICS STILL FUNCTIONAL.</p>';
    }
    return {
      updateFilters: () => 0,
      focusOnCoordinate: () => {},
      destroy: () => {}
    };
  }
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  // Hide loader
  const loader = document.getElementById('globe-loader');
  if (loader) loader.style.display = 'none';

  // Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 5.5;
  controls.maxDistance = 25;

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x223344, 1.2);
  scene.add(ambientLight);

  const dirLight1 = new THREE.DirectionalLight(0x00f0ff, 1.5);
  dirLight1.position.set(5, 3, 5);
  scene.add(dirLight1);

  const dirLight2 = new THREE.DirectionalLight(0x39ff14, 0.5);
  dirLight2.position.set(-5, -3, -5);
  scene.add(dirLight2);

  // Earth Globe Group
  const globeGroup = new THREE.Group();
  scene.add(globeGroup);

  // Inner Earth Sphere (Dark grid theme)
  const earthRadius = 4;
  const earthGeom = new THREE.SphereGeometry(earthRadius, 64, 64);
  
  // Try loading textures, fallback to wireframe on error
  const textureLoader = new THREE.TextureLoader();
  let earthMat;
  
  try {
    // Dark map showing continent outlines or lights
    const texture = textureLoader.load(
      'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_lights_lml.jpg',
      () => {
        earthMat.map = texture;
        earthMat.needsUpdate = true;
      },
      undefined,
      () => {
        console.warn("Failed to load earth texture, falling back to procedural grid.");
      }
    );
    
    earthMat = new THREE.MeshStandardMaterial({
      color: 0x07111a,
      roughness: 0.8,
      metalness: 0.2
    });
  } catch (e) {
    earthMat = new THREE.MeshStandardMaterial({ color: 0x07111a });
  }

  const earth = new THREE.Mesh(earthGeom, earthMat);
  globeGroup.add(earth);

  // Outer Grid shell for Sci-Fi look
  const gridGeom = new THREE.SphereGeometry(earthRadius + 0.02, 36, 18);
  const gridMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    wireframe: true,
    transparent: true,
    opacity: 0.12
  });
  const gridShell = new THREE.Mesh(gridGeom, gridMat);
  globeGroup.add(gridShell);

  // Hologram Scanning Ring
  const ringGeom = new THREE.RingGeometry(earthRadius + 0.15, earthRadius + 0.18, 64);
  ringGeom.rotateX(Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.25,
    blending: THREE.AdditiveBlending
  });
  const scanningRing = new THREE.Mesh(ringGeom, ringMat);
  globeGroup.add(scanningRing);

  // Sighting Pins Group
  const pinsGroup = new THREE.Group();
  globeGroup.add(pinsGroup);

  // Plot coordinate pins
  const pinGeom = new THREE.CylinderGeometry(0.015, 0.035, 0.4, 6);
  pinGeom.translate(0, 0.2, 0); // Translate cylinder so base sits on pivot
  pinGeom.rotateX(Math.PI / 2); // Rotate so pointing outwards along Z

  const pinMaterials = {};
  
  function getMaterialForShape(shape) {
    const cleanShape = shapeColors[shape] ? shape : 'Other';
    if (!pinMaterials[cleanShape]) {
      pinMaterials[cleanShape] = new THREE.MeshBasicMaterial({
        color: shapeColors[cleanShape],
        transparent: true,
        opacity: 0.8,
        depthWrite: true
      });
    }
    return pinMaterials[cleanShape];
  }

  const pinMeshes = [];
  
  dataPoints.forEach((point) => {
    const mat = getMaterialForShape(point.shape);
    const pin = new THREE.Mesh(pinGeom, mat);
    
    // Position on Earth surface
    const pos = latLngToVector3(point.lat, point.lng, earthRadius);
    pin.position.copy(pos);
    
    // Align pin direction facing outwards from sphere center
    pin.lookAt(new THREE.Vector3(0, 0, 0));
    
    // Keep reference to point data for raycasting and filtering
    pin.userData = { data: point };
    
    pinsGroup.add(pin);
    pinMeshes.push(pin);
  });

  // Camera animation target
  let targetCameraPosition = null;
  let targetControlsTarget = null;
  let isTransitioning = false;

  // Interactivity (Hover / Click)
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hoveredPin = null;

  function onPointerMove(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function onPointerClick() {
    if (hoveredPin) {
      focusOnPin(hoveredPin);
      if (onPointSelected) {
        onPointSelected(hoveredPin.userData.data);
      }
    }
  }

  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('click', onPointerClick);

  // Focus globe camera on a coordinate pin
  function focusOnPin(pin) {
    const pinPos = pin.position.clone();
    // Transform pin local coordinate to world coordinate
    pinPos.applyMatrix4(globeGroup.matrixWorld);
    
    // Position camera along vector from center through pin position, scaled out
    const normal = pinPos.clone().normalize();
    
    targetCameraPosition = normal.clone().multiplyScalar(10);
    targetControlsTarget = pinPos.clone();
    isTransitioning = true;
  }

  // API to focus by coordinate external call
  function focusOnCoordinate(lat, lng) {
    const pos = latLngToVector3(lat, lng, earthRadius);
    pos.applyMatrix4(globeGroup.matrixWorld);
    
    const normal = pos.clone().normalize();
    targetCameraPosition = normal.clone().multiplyScalar(9);
    targetControlsTarget = pos.clone();
    isTransitioning = true;
  }

  // API to update filters (shows/hides pins based on current filters)
  function updateFilters(yearFilter, countryFilter, shapeFilter, searchQuery) {
    let visibleCount = 0;
    
    pinMeshes.forEach((pin) => {
      const data = pin.userData.data;
      
      const matchYear = yearFilter === 'ALL' || data.year <= yearFilter;
      const matchCountry = countryFilter === 'ALL' || data.country === countryFilter;
      const matchShape = shapeFilter === 'ALL' || data.shape === shapeFilter;
      const matchSearch = !searchQuery || 
                         data.city.toLowerCase().includes(searchQuery) ||
                         data.desc.toLowerCase().includes(searchQuery);
                         
      if (matchYear && matchCountry && matchShape && matchSearch) {
        pin.visible = true;
        visibleCount++;
      } else {
        pin.visible = false;
      }
    });

    return visibleCount;
  }

  // Animation Loop
  let frame = 0;
  let animationId = null;

  function animate() {
    animationId = requestAnimationFrame(animate);
    frame++;

    // Slowly rotate globe (only if user is not actively interacting or transitioning)
    if (!controls.state === -1 && !isTransitioning) {
      globeGroup.rotation.y += 0.0015;
    }

    // Oscillate hologram scanning ring
    scanningRing.position.y = Math.sin(frame * 0.02) * earthRadius;
    scanningRing.material.opacity = 0.1 + (Math.sin(frame * 0.02) * 0.5 + 0.5) * 0.25;

    // Raycast pins
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(pinMeshes.filter(p => p.visible));

    if (intersects.length > 0) {
      const pin = intersects[0].object;
      if (hoveredPin !== pin) {
        // Reset old hover
        if (hoveredPin) {
          hoveredPin.scale.set(1, 1, 1);
          document.body.style.cursor = 'default';
        }
        hoveredPin = pin;
        hoveredPin.scale.set(1.5, 2.5, 1.5); // Highlight size
        document.body.style.cursor = 'pointer';
      }
    } else {
      if (hoveredPin) {
        hoveredPin.scale.set(1, 1, 1);
        hoveredPin = null;
        document.body.style.cursor = 'default';
      }
    }

    // Camera transitions LERP
    if (isTransitioning && targetCameraPosition && targetControlsTarget) {
      camera.position.lerp(targetCameraPosition, 0.08);
      controls.target.lerp(targetControlsTarget, 0.08);
      
      // Stop LERPing when camera gets close enough to target
      if (camera.position.distanceTo(targetCameraPosition) < 0.05) {
        isTransitioning = false;
      }
    }

    controls.update();
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

  return {
    updateFilters,
    focusOnCoordinate,
    destroy: () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('click', onPointerClick);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    }
  };
}
