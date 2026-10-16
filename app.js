'use strict';

const STRUCTURES = [
  { id: '1', name: 'Desert Temple', short: 'DT', aliases: ['desert temple', 'desert pyramid', 'desert pyramid temple', 'desert temple'], color: '#bb8424', group: 'rare' },
  { id: '2', name: 'Jungle Temple', short: 'JT', aliases: ['jungle temple', 'jungle pyramid'], color: '#34845b', group: 'rare' },
  { id: '3', name: 'Witch Hut', short: 'WH', aliases: ['witch hut', 'swamp hut'], color: '#8064bc', group: 'rare' },
  { id: '4', name: 'Igloo', short: 'IG', aliases: ['igloo'], color: '#4388a0', group: 'rare' },
  { id: '5', name: 'Village', short: 'V', aliases: ['village'], color: '#b78624', group: 'village' },
  { id: '6', name: 'Ocean Ruins', short: 'OR', aliases: ['ocean ruins', 'ocean ruin'], color: '#28869d', group: 'ocean' },
  { id: '7', name: 'Shipwreck', short: 'SW', aliases: ['shipwreck', 'ship wreck'], color: '#3685b6', group: 'ocean' },
  { id: '8', name: 'Ocean Monument', short: 'OM', aliases: ['ocean monument', 'monument'], color: '#2e6fae', group: 'ocean' },
  { id: '9', name: 'Woodland Mansion', short: 'WM', aliases: ['woodland mansion', 'mansion'], color: '#8064bc', group: 'rare' },
  { id: '10', name: 'Pillager Outpost', short: 'PO', aliases: ['pillager outpost', 'outpost'], color: '#c06c63', group: 'rare' },
  { id: '11', name: 'Ruined Portal', short: 'RP', aliases: ['ruined portal'], color: '#b56542', group: 'rare' },
  { id: '12', name: 'Nether Ruined Portal', short: 'NP', aliases: ['ruined portal nether', 'nether ruined portal', 'ruined portal in nether'], color: '#9655a5', group: 'rare' },
  { id: '13', name: 'Ancient City', short: 'AC', aliases: ['ancient city'], color: '#7253a6', group: 'rare' },
  { id: '14', name: 'Buried Treasure', short: 'BT', aliases: ['buried treasure', 'treasure'], color: '#b78624', group: 'rare' },
  { id: '15', name: 'Mineshaft', short: 'MS', aliases: ['mineshaft', 'mine shaft'], color: '#64748b', group: 'rare' },
  { id: '23', name: 'Trail Ruins', short: 'TR', aliases: ['trail ruins', 'trail ruin'], color: '#a97851', group: 'rare' },
  { id: '24', name: 'Trial Chamber', short: 'TC', aliases: ['trial chamber', 'trial chambers'], color: '#596fc1', group: 'rare' }
];

const els = {
  form: document.getElementById('scan-form'), seed: document.getElementById('seed'), version: document.getElementById('game-version'),
  x: document.getElementById('coord-x'), z: document.getElementById('coord-z'), radius: document.getElementById('radius'), max: document.getElementById('max-results'),
  options: document.getElementById('structure-options'), toggleStructures: document.getElementById('toggle-structures'), randomSeed: document.getElementById('random-seed'),
  scanButton: document.getElementById('scan-button'), scanButtonLabel: document.getElementById('scan-button-label'), canvas: document.getElementById('world-map'), stage: document.getElementById('map-stage'),
  subtitle: document.getElementById('map-subtitle'), zoomValue: document.getElementById('zoom-value'), resetView: document.getElementById('reset-view'), centerMap: document.getElementById('center-map'),
  cursorCoords: document.getElementById('cursor-coords'), mapEmpty: document.getElementById('map-empty'), mapLoading: document.getElementById('map-loading'),
  clickedCoordinate: document.getElementById('clicked-coordinate'), clickedCoordsText: document.getElementById('clicked-coords-text'), useClickedCoords: document.getElementById('use-clicked-coords'),
  resultCount: document.getElementById('result-count'), resultsStatus: document.getElementById('results-status'), resultsList: document.getElementById('results-list'), resultsEmpty: document.getElementById('results-empty'),
  shareLink: document.getElementById('share-link'), toast: document.getElementById('toast'), gridToggle: document.getElementById('grid-toggle'), structuresToggle: document.getElementById('structures-toggle')
};

const VERSION_OPTIONS = new Set(['26.x', '1.21.x', '1.20.x', '1.19.x', '1.18.x', '1.17.x']);
const state = {
  results: [], scanned: false, loading: false, scanCenter: { x: 0, z: 0 }, viewCenter: { x: 0, z: 0 }, radius: 100, zoom: 1,
  selectedResult: null, clickedPoint: null, activePointers: new Map(), drag: null, pinch: null, gestureMoved: false,
  showGrid: true, showStructures: true, lastRequestAt: 0, toastTimer: null, requestedVersion: '26.x', versionApplied: false
};
let ctx = null, mapWidth = 0, mapHeight = 0, dpr = 1;

function normalizeName(name) {
  return String(name || '').replaceAll('_', ' ').replaceAll('-', ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

function selectedStructureIds() {
  return Array.from(els.options.querySelectorAll('input[type="checkbox"]:checked')).map(input => input.value);
}

function buildStructureOptions() {
  const fragment = document.createDocumentFragment();
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('types') ? params.get('types').split(',') : ['1', '5', '7', '8', '10', '13', '24'];
  for (const structure of STRUCTURES) {
    const label = document.createElement('label');
    label.className = 'structure-option';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox'; checkbox.value = structure.id; checkbox.checked = requested.includes(structure.id);
    checkbox.setAttribute('aria-label', structure.name);
    const name = document.createElement('span'); name.textContent = structure.name;
    label.append(checkbox, name); fragment.appendChild(label);
  }
  els.options.replaceChildren(fragment); updateToggleLabel();
}

function updateToggleLabel() {
  const count = selectedStructureIds().length;
  els.toggleStructures.textContent = count === STRUCTURES.length ? 'Clear all' : 'Select all';
}

function parseNumberField(input, label, min, max) {
  const value = Number(input.value);
  if (!Number.isFinite(value) || value < min || value > max) {
    input.focus();
    throw new Error(`${label} must be between ${min.toLocaleString()} and ${max.toLocaleString()}.`);
  }
  return Math.trunc(value);
}

function readSettings() {
  const seed = els.seed.value.trim();
  if (!/^-?\d{1,20}$/.test(seed)) { els.seed.focus(); throw new Error('Enter a numeric Minecraft seed (up to 20 digits).'); }
  const x = Number(els.x.value), z = Number(els.z.value);
  if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > 30000000 || Math.abs(z) > 30000000) {
    throw new Error('X and Z must be valid coordinates between -30,000,000 and 30,000,000.');
  }
  const radius = parseNumberField(els.radius, 'Radius', 1, 1000);
  const max = parseNumberField(els.max, 'Max results', 1, 200);
  const types = selectedStructureIds();
  if (!types.length) throw new Error('Select at least one structure type.');
  const version = VERSION_OPTIONS.has(els.version.value) ? els.version.value : '26.x';
  return { seed, x: Math.trunc(x), z: Math.trunc(z), radius, max, types, version };
}

function showToast(message) {
  els.toast.textContent = message; els.toast.classList.add('visible');
  clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => els.toast.classList.remove('visible'), 2400);
}

async function copyText(value, successMessage = 'Copied to clipboard.') {
  try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(value);
    else {
      const area = document.createElement('textarea'); area.value = value; area.setAttribute('readonly', '');
      area.style.position = 'fixed'; area.style.opacity = '0'; document.body.appendChild(area); area.select();
      const succeeded = document.execCommand('copy'); area.remove(); if (!succeeded) throw new Error('Clipboard unavailable');
    }
    showToast(successMessage);
  } catch { showToast('Copy failed. You can select the coordinates manually.'); }
}

function buildShareUrl(settings) {
  const url = new URL(window.location.href); url.search = '';
  url.searchParams.set('seed', settings.seed); url.searchParams.set('version', settings.version);
  url.searchParams.set('x', String(settings.x)); url.searchParams.set('z', String(settings.z));
  url.searchParams.set('radius', String(settings.radius)); url.searchParams.set('max', String(settings.max)); url.searchParams.set('types', settings.types.join(','));
  return url.toString();
}
function syncUrl(settings) {
  const url = new URL(buildShareUrl(settings)); window.history.replaceState({}, '', url.pathname + url.search);
}

function prettyName(name) {
  const clean = normalizeName(name);
  const matches = STRUCTURES.map(structure => ({ structure, aliases: structure.aliases.map(normalizeName).sort((a, b) => b.length - a.length) }));
  for (const item of matches) if (item.aliases.includes(clean)) return item.structure.name;
  for (const item of matches) for (const alias of item.aliases) if (alias.length >= 5 && clean.includes(alias)) return item.structure.name;
  return clean.replace(/\b\w/g, letter => letter.toUpperCase()) || 'Structure';
}

function structureForResult(result) {
  const clean = normalizeName(result?.name);
  // Resolve the Nether portal first so it is not mistaken for an Overworld ruined portal.
  const ordered = [...STRUCTURES].sort((a, b) => {
    const aNether = a.id === '12' ? 1 : 0, bNether = b.id === '12' ? 1 : 0;
    return bNether - aNether;
  });
  for (const structure of ordered) {
    if (structure.aliases.map(normalizeName).includes(clean)) return structure;
  }
  for (const structure of ordered) {
    const aliases = structure.aliases.map(normalizeName).sort((a, b) => b.length - a.length);
    if (aliases.some(alias => alias.length >= 5 && clean.includes(alias))) return structure;
  }
  return { id: 'other', name: prettyName(result?.name), short: '•', color: '#74869e', group: 'rare', aliases: [] };
}

function blockDistance(result, center = state.scanCenter) { return Math.hypot(Number(result.x) - center.x, Number(result.z) - center.z); }
function setLoading(isLoading) {
  state.loading = isLoading; els.scanButton.disabled = isLoading;
  els.scanButtonLabel.textContent = isLoading ? 'Scanning…' : 'Find structures';
  els.mapLoading.hidden = !isLoading; els.scanButton.querySelector('.button-arrow').textContent = isLoading ? '…' : '→';
}
function setResultsStatus(text, isError = false) { els.resultsStatus.textContent = text; els.resultsStatus.classList.toggle('error', isError); }

async function scanSeed(event) {
  if (event) event.preventDefault();
  if (state.loading) return;
  if (Date.now() - state.lastRequestAt < 900) { showToast('Please wait a moment before scanning again.'); return; }
  let settings;
  try { settings = readSettings(); }
  catch (error) { setResultsStatus(error.message, true); showToast(error.message); return; }

  state.lastRequestAt = Date.now(); state.radius = settings.radius; state.scanCenter = { x: settings.x, z: settings.z };
  state.viewCenter = { ...state.scanCenter }; state.zoom = 1; state.clickedPoint = null; state.selectedResult = null;
  state.requestedVersion = settings.version; state.versionApplied = false;
  els.clickedCoordinate.hidden = true; els.mapEmpty.hidden = true;
  els.subtitle.textContent = `Center: X ${formatInteger(settings.x)} · Z ${formatInteger(settings.z)}`;
  syncUrl(settings); setLoading(true);
  setResultsStatus('Querying the Bedrock structure service…'); drawMap();

  try {
    const endpoint = new URL('/api/scan', window.location.href);
    endpoint.searchParams.set('seed', settings.seed); endpoint.searchParams.set('x', String(settings.x)); endpoint.searchParams.set('z', String(settings.z));
    endpoint.searchParams.set('radius', String(settings.radius)); endpoint.searchParams.set('max', String(settings.max)); endpoint.searchParams.set('types', settings.types.join(','));
    // The upstream has no version parameter; omit it so identical scans share a cache key.
    const response = await fetch(endpoint.toString(), { method: 'GET', headers: { Accept: 'application/json' }, cache: 'default' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || payload.message || `Request failed (HTTP ${response.status}).`);
    if (!Array.isArray(payload.results)) throw new Error('The structure service returned an unexpected response.');
    state.results = payload.results.filter(item => Number.isFinite(Number(item.x)) && Number.isFinite(Number(item.z)));
    state.scanned = true; state.versionApplied = payload.versionApplied === true;
    renderResults(); drawMap();
    const versionNote = `Requested ${settings.version}; the current provider does not accept a version parameter, so results use the provider's generation rules.`;
    if (state.results.length) setResultsStatus(`Found ${state.results.length} structure${state.results.length === 1 ? '' : 's'}. Pins show structure-chunk centers, not exact entrance blocks. ${versionNote}`);
    else setResultsStatus(`No supported structures were returned for this seed, center, and selection. Try increasing the radius. ${versionNote}`);
    showToast(state.results.length ? `Scan complete · ${state.results.length} results` : 'Scan complete · no structures found');
  } catch (error) {
    state.results = []; state.scanned = false; renderResults(); drawMap();
    let message = error instanceof Error ? error.message : 'Unknown request error.';
    if (message === 'Failed to fetch' || message.includes('NetworkError')) message = 'Could not reach the structure service. Check your connection and try again.';
    setResultsStatus(message, true); showToast('Scan failed. See the results panel.');
  } finally {
    setLoading(false); els.mapEmpty.hidden = state.scanned; updateZoomLabel(); drawMap();
  }
}

function formatInteger(number) { return Math.round(Number(number)).toLocaleString('en-US'); }

function renderResults() {
  els.resultCount.textContent = String(state.results.length); els.resultsList.replaceChildren();
  els.resultsEmpty.hidden = state.results.length > 0;
  const fragment = document.createDocumentFragment();
  state.results.forEach(result => {
    const structure = structureForResult(result);
    const card = document.createElement('article'); card.className = 'structure-result' + (state.selectedResult === result ? ' selected' : '');
    card.tabIndex = 0; card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `${structure.name} at X ${formatInteger(result.x)}, Z ${formatInteger(result.z)}`);
    card.title = 'Pin is at the center of the structure chunk returned by the provider; the entrance may be elsewhere.';
    card.addEventListener('click', () => focusResult(result));
    card.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); focusResult(result); } });

    const top = document.createElement('div'); top.className = 'result-topline';
    const icon = document.createElement('span'); icon.className = 'result-icon'; icon.textContent = structure.short; icon.style.color = structure.color;
    const nameGroup = document.createElement('div'); nameGroup.className = 'result-name-group';
    const name = document.createElement('div'); name.className = 'result-name'; name.textContent = structure.name;
    const distance = document.createElement('div'); distance.className = 'result-distance';
    const distanceChunks = Number.isFinite(Number(result.distance)) ? Number(result.distance) : blockDistance(result) / 16;
    distance.textContent = `${distanceChunks.toFixed(1)} chunks away`;
    nameGroup.append(name, distance); top.append(icon, nameGroup);

    const coordRow = document.createElement('div'); coordRow.className = 'result-coords';
    const code = document.createElement('code'); code.textContent = `X ${formatInteger(result.x)} · Z ${formatInteger(result.z)}`;
    const actions = document.createElement('div'); actions.className = 'result-actions';
    const copy = document.createElement('button'); copy.type = 'button'; copy.textContent = 'Copy'; copy.setAttribute('aria-label', `Copy coordinates for ${structure.name}`);
    copy.addEventListener('click', event => { event.stopPropagation(); copyText(`${Math.round(Number(result.x))} ${Math.round(Number(result.z))}`, 'X Z chunk-center coordinates copied.'); });
    const tp = document.createElement('button'); tp.type = 'button'; tp.textContent = '/tp'; tp.setAttribute('aria-label', `Copy teleport command for ${structure.name}`);
    tp.addEventListener('click', event => { event.stopPropagation(); copyText(`/tp @s ${Math.round(Number(result.x))} ~ ${Math.round(Number(result.z))}`, 'Teleport command copied.'); });
    actions.append(copy, tp); coordRow.append(code, actions);
    const coordinateType = document.createElement('p'); coordinateType.className = 'result-coordinate-type'; coordinateType.textContent = 'Structure chunk center';
    card.append(top, coordRow, coordinateType); fragment.append(card);
  });
  els.resultsList.append(fragment);
}

function focusResult(result) {
  state.selectedResult = result; state.viewCenter = { x: Number(result.x), z: Number(result.z) }; state.zoom = Math.max(state.zoom, 1.4);
  renderResults(); drawMap(); updateZoomLabel(); els.cursorCoords.textContent = `X ${formatInteger(result.x)} · Z ${formatInteger(result.z)}`;
}
function updateZoomLabel() { els.zoomValue.textContent = `${Math.round(state.zoom * 100)}%`; }

function niceGridStep(targetPixels, scale) {
  const targetWorld = targetPixels / Math.max(scale, 0.000001);
  const power = Math.pow(10, Math.floor(Math.log10(Math.max(targetWorld, 1))));
  const candidates = [1, 2, 5, 10].map(multiplier => multiplier * power);
  return candidates.reduce((best, candidate) => Math.abs(candidate - targetWorld) < Math.abs(best - targetWorld) ? candidate : best, candidates[0]);
}
function currentScale() {
  const viewRadiusBlocks = Math.max(state.radius * 16, 256);
  return Math.min(mapWidth, mapHeight) / (viewRadiusBlocks * 2.12) * state.zoom;
}
function worldToScreen(x, z, scale = currentScale()) { return { x: mapWidth / 2 + (x - state.viewCenter.x) * scale, y: mapHeight / 2 + (z - state.viewCenter.z) * scale }; }
function screenToWorld(x, y, scale = currentScale()) { return { x: state.viewCenter.x + (x - mapWidth / 2) / scale, z: state.viewCenter.z + (y - mapHeight / 2) / scale }; }

function drawMap() {
  if (!ctx || !mapWidth || !mapHeight) return;
  const g = ctx; g.clearRect(0, 0, mapWidth, mapHeight); g.fillStyle = '#fbfdff'; g.fillRect(0, 0, mapWidth, mapHeight);
  const scale = currentScale();
  const minX = state.viewCenter.x - mapWidth / (2 * scale), maxX = state.viewCenter.x + mapWidth / (2 * scale);
  const minZ = state.viewCenter.z - mapHeight / (2 * scale), maxZ = state.viewCenter.z + mapHeight / (2 * scale);
  if (state.showGrid) {
    const step = niceGridStep(64, scale);
    g.lineWidth = 1; g.strokeStyle = 'rgba(111, 139, 174, .16)'; g.beginPath();
    for (let x = Math.floor(minX / step) * step; x <= maxX; x += step) { const px = worldToScreen(x, 0, scale).x; g.moveTo(Math.round(px) + .5, 0); g.lineTo(Math.round(px) + .5, mapHeight); }
    for (let z = Math.floor(minZ / step) * step; z <= maxZ; z += step) { const py = worldToScreen(0, z, scale).y; g.moveTo(0, Math.round(py) + .5); g.lineTo(mapWidth, Math.round(py) + .5); }
    g.stroke();
    const labelStep = step * (scale * step < 72 ? 2 : 1); g.font = '10px ui-monospace, monospace'; g.fillStyle = 'rgba(83, 106, 137, .72)'; g.textBaseline = 'top';
    for (let x = Math.ceil(minX / labelStep) * labelStep; x <= maxX; x += labelStep) { const px = worldToScreen(x, 0, scale).x; if (px > 30 && px < mapWidth - 20) g.fillText(shortCoordinate(x), px + 4, 7); }
    for (let z = Math.ceil(minZ / labelStep) * labelStep; z <= maxZ; z += labelStep) { const py = worldToScreen(0, z, scale).y; if (py > 25 && py < mapHeight - 22) g.fillText(shortCoordinate(z), 7, py + 4); }
    const origin = worldToScreen(0, 0, scale); g.save(); g.strokeStyle = 'rgba(23, 59, 104, .24)'; g.lineWidth = 1; g.setLineDash([4, 6]);
    if (origin.x >= 0 && origin.x <= mapWidth) { g.beginPath(); g.moveTo(origin.x, 0); g.lineTo(origin.x, mapHeight); g.stroke(); }
    if (origin.y >= 0 && origin.y <= mapHeight) { g.beginPath(); g.moveTo(0, origin.y); g.lineTo(mapWidth, origin.y); g.stroke(); }
    g.restore();
  }
  drawCenterMarker(worldToScreen(state.scanCenter.x, state.scanCenter.z, scale));
  if (state.showStructures) {
    for (const result of state.results) {
      const p = worldToScreen(Number(result.x), Number(result.z), scale);
      if (p.x < -35 || p.x > mapWidth + 35 || p.y < -35 || p.y > mapHeight + 35) continue;
      drawStructureMarker(p.x, p.y, structureForResult(result), state.selectedResult === result);
    }
  }
  if (state.clickedPoint) {
    const p = worldToScreen(state.clickedPoint.x, state.clickedPoint.z, scale);
    if (p.x >= 0 && p.x <= mapWidth && p.y >= 0 && p.y <= mapHeight) {
      g.save(); g.strokeStyle = '#173b68'; g.lineWidth = 1.5; g.setLineDash([4, 3]); g.beginPath(); g.arc(p.x, p.y, 10, 0, Math.PI * 2); g.stroke(); g.restore();
    }
  }
  const niceDistance = niceGridStep(84, scale), barPx = niceDistance * scale;
  if (barPx < mapWidth - 35) {
    const x = mapWidth - barPx - 17, y = mapHeight - 22; g.strokeStyle = '#54749b'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + barPx, y); g.stroke();
    g.beginPath(); g.moveTo(x, y - 4); g.lineTo(x, y + 4); g.moveTo(x + barPx, y - 4); g.lineTo(x + barPx, y + 4); g.stroke();
    g.fillStyle = '#526b8b'; g.font = '9px ui-monospace, monospace'; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText(`${shortCoordinate(niceDistance)} blocks`, x + barPx / 2, y - 5); g.textAlign = 'start';
  }
}

function shortCoordinate(value) {
  const abs = Math.abs(value), sign = value < 0 ? '-' : '';
  if (abs >= 1000000) return `${sign}${(abs / 1000000).toFixed(abs % 1000000 === 0 ? 0 : 1)}m`;
  if (abs >= 10000) return `${sign}${(abs / 1000).toFixed(abs % 1000 === 0 ? 0 : 1)}k`;
  return String(Math.round(value));
}
function drawCenterMarker(point) {
  if (point.x < -20 || point.x > mapWidth + 20 || point.y < -20 || point.y > mapHeight + 20) return;
  ctx.save(); ctx.strokeStyle = '#173b68'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(point.x, point.y, 7, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(point.x - 12, point.y); ctx.lineTo(point.x + 12, point.y); ctx.moveTo(point.x, point.y - 12); ctx.lineTo(point.x, point.y + 12); ctx.stroke();
  ctx.fillStyle = '#173b68'; ctx.beginPath(); ctx.arc(point.x, point.y, 2.6, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
function drawStructureMarker(x, y, structure, selected) {
  ctx.save(); ctx.fillStyle = structure.color; ctx.globalAlpha = .15; ctx.beginPath(); ctx.arc(x, y, selected ? 13 : 10, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff'; ctx.strokeStyle = selected ? '#173b68' : structure.color; ctx.lineWidth = selected ? 2.4 : 1.8;
  ctx.beginPath(); ctx.arc(x, y, selected ? 8 : 6.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = structure.color; ctx.font = 'bold 7px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(structure.short.length > 2 ? structure.short.slice(0, 2) : structure.short, x, y + .25);
  if (selected || state.zoom >= 1.5) {
    const label = structure.name; ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const width = Math.min(ctx.measureText(label).width + 14, 165); const labelX = Math.max(4, Math.min(mapWidth - width - 4, x + 10)); const labelY = Math.max(4, Math.min(mapHeight - 24, y - 22));
    ctx.fillStyle = 'rgba(255,255,255,.97)'; ctx.strokeStyle = 'rgba(171,190,214,.95)'; ctx.lineWidth = 1; roundRect(ctx, labelX, labelY, width, 20, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#243b59'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(label, labelX + 7, labelY + 10, width - 12);
  }
  ctx.restore();
}
function roundRect(context, x, y, width, height, radius) {
  context.beginPath(); context.moveTo(x + radius, y); context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius); context.arcTo(x, y + height, x, y, radius); context.arcTo(x, y, x + width, y, radius); context.closePath();
}

function resizeCanvas() {
  if (!els.canvas) return; const rect = els.canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2); mapWidth = rect.width; mapHeight = rect.height;
  els.canvas.width = Math.round(mapWidth * dpr); els.canvas.height = Math.round(mapHeight * dpr); ctx = els.canvas.getContext('2d'); if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); drawMap();
}
function setZoom(nextZoom, anchorX = mapWidth / 2, anchorY = mapHeight / 2) {
  const oldScale = currentScale(), anchored = screenToWorld(anchorX, anchorY, oldScale);
  state.zoom = Math.max(.35, Math.min(9, nextZoom)); const newScale = currentScale();
  state.viewCenter.x = anchored.x - (anchorX - mapWidth / 2) / newScale;
  state.viewCenter.z = anchored.z - (anchorY - mapHeight / 2) / newScale;
  updateZoomLabel(); drawMap();
}
function canvasPosition(event) { const rect = els.canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
function distanceBetween(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function midpoint(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
function pickStructureAt(x, y) {
  if (!state.showStructures) return null;
  let nearest = null, nearestDistance = Infinity;
  for (const result of state.results) {
    const p = worldToScreen(Number(result.x), Number(result.z)); const distance = Math.hypot(x - p.x, y - p.y);
    if (distance < 17 && distance < nearestDistance) { nearest = result; nearestDistance = distance; }
  }
  return nearest;
}
function handleCanvasPointerDown(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  const p = canvasPosition(event); if (state.activePointers.size === 0) state.gestureMoved = false;
  state.activePointers.set(event.pointerId, p); els.canvas.setPointerCapture?.(event.pointerId);
  if (state.activePointers.size === 1) {
    state.drag = { id: event.pointerId, startX: p.x, startY: p.y, lastX: p.x, lastY: p.y, moved: false }; state.pinch = null;
  } else if (state.activePointers.size >= 2) {
    state.gestureMoved = true; state.drag = null;
    const [a, b] = Array.from(state.activePointers.values()).slice(0, 2), mid = midpoint(a, b);
    state.pinch = { startDistance: Math.max(1, distanceBetween(a, b)), startZoom: state.zoom, anchorWorld: screenToWorld(mid.x, mid.y) };
  }
}
function handleCanvasPointerMove(event) {
  const p = canvasPosition(event);
  if (!state.activePointers.has(event.pointerId)) {
    const world = screenToWorld(p.x, p.y); els.cursorCoords.textContent = `X ${formatInteger(world.x)} · Z ${formatInteger(world.z)}`; return;
  }
  state.activePointers.set(event.pointerId, p);
  if (state.activePointers.size >= 2 && state.pinch) {
    const [a, b] = Array.from(state.activePointers.values()).slice(0, 2), mid = midpoint(a, b);
    const currentDistance = Math.max(1, distanceBetween(a, b)); state.zoom = Math.max(.35, Math.min(9, state.pinch.startZoom * currentDistance / state.pinch.startDistance));
    const scale = currentScale(); state.viewCenter.x = state.pinch.anchorWorld.x - (mid.x - mapWidth / 2) / scale;
    state.viewCenter.z = state.pinch.anchorWorld.z - (mid.y - mapHeight / 2) / scale; state.gestureMoved = true; updateZoomLabel(); drawMap();
  } else if (state.drag && state.drag.id === event.pointerId) {
    const dx = p.x - state.drag.lastX, dy = p.y - state.drag.lastY;
    if (Math.hypot(p.x - state.drag.startX, p.y - state.drag.startY) > 4) { state.drag.moved = true; state.gestureMoved = true; }
    if (state.drag.moved) { const scale = currentScale(); state.viewCenter.x -= dx / scale; state.viewCenter.z -= dy / scale; els.canvas.classList.add('is-dragging'); drawMap(); }
    state.drag.lastX = p.x; state.drag.lastY = p.y;
  }
  const world = screenToWorld(p.x, p.y); els.cursorCoords.textContent = `X ${formatInteger(world.x)} · Z ${formatInteger(world.z)}`;
}
function handleCanvasPointerUp(event, cancelled = false) {
  if (!state.activePointers.has(event.pointerId)) return;
  const p = canvasPosition(event), wasSingle = state.activePointers.size === 1, wasTap = wasSingle && !state.gestureMoved && !cancelled;
  state.activePointers.delete(event.pointerId);
  if (wasTap) {
    const result = pickStructureAt(p.x, p.y);
    if (result) focusResult(result);
    else {
      const world = screenToWorld(p.x, p.y); state.clickedPoint = { x: Math.round(world.x), z: Math.round(world.z) };
      els.clickedCoordsText.textContent = `X ${formatInteger(world.x)} · Z ${formatInteger(world.z)}`; els.clickedCoordinate.hidden = false; drawMap();
    }
  }
  if (state.activePointers.size === 1) {
    const [remainingId, remainingPoint] = Array.from(state.activePointers.entries())[0];
    state.drag = { id: remainingId, startX: remainingPoint.x, startY: remainingPoint.y, lastX: remainingPoint.x, lastY: remainingPoint.y, moved: true };
    state.pinch = null; state.gestureMoved = true;
  } else if (state.activePointers.size === 0) { state.drag = null; state.pinch = null; state.gestureMoved = false; }
  else if (state.activePointers.size >= 2) {
    const [a, b] = Array.from(state.activePointers.values()).slice(0, 2), mid = midpoint(a, b);
    state.pinch = { startDistance: Math.max(1, distanceBetween(a, b)), startZoom: state.zoom, anchorWorld: screenToWorld(mid.x, mid.y) };
  }
  els.canvas.classList.remove('is-dragging');
}
function handleWheel(event) { event.preventDefault(); const p = canvasPosition(event); setZoom(state.zoom * (event.deltaY < 0 ? 1.14 : 1 / 1.14), p.x, p.y); }

function initializeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const seed = params.get('seed'); if (seed && /^-?\d{1,20}$/.test(seed)) els.seed.value = seed;
  const version = params.get('version'); if (version && VERSION_OPTIONS.has(version)) els.version.value = version;
  const x = params.get('x'); if (x !== null && Number.isFinite(Number(x))) els.x.value = String(Math.trunc(Number(x)));
  const z = params.get('z'); if (z !== null && Number.isFinite(Number(z))) els.z.value = String(Math.trunc(Number(z)));
  const radius = params.get('radius'); if (radius && Number(radius) >= 1 && Number(radius) <= 1000) els.radius.value = String(Math.trunc(Number(radius)));
  const max = params.get('max'); if (max && Number(max) >= 1 && Number(max) <= 200) els.max.value = String(Math.trunc(Number(max)));
  state.scanCenter = { x: Number(els.x.value) || 0, z: Number(els.z.value) || 0 }; state.viewCenter = { ...state.scanCenter };
  state.radius = Number(els.radius.value) || 100; state.requestedVersion = els.version.value;
  els.subtitle.textContent = `Center: X ${formatInteger(state.scanCenter.x)} · Z ${formatInteger(state.scanCenter.z)}`;
}

function bindEvents() {
  els.form.addEventListener('submit', scanSeed); els.options.addEventListener('change', updateToggleLabel);
  els.toggleStructures.addEventListener('click', () => {
    const checkboxes = Array.from(els.options.querySelectorAll('input[type="checkbox"]'));
    const selectAll = checkboxes.some(input => !input.checked); checkboxes.forEach(input => { input.checked = selectAll; }); updateToggleLabel();
  });
  els.randomSeed.addEventListener('click', () => {
    const words = new Uint32Array(2);
    if (window.crypto?.getRandomValues) crypto.getRandomValues(words);
    else { words[0] = Math.floor(Math.random() * 0xffffffff); words[1] = Math.floor(Math.random() * 0xffffffff); }
    const seed = (BigInt(words[0]) << 32n) | BigInt(words[1]); els.seed.value = seed.toString(); els.seed.focus();
  });
  els.version.addEventListener('change', () => { state.requestedVersion = els.version.value; showToast(`Target version set to ${els.version.value}. The current structure provider may not apply it.`); });
  els.gridToggle.addEventListener('change', () => { state.showGrid = els.gridToggle.checked; drawMap(); });
  els.structuresToggle.addEventListener('change', () => { state.showStructures = els.structuresToggle.checked; drawMap(); });
  els.resetView.addEventListener('click', () => { state.viewCenter = { ...state.scanCenter }; state.zoom = 1; updateZoomLabel(); drawMap(); });
  els.centerMap.addEventListener('click', () => { state.viewCenter = { ...state.scanCenter }; state.zoom = 1; updateZoomLabel(); drawMap(); });
  els.useClickedCoords.addEventListener('click', () => {
    if (!state.clickedPoint) return; els.x.value = String(state.clickedPoint.x); els.z.value = String(state.clickedPoint.z);
    state.scanCenter = { ...state.clickedPoint }; state.viewCenter = { ...state.clickedPoint };
    els.subtitle.textContent = `Center: X ${formatInteger(state.scanCenter.x)} · Z ${formatInteger(state.scanCenter.z)}`;
    els.clickedCoordinate.hidden = true; drawMap(); showToast('Search center updated. Scan again to find nearby structures.');
  });
  els.shareLink.addEventListener('click', async () => { try { await copyText(buildShareUrl(readSettings()), 'Share link copied.'); } catch (error) { showToast(error.message); } });
  els.canvas.addEventListener('pointerdown', handleCanvasPointerDown); els.canvas.addEventListener('pointermove', handleCanvasPointerMove);
  els.canvas.addEventListener('pointerup', event => handleCanvasPointerUp(event, false));
  els.canvas.addEventListener('pointercancel', event => handleCanvasPointerUp(event, true));
  els.canvas.addEventListener('wheel', handleWheel, { passive: false });
  window.addEventListener('resize', resizeCanvas);
  if ('ResizeObserver' in window) new ResizeObserver(resizeCanvas).observe(els.stage);
}

buildStructureOptions(); initializeFromUrl(); bindEvents(); resizeCanvas(); updateZoomLabel(); renderResults();
