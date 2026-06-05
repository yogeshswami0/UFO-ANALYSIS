import Chart from 'chart.js/auto';

// Global styling defaults for Chart.js to match our sci-fi theme
Chart.defaults.color = '#8fa0a6';
Chart.defaults.font.family = "'Share Tech Mono', monospace";
Chart.defaults.font.size = 11;

// Initialize legend font configuration safely
Chart.defaults.plugins.legend.labels.color = '#e2f1f5';
Chart.defaults.plugins.legend.labels.font = {
  family: "'Orbitron', sans-serif",
  size: 10
};

// Helper to create linear gradient fills
function createLineGradient(ctx, colorHex, opacityStart, opacityEnd) {
  const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.clientHeight || 150);
  // Convert hex color to rgba
  const r = parseInt(colorHex.slice(1, 3), 16);
  const g = parseInt(colorHex.slice(3, 5), 16);
  const b = parseInt(colorHex.slice(5, 7), 16);
  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${opacityStart})`);
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${opacityEnd})`);
  return gradient;
}

export function initCharts(initialData) {
  // 1. TREND AREA CHART
  const trendCtx = document.getElementById('trend-chart').getContext('2d');
  const trendGradient = createLineGradient(trendCtx, '#00f0ff', 0.35, 0.0);
  
  const trendChart = new Chart(trendCtx, {
    type: 'line',
    data: {
      labels: initialData.year.years,
      datasets: [{
        label: 'Sightings',
        data: initialData.year.counts,
        borderColor: '#00f0ff',
        borderWidth: 2,
        fill: true,
        backgroundColor: trendGradient,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: '#00f0ff',
        pointHoverBorderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(8, 20, 31, 0.9)',
          titleColor: '#00f0ff',
          bodyColor: '#e2f1f5',
          borderColor: '#00f0ff',
          borderWidth: 1,
          displayColors: false
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(0, 240, 255, 0.05)' },
          ticks: { maxRotation: 0 }
        },
        y: {
          grid: { color: 'rgba(0, 240, 255, 0.05)' },
          beginAtZero: true
        }
      }
    }
  });

  // 2. SHAPES HORIZONTAL BAR CHART
  const shapeCtx = document.getElementById('shape-chart').getContext('2d');
  const shapeGradient = createLineGradient(shapeCtx, '#bc00dd', 0.8, 0.3);
  
  const shapeChart = new Chart(shapeCtx, {
    type: 'bar',
    data: {
      labels: initialData.shape.shapes,
      datasets: [{
        label: 'Count',
        data: initialData.shape.counts,
        backgroundColor: shapeGradient,
        borderColor: '#bc00dd',
        borderWidth: 1,
        borderRadius: 3,
        barPercentage: 0.75
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(8, 20, 31, 0.9)',
          titleColor: '#bc00dd',
          bodyColor: '#e2f1f5',
          borderColor: '#bc00dd',
          borderWidth: 1,
          displayColors: false
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(188, 0, 221, 0.05)' },
          beginAtZero: true
        },
        y: {
          grid: { display: false }
        }
      }
    }
  });

  // 3. SEASONAL POLAR AREA CHART
  const monthCtx = document.getElementById('month-chart').getContext('2d');
  
  const monthChart = new Chart(monthCtx, {
    type: 'polarArea',
    data: {
      labels: initialData.month.months,
      datasets: [{
        data: initialData.month.counts,
        backgroundColor: [
          'rgba(0, 240, 255, 0.3)',
          'rgba(57, 255, 20, 0.3)',
          'rgba(188, 0, 221, 0.3)',
          'rgba(255, 119, 0, 0.3)',
          'rgba(0, 240, 255, 0.2)',
          'rgba(57, 255, 20, 0.2)',
          'rgba(188, 0, 221, 0.2)',
          'rgba(255, 119, 0, 0.2)',
          'rgba(0, 240, 255, 0.4)',
          'rgba(57, 255, 20, 0.4)',
          'rgba(188, 0, 221, 0.4)',
          'rgba(255, 119, 0, 0.4)'
        ],
        borderColor: 'rgba(8, 12, 21, 0.8)',
        borderWidth: 1.5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { boxWidth: 10, padding: 8 }
        },
        tooltip: {
          backgroundColor: 'rgba(8, 20, 31, 0.9)',
          bodyColor: '#e2f1f5',
          borderColor: 'rgba(0, 240, 255, 0.3)',
          borderWidth: 1,
          displayColors: true
        }
      },
      scales: {
        r: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          angleLines: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { display: false }
        }
      }
    }
  });

  // 4. HOURLY RADAR/LINE OVERLAY CHART
  const hourCtx = document.getElementById('hour-chart').getContext('2d');
  const hourGradient = createLineGradient(hourCtx, '#39ff14', 0.4, 0.0);
  
  const hourChart = new Chart(hourCtx, {
    type: 'line',
    data: {
      labels: initialData.hour.hours,
      datasets: [{
        label: 'Sightings',
        data: initialData.hour.counts,
        borderColor: '#39ff14',
        borderWidth: 1.5,
        fill: true,
        backgroundColor: hourGradient,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 3,
        pointHoverBackgroundColor: '#39ff14'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(8, 20, 31, 0.9)',
          titleColor: '#39ff14',
          bodyColor: '#e2f1f5',
          borderColor: '#39ff14',
          borderWidth: 1,
          displayColors: false
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            maxTicksLimit: 6,
            maxRotation: 0
          }
        },
        y: {
          grid: { color: 'rgba(57, 255, 20, 0.04)' },
          beginAtZero: true,
          ticks: { display: false }
        }
      }
    }
  });

  // API to update charts dynamically
  function updateCharts(filteredData) {
    // 1. Update Trend Chart
    trendChart.data.labels = filteredData.year.years;
    trendChart.data.datasets[0].data = filteredData.year.counts;
    trendChart.update();

    // 2. Update Shape Chart
    shapeChart.data.labels = filteredData.shape.shapes;
    shapeChart.data.datasets[0].data = filteredData.shape.counts;
    shapeChart.update();

    // 3. Update Month Chart
    monthChart.data.labels = filteredData.month.months;
    monthChart.data.datasets[0].data = filteredData.month.counts;
    monthChart.update();

    // 4. Update Hour Chart
    hourChart.data.labels = filteredData.hour.hours;
    hourChart.data.datasets[0].data = filteredData.hour.counts;
    hourChart.update();
  }

  return {
    updateCharts
  };
}
