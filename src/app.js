import { initIntroScene, initLogoScene, initAlienScene } from './ufo3d.js';
import { initGlobe } from './globe.js';
import { initCharts } from './charts.js';

// Global application state
const state = {
  activeYear: 2014,
  selectedCountry: 'ALL',
  selectedShape: 'ALL',
  searchQuery: '',
  isPlaying: false,
  playTimer: null,
  
  // Data stores
  summary: null,
  mapSightings: [],
  filteredSightings: [],
  
  // Table pagination
  currentPage: 1,
  pageSize: 8,
  
  // 3D Visualizer reference
  globe: null,
  charts: null,
  
  // Web Audio Synth
  audio: {
    ctx: null,
    ambientOsc: null,
    ambientGain: null,
    enabled: true
  }
};

// Web Audio API Synth Core
function initAudio() {
  if (state.audio.ctx) return;
  
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    state.audio.ctx = new AudioContext();
    
    // 1. Ambient low space hum (loops in background)
    const osc = state.audio.ctx.createOscillator();
    const lfo = state.audio.ctx.createOscillator();
    const lfoGain = state.audio.ctx.createGain();
    const gainNode = state.audio.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.value = 65; // C2 hum
    
    lfo.type = 'sine';
    lfo.frequency.value = 0.25; // Slow modulation (4s cycle)
    lfoGain.gain.value = 3.5; // Frequency sweep width
    
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    
    gainNode.gain.value = 0.035; // Soft background level
    
    // Low pass filter to remove harsh sawtooth harmonics
    const filter = state.audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 140;
    
    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(state.audio.ctx.destination);
    
    // Start hum
    lfo.start();
    osc.start();
    
    state.audio.ambientOsc = osc;
    state.audio.ambientGain = gainNode;
  } catch (e) {
    console.warn("Web Audio API is not supported in this browser.");
  }
}

function playSoundEffect(type) {
  if (!state.audio.ctx || !state.audio.enabled) return;
  
  // Resume context if suspended (browser security)
  if (state.audio.ctx.state === 'suspended') {
    state.audio.ctx.resume();
  }
  
  const now = state.audio.ctx.currentTime;
  
  if (type === 'click') {
    // High-pitched digital terminal blip
    const osc = state.audio.ctx.createOscillator();
    const gain = state.audio.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.15);
    
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    
    osc.connect(gain);
    gain.connect(state.audio.ctx.destination);
    osc.start();
    osc.stop(now + 0.16);
  } else if (type === 'beam') {
    // Sweeping spaceship/tractor beam sound
    const osc = state.audio.ctx.createOscillator();
    const gain = state.audio.ctx.createGain();
    const filter = state.audio.ctx.createBiquadFilter();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(1400, now + 1.2);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(250, now);
    filter.frequency.exponentialRampToValueAtTime(1800, now + 1.2);
    
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(state.audio.ctx.destination);
    
    osc.start();
    osc.stop(now + 1.3);
  } else if (type === 'popup') {
    // Holographic flicker swoop
    const osc = state.audio.ctx.createOscillator();
    const gain = state.audio.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.linearRampToValueAtTime(650, now + 0.08);
    osc.frequency.linearRampToValueAtTime(150, now + 0.25);
    
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    
    osc.connect(gain);
    gain.connect(state.audio.ctx.destination);
    
    osc.start();
    osc.stop(now + 0.26);
  }
}

// Fetch files asynchronously
async function loadJSON(url) {
  const response = await fetch(url);
  return await response.json();
}

// Populate filter select elements dynamically
function populateFilters() {
  const countrySelect = document.getElementById('country-select');
  const shapeSelect = document.getElementById('shape-select');
  
  // Extract unique sorted countries and shapes
  const countries = [...new Set(state.mapSightings.map(s => s.country))].sort();
  const shapes = [...new Set(state.mapSightings.map(s => s.shape))].sort();
  
  countries.forEach(c => {
    if (c && c !== 'Unknown Country') {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      countrySelect.appendChild(opt);
    }
  });
  
  shapes.forEach(s => {
    if (s && s !== 'Unknown') {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      shapeSelect.appendChild(opt);
    }
  });
}

// Re-calculate aggregations in-memory from our sample array
function recomputeAggregates() {
  // Filters list
  const filtered = state.mapSightings.filter(s => {
    const matchYear = s.year <= state.activeYear;
    const matchCountry = state.selectedCountry === 'ALL' || s.country === state.selectedCountry;
    const matchShape = state.selectedShape === 'ALL' || s.shape === state.selectedShape;
    const matchSearch = !state.searchQuery || 
                        s.city.toLowerCase().includes(state.searchQuery) ||
                        s.desc.toLowerCase().includes(state.searchQuery);
    return matchYear && matchCountry && matchShape && matchSearch;
  });
  
  state.filteredSightings = filtered;
  
  // 1. Group by Year
  const yearCounts = {};
  filtered.forEach(s => {
    yearCounts[s.year] = (yearCounts[s.year] || 0) + 1;
  });
  // Sort years
  const sortedYears = Object.keys(yearCounts).map(Number).sort((a,b) => a-b);
  const yearData = {
    years: sortedYears.map(String),
    counts: sortedYears.map(y => yearCounts[y])
  };
  
  // 2. Group by Shape
  const shapeCounts = {};
  filtered.forEach(s => {
    shapeCounts[s.shape] = (shapeCounts[s.shape] || 0) + 1;
  });
  const sortedShapes = Object.keys(shapeCounts).sort((a,b) => shapeCounts[b] - shapeCounts[a]);
  const topShapes = sortedShapes.slice(0, 10);
  const otherShapesCount = sortedShapes.slice(10).reduce((acc, s) => acc + shapeCounts[s], 0);
  
  const shapeData = {
    shapes: topShapes,
    counts: topShapes.map(s => shapeCounts[s])
  };
  if (otherShapesCount > 0) {
    shapeData.shapes.push('Other');
    shapeData.counts.push(otherShapesCount);
  }
  
  // 3. Group by Month (1-12)
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthCounts = Array(12).fill(0);
  filtered.forEach(s => {
    // Sighting date format: 'YYYY-MM-DD HH:MM'
    const month = parseInt(s.date.split('-')[1], 10);
    if (month >= 1 && month <= 12) {
      monthCounts[month - 1]++;
    }
  });
  const monthData = {
    months: monthNames,
    counts: monthCounts
  };
  
  // 4. Group by Hour (0-23)
  const hourCounts = Array(24).fill(0);
  filtered.forEach(s => {
    // Sighting date format: 'YYYY-MM-DD HH:MM'
    const hour = parseInt(s.date.split(' ')[1].split(':')[0], 10);
    if (hour >= 0 && hour <= 23) {
      hourCounts[hour]++;
    }
  });
  const hourLabels = Array.from({length: 24}, (_, i) => `${String(i).padStart(2, '0')}:00`);
  const hourData = {
    hours: hourLabels,
    counts: hourCounts
  };
  
  // 5. Update charts
  state.charts.updateCharts({
    year: yearData,
    shape: shapeData,
    month: monthData,
    hour: hourData
  });
  
  // 6. Update Sighting table count badge
  document.getElementById('sighting-count').textContent = `${filtered.length} SIGHTINGS LOGGED`;
  
  // Reset pagination
  state.currentPage = 1;
  renderTable();
}

// Render paginated sightings log table
function renderTable() {
  const tableBody = document.getElementById('table-body');
  tableBody.innerHTML = '';
  
  const totalRecords = state.filteredSightings.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / state.pageSize));
  
  // Boundary checks
  if (state.currentPage > totalPages) state.currentPage = totalPages;
  if (state.currentPage < 1) state.currentPage = 1;
  
  // Slice current page records
  const start = (state.currentPage - 1) * state.pageSize;
  const end = Math.min(start + state.pageSize, totalRecords);
  const pageRecords = state.filteredSightings.slice(start, end);
  
  // Set pager texts
  document.getElementById('page-indicator').textContent = `PAGE ${state.currentPage} OF ${totalPages}`;
  document.getElementById('prev-page-btn').disabled = state.currentPage === 1;
  document.getElementById('next-page-btn').disabled = state.currentPage === totalPages;
  
  if (pageRecords.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7" class="loading-td">NO DECLASSIFIED SIGHTINGS MATCH FILTER CRITERIA</td></tr>`;
    return;
  }
  
  pageRecords.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${s.date}</td>
      <td>${s.city}</td>
      <td>${s.state}</td>
      <td>${s.country}</td>
      <td>${s.shape}</td>
      <td>${formatDuration(s.duration)}</td>
      <td class="remarks-td" title="${s.desc}">${s.desc}</td>
    `;
    
    tr.addEventListener('click', () => {
      playSoundEffect('click');
      // Highlight row
      document.querySelectorAll('#sightings-table tbody tr').forEach(r => r.classList.remove('active-row'));
      tr.classList.add('active-row');
      
      // Update sidebar hologram details
      showHologramPopup(s);
      
      // Focus 3D Globe camera on coordinates
      state.globe.focusOnCoordinate(s.lat, s.lng);
    });
    
    tableBody.appendChild(tr);
  });
}

// Helper to format durations nicely
function formatDuration(seconds) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m`;
}

// Show sidebar hologram panel details
function showHologramPopup(sighting) {
  playSoundEffect('popup');
  
  document.getElementById('popup-location').textContent = `${sighting.city}, ${sighting.state} (${sighting.country})`.toUpperCase();
  document.getElementById('popup-date').textContent = sighting.date;
  document.getElementById('popup-shape').textContent = sighting.shape.toUpperCase();
  document.getElementById('popup-duration').textContent = formatDuration(sighting.duration).toUpperCase();
  document.getElementById('popup-desc').textContent = `"${sighting.desc}"`;
  
  document.getElementById('sighting-popup').classList.remove('hidden');
}

// Apply year scrubber change
function handleYearChange(newYear) {
  state.activeYear = parseInt(newYear, 10);
  document.getElementById('current-year-label').textContent = state.activeYear;
  
  // 1. Recompute in-memory aggregates (updates charts)
  recomputeAggregates();
  
  // 2. Hide/show pins on 3D Globe map
  const activeCount = state.globe.updateFilters(state.activeYear, state.selectedCountry, state.selectedShape, state.searchQuery);
  
  // Update total sightings KPI based on year
  // If showing full dataset, use sum.json, else count
  if (state.activeYear === 2014 && state.selectedCountry === 'ALL' && state.selectedShape === 'ALL' && !state.searchQuery) {
    document.getElementById('kpi-total').textContent = state.summary.total_sightings.toLocaleString();
  } else {
    // Estimated scaling factor (sample is 3,000 / 77,127 = ~3.88% density)
    // Display actual visible count on globe for accuracy
    document.getElementById('kpi-total').textContent = `${activeCount} (Plotted)`;
  }
}

// Setup play time-lapse timeline loop
function toggleTimelinePlayback() {
  const btn = document.getElementById('play-btn');
  playSoundEffect('click');
  
  if (state.isPlaying) {
    // Pause
    state.isPlaying = false;
    clearInterval(state.playTimer);
    btn.textContent = '▶ PLAY';
    btn.classList.remove('active');
  } else {
    // Play
    state.isPlaying = true;
    btn.textContent = '⏸ PAUSE';
    btn.classList.add('active');
    
    // If slider is at maximum, reset to beginning
    const slider = document.getElementById('year-slider');
    if (parseInt(slider.value, 10) >= 2014) {
      slider.value = 1949;
      handleYearChange(1949);
    }
    
    state.playTimer = setInterval(() => {
      let currentVal = parseInt(slider.value, 10);
      if (currentVal < 2014) {
        currentVal++;
        slider.value = currentVal;
        handleYearChange(currentVal);
      } else {
        // End of timeline, pause
        toggleTimelinePlayback();
      }
    }, 900); // Year increments every 900ms
  }
}

// Main initialization
async function initDashboard() {
  // Init 3D logo in header
  initLogoScene('ufo-logo-container');
  // Init 3D holographic Alien face in right side card
  initAlienScene('alien-hologram-container');
  
  // 1. Fetch initial statistics and summary data
  try {
    state.summary = await loadJSON('/data/summary.json');
    const yearData = await loadJSON('/data/sightings_by_year.json');
    const shapeData = await loadJSON('/data/sightings_by_shape.json');
    const monthData = await loadJSON('/data/sightings_by_month.json');
    const hourData = await loadJSON('/data/sightings_by_hour.json');
    
    // Render static metrics KPIs
    document.getElementById('kpi-total').textContent = state.summary.total_sightings.toLocaleString();
    document.getElementById('kpi-country').textContent = state.summary.top_country;
    document.getElementById('kpi-shape').textContent = state.summary.top_shape;
    document.getElementById('kpi-hour').textContent = state.summary.peak_hour;
    
    // Initialize charts with static files
    state.charts = initCharts({
      year: yearData,
      shape: shapeData,
      month: monthData,
      hour: hourData
    });
    
    // 2. Fetch the 3D globe pins sample
    state.mapSightings = await loadJSON('/data/map_sightings.json');
    state.filteredSightings = [...state.mapSightings];
    
    // Populate select lists
    populateFilters();
    
    // Initialize 3D Globe map with coordinates
    state.globe = initGlobe('globe-container', state.mapSightings, (selectedPoint) => {
      // Pin Click Callback
      showHologramPopup(selectedPoint);
      
      // Select row in table if visible
      const rows = document.querySelectorAll('#sightings-table tbody tr');
      rows.forEach(r => {
        const dateCell = r.querySelector('td:first-child');
        if (dateCell && dateCell.textContent === selectedPoint.date) {
          r.classList.add('active-row');
          r.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
          r.classList.remove('active-row');
        }
      });
    });
    
    // Sync initial table log render
    recomputeAggregates();
    
    // Bind Filter Change Events
    document.getElementById('year-slider').addEventListener('input', (e) => {
      handleYearChange(e.target.value);
    });
    
    document.getElementById('play-btn').addEventListener('click', toggleTimelinePlayback);
    
    document.getElementById('country-select').addEventListener('change', (e) => {
      playSoundEffect('click');
      state.selectedCountry = e.target.value;
      recomputeAggregates();
      state.globe.updateFilters(state.activeYear, state.selectedCountry, state.selectedShape, state.searchQuery);
    });
    
    document.getElementById('shape-select').addEventListener('change', (e) => {
      playSoundEffect('click');
      state.selectedShape = e.target.value;
      recomputeAggregates();
      state.globe.updateFilters(state.activeYear, state.selectedCountry, state.selectedShape, state.searchQuery);
    });
    
    // Debounce search input for performance
    let searchTimeout;
    document.getElementById('search-input').addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        state.searchQuery = e.target.value.toLowerCase().trim();
        recomputeAggregates();
        state.globe.updateFilters(state.activeYear, state.selectedCountry, state.selectedShape, state.searchQuery);
      }, 300);
    });
    
    // Pagination Click Events
    document.getElementById('prev-page-btn').addEventListener('click', () => {
      playSoundEffect('click');
      if (state.currentPage > 1) {
        state.currentPage--;
        renderTable();
      }
    });
    
    document.getElementById('next-page-btn').addEventListener('click', () => {
      playSoundEffect('click');
      state.currentPage++;
      renderTable();
    });
    
    // Close hologram panel popup
    document.getElementById('close-popup-btn').addEventListener('click', () => {
      playSoundEffect('click');
      document.getElementById('sighting-popup').classList.add('hidden');
      document.querySelectorAll('#sightings-table tbody tr').forEach(r => r.classList.remove('active-row'));
    });
    
    // Audio volume sound synthesizer toggle
    document.getElementById('audio-toggle-btn').addEventListener('click', (e) => {
      state.audio.enabled = !state.audio.enabled;
      playSoundEffect('click');
      
      const btn = e.currentTarget;
      if (state.audio.enabled) {
        btn.classList.add('active');
        btn.innerHTML = '<span class="audio-icon">🔊</span> SOUND ON';
        if (state.audio.ambientGain) {
          // Fade hum in
          state.audio.ambientGain.gain.setTargetAtTime(0.035, state.audio.ctx.currentTime, 0.5);
        } else {
          initAudio();
        }
      } else {
        btn.classList.remove('active');
        btn.innerHTML = '<span class="audio-icon">🔇</span> SOUND OFF';
        if (state.audio.ambientGain) {
          // Fade hum out
          state.audio.ambientGain.gain.setTargetAtTime(0, state.audio.ctx.currentTime, 0.2);
        }
      }
    });
    
  } catch (err) {
    console.error("Dashboard initialization failed:", err);
  }
}

// BOOTSTRAP LANDING SCREEN
function bootstrap() {
  // Init 3D floating saucer scene on intro screen
  const introScene = initIntroScene('intro-ufo-container');
  
  // Enter system click event
  const enterBtn = document.getElementById('enter-btn');
  if (enterBtn) {
    enterBtn.addEventListener('click', () => {
      // Initialize and activate Synthesizer audio loops
      initAudio();
      playSoundEffect('beam');
      
      // Glitchy transition fading out intro screen
      const intro = document.getElementById('intro-screen');
      const dashboard = document.getElementById('dashboard-container');
      
      if (intro) {
        intro.style.opacity = '0';
        intro.style.pointerEvents = 'none';
      }
      
      if (dashboard) {
        dashboard.classList.remove('hidden');
        dashboard.style.opacity = '0';
      }
      
      setTimeout(() => {
        if (intro) intro.style.display = 'none';
        if (introScene) introScene.destroy(); // Destroy resource-heavy intro WebGL scene
        
        if (dashboard) dashboard.style.opacity = '1';
        // Initialize main dashboard and widgets
        initDashboard();
      }, 1200);
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
