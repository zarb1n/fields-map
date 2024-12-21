// Initialize the map
function initializeMap() {
  const map = L.map('map').setView([0, 0], 2);

  // Define base layers
  const osmTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
  });

  const satelliteTileLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ',
      }
  );

  const topoTileLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenTopoMap contributors',
  });

  // Add OpenStreetMap as the default base layer
  osmTileLayer.addTo(map);

  // Define the base layers
  const baseLayers = {
      'OpenStreetMap': osmTileLayer,
      'Satellite View': satelliteTileLayer,
      'Topographic View': topoTileLayer,
  };

  // Add the layer control
  L.control.layers(baseLayers).addTo(map);

  const attrSection = document.querySelector('.leaflet-control-attribution')
  attrSection.innerHTML +=  ' | <a href="https://t.me/zarb1n">Кузьмичев Павел</a>'

  return { map, baseLayers };
}

// Clear non-base layers from the map
function clearNonBaseLayers(map, baseLayers) {
  if (!map) {
      console.error('Map is undefined. Ensure the map is initialized before calling clearNonBaseLayers.');
      return;
  }

  map.eachLayer(layer => {
      if (!Object.values(baseLayers).includes(layer)) {
          map.removeLayer(layer);
      }
  });
}

// Function to load and display a shapefile
function loadShapefile(map, fileName) {
  const filePath = new URL(`./data/${fileName}`, window.location.href).href;
  console.log('Attempting to load shapefile:', fileName);
  console.log('Constructed file path:', filePath);

  shp(filePath)
      .then(geojson => {
          console.log('Shapefile loaded successfully:', geojson);

          const geoJsonLayer = L.geoJSON(geojson, {
              onEachFeature: (feature, layer) => {
                  if (feature.properties) {
                      const landuser = feature.properties.landuser || 'Unknown Landuser';
                      const cropName = feature.properties.cr_fa_ru || 'Unknown Crop';

                      const tooltipContent = `
                          <b>Landuser:</b> ${landuser}<br>
                          <b>Crop:</b> ${cropName}
                      `;

                      layer.bindTooltip(tooltipContent, { sticky: true });

                      layer.on('click', () => {
                          const bounds = layer.getBounds();
                          map.flyToBounds(bounds, {
                              padding: [50, 50],
                              duration: 1.5,
                          });
                      });
                  }
              },
          });

          geoJsonLayer.addTo(map);
          const allBounds = geoJsonLayer.getBounds();
          map.flyToBounds(allBounds, {
              padding: [50, 50],
              duration: 1.5,
          });
      })
      .catch(error => {
          console.error('Failed to load shapefile:', error);
      });
}

function loadGeoTIFF(map, fileName) {
  const filePath = `./data/${fileName}`;
  console.log('Attempting to load GeoTIFF:', fileName);

  fetch(filePath)
      .then(response => response.arrayBuffer())
      .then(buffer => parseGeoraster(buffer))
      .then(georaster => {
          console.log('GeoTIFF loaded successfully:', georaster);

          const min = georaster.mins[0];
          const max = georaster.maxs[0];

          const colorScale = value => {
              const ratio = (value - min) / (max - min);
              return `rgb(${Math.round(ratio * 255)}, ${Math.round((1 - ratio) * 255)}, 150)`;
          };

          // Ensure GeoTIFF layer is added with the correct z-index
          const paneName = 'geoRasterPane';
          if (!map.getPane(paneName)) {
              map.createPane(paneName); // Create a custom pane for the GeoTIFF layer
          }
          map.getPane(paneName).style.zIndex = 450; // Higher than the base layers

          const layer = new GeoRasterLayer({
              georaster: georaster,
              opacity: 0.7,
              pane: paneName, // Assign the custom pane
              pixelValuesToColorFn: values => {
                  const value = values[0];
                  if (value === null || value < min || value > max) return null;
                  return colorScale(value);
              },
          });

          map.addLayer(layer);
          map.fitBounds(layer.getBounds());
      })
      .catch(error => {
          console.error('Failed to load GeoTIFF:', error);
      });
}

// Initialize map and layers
const { map, baseLayers } = initializeMap();

// Populate the dropdown selector
const fileSelector = document.getElementById('file-selector');
if (fileSelector) {
  const availableFiles = [
      { name: 'Districts (Shapefile)', file: 'Districts.shp' },
      { name: 'Fields (Shapefile)', file: 'fields.shp' },
      { name: 'Slope (GeoTIFF)', file: 'slope.tif' },
      { name: 'SRTM Marks (GeoTIFF)', file: 'srtm_marks.tif' },
      { name: 'ZonalStats NDVI (Shapefile)', file: 'ZonalStatsNDVI.shp' },
      { name: 'ZonalStats Slope (Shapefile)', file: 'ZonalStatSlope.shp' },
  ];

  availableFiles.forEach(file => {
      const option = document.createElement('option');
      option.value = file.file;
      option.textContent = file.name;
      fileSelector.appendChild(option);
  });

  fileSelector.addEventListener('change', event => {
      const fileName = event.target.value;
      console.log('Selected file:', fileName);

      clearNonBaseLayers(map, baseLayers);

      if (fileName.endsWith('.shp')) {
          loadShapefile(map, fileName);
      } else if (fileName.endsWith('.tif')) {
          loadGeoTIFF(map, fileName);
      }
  });
} else {
  console.error('File selector not found in the DOM.');
}