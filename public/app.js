// OneCal - Core Application Logic & Preparation Heatmap Engine

// ==========================================
// STATE MANAGEMENT
// ==========================================
const state = {
  events: [],
  selectedVertical: 'ALL',
  selectedFY: 'FY26',
  activeTab: 'calendar',
  calendarMode: 'month',
  currentDate: new Date(2026, 8, 28), // Default anchor to current context (Sep 28, 2026)
  activeEventId: null,
  currentUser: { id: 'demo-user-1', email: 'alastair@orchard.it', username: 'Alastair Orchard' },
  supabase: null,
  map: null,
  markers: [],
  charts: {},
  mediaRecorder: null,
  audioChunks: [],
  recordingInterval: null,
  recordingSeconds: 0
};

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  loadLocalOrSampleData();
  initSupabaseIfConfigured();
  updateUserDisplay();
  renderAllViews();
});

function loadLocalOrSampleData() {
  const saved = localStorage.getItem('onecal_events_data');
  if (saved) {
    try {
      state.events = JSON.parse(saved);
    } catch (e) {
      state.events = window.ONECAL_SAMPLE_EVENTS || [];
    }
  } else {
    state.events = window.ONECAL_SAMPLE_EVENTS || [];
    saveLocalData();
  }
}

function saveLocalData() {
  localStorage.setItem('onecal_events_data', JSON.stringify(state.events));
}

function updateUserDisplay() {
  const el = document.getElementById('user-display-name');
  if (el) {
    el.textContent = state.currentUser ? (state.currentUser.username || state.currentUser.email) : 'Guest';
  }
}

// ==========================================
// FILTERING (VERTICAL & FISCAL YEAR)
// ==========================================
function getFilteredEvents() {
  return state.events.filter(evt => {
    // FY Filter
    if (state.selectedFY !== 'ALL') {
      const evtFy = evt.fiscal_year || getFYFromDate(new Date(evt.start_date));
      if (evtFy !== state.selectedFY) return false;
    }
    // Vertical Filter
    if (state.selectedVertical !== 'ALL') {
      if (evt.vertical !== state.selectedVertical) return false;
    }
    return true;
  });
}

function getFYFromDate(d) {
  const yr = d.getFullYear() % 100;
  // Fiscal year standard: Oct 1 - Sep 30
  const m = d.getMonth();
  return m >= 9 ? `FY${yr + 1}` : `FY${yr}`;
}

function handleVerticalChange(val) {
  state.selectedVertical = val;
  renderAllViews();
}

function handleFyChange(val) {
  state.selectedFY = val;
  const kpiFy = document.getElementById('kpi-fy-label');
  if (kpiFy) kpiFy.textContent = val === 'ALL' ? 'All Fiscal Years' : `${val} Horizon`;
  renderAllViews();
}

// ==========================================
// NAVIGATION & TABS
// ==========================================
function switchTab(tabId) {
  state.activeTab = tabId;
  const tabs = ['calendar', 'radar', 'map', 'gallery', 'kpis', 'diary'];

  tabs.forEach(t => {
    const sec = document.getElementById(`view-${t}`);
    const btn = document.getElementById(`tab-btn-${t}`);
    if (sec) sec.classList.toggle('hidden', t !== tabId);
    if (btn) {
      if (t === tabId) {
        btn.className = 'tab-btn px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 bg-purple-600/20 text-purple-300 border border-purple-500/30';
      } else {
        btn.className = 'tab-btn px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 text-slate-400 hover:text-slate-200';
      }
    }
  });

  if (tabId === 'calendar') renderCalendar();
  if (tabId === 'radar') renderPrepRadar();
  if (tabId === 'map') initOrRefreshMap();
  if (tabId === 'gallery') renderGallery();
  if (tabId === 'kpis') renderKPIs();
  if (tabId === 'diary') renderDiaryPreview();
}

function renderAllViews() {
  if (state.activeTab === 'calendar') renderCalendar();
  if (state.activeTab === 'radar') renderPrepRadar();
  if (state.activeTab === 'map') initOrRefreshMap();
  if (state.activeTab === 'gallery') renderGallery();
  if (state.activeTab === 'kpis') renderKPIs();
  if (state.activeTab === 'diary') renderDiaryPreview();
}

// ==========================================
// PREPARATION HEAT ENGINE
// ==========================================
function getPrepIntensityForDate(dateObj, event) {
  const evtDate = new Date(event.start_date);
  evtDate.setHours(0, 0, 0, 0);
  const targetDate = new Date(dateObj);
  targetDate.setHours(0, 0, 0, 0);

  const diffMs = evtDate - targetDate;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const prepDays = Number(event.prep_days) || 0;

  if (diffDays === 0) {
    return { active: true, intensity: 'event', label: 'Event Day', daysRemaining: 0, class: 'prep-intensity-event' };
  }

  if (diffDays > 0 && diffDays <= prepDays) {
    if (diffDays <= 3) {
      return { active: true, intensity: 4, label: `Crunch (T-${diffDays}d)`, daysRemaining: diffDays, class: 'prep-intensity-4' };
    } else if (diffDays <= 7) {
      return { active: true, intensity: 3, label: `High (T-${diffDays}d)`, daysRemaining: diffDays, class: 'prep-intensity-3' };
    } else if (diffDays <= 14) {
      return { active: true, intensity: 2, label: `Active (T-${diffDays}d)`, daysRemaining: diffDays, class: 'prep-intensity-2' };
    } else {
      return { active: true, intensity: 1, label: `Initial (T-${diffDays}d)`, daysRemaining: diffDays, class: 'prep-intensity-1' };
    }
  }

  return { active: false, intensity: 0, daysRemaining: diffDays };
}

// ==========================================
// CALENDAR VIEW & MODES
// ==========================================
function setCalendarMode(mode) {
  state.calendarMode = mode;
  ['day', 'week', 'month', 'year'].forEach(m => {
    const btn = document.getElementById(`cal-mode-${m}`);
    if (btn) {
      if (m === mode) {
        btn.className = 'px-3 py-1 rounded-lg text-xs font-bold bg-purple-600 text-white shadow transition';
      } else {
        btn.className = 'px-3 py-1 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition';
      }
    }
  });
  renderCalendar();
}

function navigateCalendar(delta) {
  const d = new Date(state.currentDate);
  if (state.calendarMode === 'month') {
    d.setMonth(d.getMonth() + delta);
  } else if (state.calendarMode === 'week') {
    d.setDate(d.getDate() + (delta * 7));
  } else if (state.calendarMode === 'day') {
    d.setDate(d.getDate() + delta);
  } else if (state.calendarMode === 'year') {
    d.setFullYear(d.getFullYear() + delta);
  }
  state.currentDate = d;
  renderCalendar();
}

function goToToday() {
  state.currentDate = new Date(2026, 8, 28);
  renderCalendar();
}

function renderCalendar() {
  const labelEl = document.getElementById('calendar-period-label');
  const container = document.getElementById('calendar-grid-container');
  if (!container) return;

  const filteredEvents = getFilteredEvents();
  const yr = state.currentDate.getFullYear();
  const mo = state.currentDate.getMonth();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  if (labelEl) {
    if (state.calendarMode === 'month') {
      labelEl.textContent = `${monthNames[mo]} ${yr}`;
    } else if (state.calendarMode === 'year') {
      labelEl.textContent = `Year ${yr}`;
    } else if (state.calendarMode === 'week') {
      labelEl.textContent = `Week of ${state.currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else {
      labelEl.textContent = state.currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    }
  }

  if (state.calendarMode === 'month') {
    renderMonthCalendar(container, yr, mo, filteredEvents);
  } else if (state.calendarMode === 'week') {
    renderWeekCalendar(container, state.currentDate, filteredEvents);
  } else if (state.calendarMode === 'day') {
    renderDayCalendar(container, state.currentDate, filteredEvents);
  } else if (state.calendarMode === 'year') {
    renderYearCalendar(container, yr, filteredEvents);
  }
}

function renderMonthCalendar(container, year, month, events) {
  const firstDay = new Date(year, month, 1).getDay(); // 0 is Sun
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let html = `<div class="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
    ${daysOfWeek.map(d => `<div>${d}</div>`).join('')}
  </div>
  <div class="grid grid-cols-7 gap-2">`;

  // Previous month trailing days
  for (let i = firstDay - 1; i >= 0; i--) {
    const dayNum = prevMonthTotalDays - i;
    html += `<div class="cal-day-cell cal-day-other-month p-2 rounded-xl flex flex-col justify-between">
      <span class="text-xs text-slate-600 font-semibold">${dayNum}</span>
    </div>`;
  }

  // Current month days
  const today = new Date();
  for (let day = 1; day <= totalDays; day++) {
    const thisDate = new Date(year, month, day);
    const isToday = thisDate.toDateString() === today.toDateString();
    
    // Find active events and preps for this date
    let dayPills = [];
    events.forEach(evt => {
      const heat = getPrepIntensityForDate(thisDate, evt);
      if (heat.active) {
        dayPills.push({
          event: evt,
          heat: heat
        });
      }
    });

    html += `<div class="cal-day-cell p-2 rounded-xl flex flex-col justify-between cursor-pointer ${isToday ? 'cal-day-today' : ''}" onclick="openDayDetailModal('${thisDate.toISOString()}')">
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs font-bold ${isToday ? 'text-purple-400' : 'text-slate-300'}">${day}</span>
        ${dayPills.length > 0 ? `<span class="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400">${dayPills.length}</span>` : ''}
      </div>

      <div class="space-y-1.5 overflow-hidden flex-1">
        ${dayPills.slice(0, 3).map(p => {
          return `<div onclick="event.stopPropagation(); openEventModal('${p.event.id}')" class="text-[10px] font-bold p-1 rounded-lg truncate cursor-pointer transition hover:scale-[1.02] ${p.heat.class}">
            ${p.heat.intensity === 'event' ? '🗓️ ' : '⚡ '}${escapeHtml(p.event.name)}
          </div>`;
        }).join('')}
        ${dayPills.length > 3 ? `<div class="text-[9px] text-slate-500 font-semibold text-center">+${dayPills.length - 3} more</div>` : ''}
      </div>
    </div>`;
  }

  // Next month leading days to complete grid
  const remainingCells = 42 - (firstDay + totalDays);
  if (remainingCells > 0 && remainingCells < 7) {
    for (let day = 1; day <= remainingCells; day++) {
      html += `<div class="cal-day-cell cal-day-other-month p-2 rounded-xl flex flex-col justify-between">
        <span class="text-xs text-slate-600 font-semibold">${day}</span>
      </div>`;
    }
  }

  html += `</div>`;
  container.innerHTML = html;
}

function renderWeekCalendar(container, currDate, events) {
  const start = new Date(currDate);
  start.setDate(start.getDate() - start.getDay()); // Sunday

  let html = `<div class="grid grid-cols-7 gap-3 min-h-[480px]">`;
  for (let i = 0; i < 7; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);

    let dayEvents = [];
    events.forEach(evt => {
      const heat = getPrepIntensityForDate(day, evt);
      if (heat.active) {
        dayEvents.push({ event: evt, heat });
      }
    });

    html += `<div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 flex flex-col space-y-2">
      <div class="border-b border-slate-800 pb-2 text-center">
        <div class="text-xs text-slate-400 font-bold uppercase">${day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
        <div class="text-lg font-extrabold text-white">${day.getDate()}</div>
      </div>
      <div class="flex-1 space-y-2 overflow-y-auto">
        ${dayEvents.map(p => `
          <div onclick="openEventModal('${p.event.id}')" class="p-2.5 rounded-xl border text-xs cursor-pointer transition hover:shadow-lg ${p.heat.class}">
            <div class="font-bold truncate">${escapeHtml(p.event.name)}</div>
            <div class="text-[10px] opacity-80 mt-1 flex justify-between">
              <span>${p.heat.label}</span>
              <span>📍 ${escapeHtml(p.event.location_region)}</span>
            </div>
          </div>
        `).join('')}
        ${dayEvents.length === 0 ? '<div class="text-[11px] text-slate-600 text-center py-6">No prep / event</div>' : ''}
      </div>
    </div>`;
  }
  html += `</div>`;
  container.innerHTML = html;
}

function renderDayCalendar(container, currDate, events) {
  const activeEvents = [];
  events.forEach(evt => {
    const heat = getPrepIntensityForDate(currDate, evt);
    if (heat.active) {
      activeEvents.push({ event: evt, heat });
    }
  });

  let html = `<div class="max-w-3xl mx-auto space-y-4">
    <div class="text-center pb-4 border-b border-slate-800">
      <div class="text-xs font-bold text-purple-400 uppercase tracking-widest">Daily Preparation & Agenda</div>
      <h3 class="font-serif text-3xl font-bold text-white mt-1">${currDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h3>
      <p class="text-xs text-slate-400 mt-1">${activeEvents.length} items requiring team action or event presence.</p>
    </div>
    <div class="space-y-3">
      ${activeEvents.map(p => `
        <div onclick="openEventModal('${p.event.id}')" class="p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition hover:scale-[1.01] ${p.heat.class}">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold uppercase px-2 py-0.5 rounded bg-slate-900/80 text-white">${p.event.vertical}</span>
              <span class="text-xs text-slate-300">📍 ${escapeHtml(p.event.city_venue || p.event.location_region)}</span>
            </div>
            <h4 class="font-serif text-lg font-bold text-white mt-1">${escapeHtml(p.event.name)}</h4>
            <p class="text-xs opacity-90 line-clamp-1 mt-0.5">${escapeHtml(p.event.description)}</p>
          </div>
          <div class="text-right">
            <span class="px-3 py-1 rounded-xl text-xs font-black bg-slate-900/90 text-white border border-slate-700">${p.heat.label}</span>
          </div>
        </div>
      `).join('')}
      ${activeEvents.length === 0 ? '<div class="text-center py-16 text-slate-500 font-semibold">No active preparation windows or events scheduled for this day.</div>' : ''}
    </div>
  </div>`;
  container.innerHTML = html;
}

function renderYearCalendar(container, year, events) {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let html = `<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">`;

  monthNames.forEach((mName, mIdx) => {
    const monthEvents = events.filter(e => new Date(e.start_date).getMonth() === mIdx && new Date(e.start_date).getFullYear() === year);
    html += `<div class="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 hover:border-purple-500/40 transition">
      <div class="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
        <span class="font-serif font-bold text-white text-base">${mName} ${year}</span>
        <span class="text-xs font-bold text-purple-400">${monthEvents.length} events</span>
      </div>
      <div class="space-y-1.5 max-h-44 overflow-y-auto">
        ${monthEvents.map(e => `
          <div onclick="openEventModal('${e.id}')" class="text-[11px] font-semibold p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 truncate cursor-pointer transition">
            🗓️ ${escapeHtml(e.name)}
          </div>
        `).join('')}
        ${monthEvents.length === 0 ? '<div class="text-[10px] text-slate-600 text-center py-4">No events</div>' : ''}
      </div>
    </div>`;
  });

  html += `</div>`;
  container.innerHTML = html;
}

// ==========================================
// PREPARATION RADAR VIEW
// ==========================================
function renderPrepRadar() {
  const listEl = document.getElementById('radar-cards-list');
  const dateEl = document.getElementById('radar-today-date');
  if (!listEl) return;

  const today = state.currentDate;
  if (dateEl) dateEl.textContent = `Target Date: ${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const filteredEvents = getFilteredEvents();
  const radarItems = [];

  filteredEvents.forEach(evt => {
    const heat = getPrepIntensityForDate(today, evt);
    if (heat.active) {
      radarItems.push({ event: evt, heat });
    }
  });

  // Sort by crunch intensity (most critical first)
  radarItems.sort((a, b) => (b.heat.intensity === 'event' ? 5 : b.heat.intensity) - (a.heat.intensity === 'event' ? 5 : a.heat.intensity));

  if (radarItems.length === 0) {
    listEl.innerHTML = `<div class="col-span-full text-center py-16 bg-slate-900/50 rounded-2xl border border-slate-800 text-slate-500 font-semibold">
      ⚡ All clear! No events in active preparation for ${today.toLocaleDateString()}.
    </div>`;
    return;
  }

  listEl.innerHTML = radarItems.map(item => {
    const evt = item.event;
    const heat = item.heat;
    return `
      <div onclick="openEventModal('${evt.id}')" class="bg-slate-900/90 border border-slate-800 hover:border-purple-500/50 p-5 rounded-2xl shadow-xl flex flex-col justify-between cursor-pointer transition hover:-translate-y-1">
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-900/50 text-purple-300 border border-purple-700/50">
              ${escapeHtml(evt.vertical)}
            </span>
            <span class="px-3 py-1 rounded-xl text-xs font-black shadow ${heat.class}">
              ${heat.label}
            </span>
          </div>

          <div>
            <h3 class="font-serif text-lg font-bold text-white line-clamp-1">${escapeHtml(evt.name)}</h3>
            <div class="text-xs text-slate-400 mt-1 flex items-center gap-2">
              <span>📍 ${escapeHtml(evt.city_venue || evt.location_region)}</span>
              <span>•</span>
              <span>${formatDate(evt.start_date)}</span>
            </div>
          </div>

          <p class="text-xs text-slate-300 line-clamp-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
            ${escapeHtml(evt.description || 'No overview provided.')}
          </p>
        </div>

        <div class="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Allocated Prep: <strong>${evt.prep_days} days</strong></span>
          <span class="font-bold text-purple-400 hover:text-purple-300">View Event & Team Notes ›</span>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// INTERACTIVE MAP VIEW (LEAFLET)
// ==========================================
function initOrRefreshMap() {
  const mapContainer = document.getElementById('events-map');
  if (!mapContainer) return;

  if (!state.map) {
    state.map = L.map('events-map').setView([35.0, 10.0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(state.map);
  }

  // Clear existing markers
  state.markers.forEach(m => state.map.removeLayer(m));
  state.markers = [];

  const filteredEvents = getFilteredEvents().filter(e => e.lat && e.lng);
  
  filteredEvents.forEach(evt => {
    const marker = L.circleMarker([evt.lat, evt.lng], {
      radius: 9,
      fillColor: '#8b5cf6',
      color: '#ffffff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9
    }).addTo(state.map);

    const popupHtml = `
      <div style="font-family:sans-serif; min-width:190px; color:#0f172a; padding:4px;">
        <div style="font-size:10px; font-weight:800; text-transform:uppercase; color:#6d28d9;">${escapeHtml(evt.vertical)}</div>
        <div style="font-size:14px; font-weight:800; margin:3px 0; color:#0f172a;">${escapeHtml(evt.name)}</div>
        <div style="font-size:11px; color:#475569; margin-bottom:8px;">📍 ${escapeHtml(evt.city_venue || evt.location_region)}</div>
        <button onclick="openEventModal('${evt.id}')" style="background:#7c3aed; color:#fff; font-size:11px; font-weight:700; border:none; padding:4px 10px; border-radius:6px; cursor:pointer; width:100%;">
          Open Event Details
        </button>
      </div>
    `;
    marker.bindPopup(popupHtml);
    state.markers.push(marker);
  });

  setTimeout(() => state.map.invalidateSize(), 200);
}

function filterMapRegion(reg) {
  if (!state.map) return;
  const regionCoords = {
    'ALL': [35.0, 10.0, 2],
    'EMEA': [48.0, 15.0, 4],
    'Germany': [51.1657, 10.4515, 6],
    'Americas': [37.0902, -95.7129, 4],
    'APAC': [1.3521, 103.8198, 4]
  };
  const target = regionCoords[reg] || regionCoords['ALL'];
  state.map.setView([target[0], target[1]], target[2]);
}

// ==========================================
// GALLERY VIEW
// ==========================================
function renderGallery() {
  const container = document.getElementById('gallery-grid');
  if (!container) return;

  const filteredEvents = getFilteredEvents();
  const galleryItems = [];

  filteredEvents.forEach(evt => {
    if (evt.photos && evt.photos.length > 0) {
      evt.photos.forEach(photoUrl => {
        galleryItems.push({ event: evt, photo: photoUrl });
      });
    }
  });

  if (galleryItems.length === 0) {
    container.innerHTML = `<div class="col-span-full text-center py-16 bg-slate-900/50 rounded-2xl border border-slate-800 text-slate-500 font-semibold">
      🖼️ No photos uploaded yet for this filter. Open an event to upload media!
    </div>`;
    return;
  }

  container.innerHTML = galleryItems.map(item => `
    <div onclick="openEventModal('${item.event.id}')" class="bg-slate-900 border border-slate-800 hover:border-purple-500/50 rounded-2xl overflow-hidden shadow-xl cursor-pointer transition hover:scale-[1.02] group">
      <div class="h-56 overflow-hidden bg-slate-950">
        <img src="${escapeHtml(item.photo)}" alt="${escapeHtml(item.event.name)}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
      </div>
      <div class="p-4 space-y-1">
        <div class="flex items-center justify-between text-[11px]">
          <span class="text-purple-400 font-bold uppercase">${escapeHtml(item.event.vertical)}</span>
          <span class="text-slate-500">${formatDate(item.event.start_date)}</span>
        </div>
        <h4 class="font-serif text-base font-bold text-white truncate">${escapeHtml(item.event.name)}</h4>
        <div class="text-xs text-slate-400 truncate">📍 ${escapeHtml(item.event.city_venue || item.event.location_region)}</div>
      </div>
    </div>
  `).join('');
}

// ==========================================
// KPIS & ANALYTICS DASHBOARD
// ==========================================
function renderKPIs() {
  const filteredEvents = getFilteredEvents();
  const total = filteredEvents.length;
  const now = new Date();

  const upcoming = filteredEvents.filter(e => new Date(e.start_date) > now).length;
  const past = filteredEvents.filter(e => new Date(e.start_date) <= now).length;
  const inPrep = filteredEvents.filter(e => getPrepIntensityForDate(now, e).active).length;

  document.getElementById('kpi-total-events').textContent = total;
  document.getElementById('kpi-upcoming-events').textContent = upcoming;
  document.getElementById('kpi-prep-events').textContent = inPrep;
  document.getElementById('kpi-past-events').textContent = past;

  // Chart 1: Verticals
  const verticalCounts = {};
  filteredEvents.forEach(e => {
    verticalCounts[e.vertical] = (verticalCounts[e.vertical] || 0) + 1;
  });

  const ctxVert = document.getElementById('chart-verticals');
  if (ctxVert) {
    if (state.charts.verticals) state.charts.verticals.destroy();
    state.charts.verticals = new Chart(ctxVert, {
      type: 'doughnut',
      data: {
        labels: Object.keys(verticalCounts),
        datasets: [{
          data: Object.values(verticalCounts),
          backgroundColor: ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#06b6d4', '#64748b'],
          borderColor: '#111622',
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 10 } } }
        }
      }
    });
  }

  // Chart 2: Regions
  const regionCounts = {};
  filteredEvents.forEach(e => {
    regionCounts[e.location_region] = (regionCounts[e.location_region] || 0) + 1;
  });

  const ctxReg = document.getElementById('chart-regions');
  if (ctxReg) {
    if (state.charts.regions) state.charts.regions.destroy();
    state.charts.regions = new Chart(ctxReg, {
      type: 'bar',
      data: {
        labels: Object.keys(regionCounts),
        datasets: [{
          label: 'Events Count',
          data: Object.values(regionCounts),
          backgroundColor: '#6366f1',
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
          y: { ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: 'rgba(148, 163, 184, 0.1)' } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }
}

// ==========================================
// EXECUTIVE DIARY & MULTI-PAGE PRINT
// ==========================================
function renderDiaryPreview() {
  const container = document.getElementById('diary-preview-container');
  if (!container) return;

  const sortedEvents = [...getFilteredEvents()].sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

  if (sortedEvents.length === 0) {
    container.innerHTML = `<div class="text-center py-16 text-slate-500 font-semibold">No events to display in diary.</div>`;
    return;
  }

  container.innerHTML = sortedEvents.map((evt, idx) => `
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <span class="text-xs font-bold text-purple-400 uppercase tracking-wider">#${idx + 1} — ${formatDate(evt.start_date)}</span>
        <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-indigo-300 border border-slate-700">${escapeHtml(evt.vertical)}</span>
      </div>
      <div>
        <h3 class="font-serif text-2xl font-bold text-white">${escapeHtml(evt.name)}</h3>
        <div class="text-xs text-slate-400 mt-1">📍 ${escapeHtml(evt.city_venue || evt.location_region)} • Format: ${escapeHtml(evt.mode)} • Allocated Prep: ${evt.prep_days} days</div>
      </div>
      <p class="text-xs text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800/80">
        "${escapeHtml(evt.description || 'No overview notes.')}"
      </p>
    </div>
  `).join('');
}

function exportOneCalDiaryPDF() {
  const sortedEvents = [...getFilteredEvents()].sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
  if (sortedEvents.length === 0) {
    showToast('No events to export.', 'info');
    return;
  }

  showToast('Generating printable multi-page diary...', 'info');

  const userLabel = state.currentUser ? (state.currentUser.username || state.currentUser.email) : 'OneCal Team';
  const total = sortedEvents.length;
  const fyLabel = state.selectedFY;

  const entriesHtml = sortedEvents.map((evt, idx) => {
    let photosMarkup = '';
    if (evt.photos && evt.photos.length > 0) {
      photosMarkup = `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(160px, 1fr)); gap:10px; margin:12px 0;">
        ${evt.photos.map(p => `<img src="${escapeHtml(p)}" style="width:100%; height:130px; object-fit:cover; border-radius:10px; border:1px solid #e2e8f0;">`).join('')}
      </div>`;
    }

    return `
      <article style="border:1px solid #e2e8f0; border-radius:16px; padding:22px; margin-bottom:24px; background:#ffffff; page-break-inside:avoid; break-inside:avoid;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #f1f5f9; padding-bottom:8px; margin-bottom:10px;">
          <span style="font-size:11px; font-weight:800; color:#7c3aed; text-transform:uppercase; letter-spacing:0.05em;">#${idx + 1} — ${formatDate(evt.start_date)}</span>
          <span style="font-size:11px; font-weight:700; background:#ede9fe; color:#6d28d9; padding:2px 10px; border-radius:999px;">${escapeHtml(evt.vertical)}</span>
        </div>
        <h2 style="font-family:'Playfair Display', Georgia, serif; font-size:22px; font-weight:700; color:#0f172a; margin:0 0 4px 0;">${escapeHtml(evt.name)}</h2>
        <div style="font-size:12px; color:#475569; font-weight:600; margin-bottom:12px;">
          📍 ${escapeHtml(evt.city_venue || evt.location_region)} • Type: ${escapeHtml(evt.event_type)} • Scope: ${escapeHtml(evt.scope)} • Prep Window: ${evt.prep_days} days
        </div>
        ${photosMarkup}
        <div style="font-family:Georgia, serif; font-style:italic; font-size:13px; line-height:1.6; color:#334155; background:#f8fafc; padding:12px 16px; border-radius:10px; border-left:4px solid #7c3aed;">
          "${escapeHtml(evt.description || 'No strategic description.')}"
        </div>
      </article>
    `;
  }).join('\n');

  const printHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>OneCal — Executive Strategy & Event Diary (${escapeHtml(fyLabel)})</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    * { box-sizing: border-box; }
    @page { margin: 15mm 12mm 15mm 12mm; size: auto; }
    body {
      background: #ffffff; color: #0f172a;
      font-family: 'Plus Jakarta Sans', sans-serif;
      margin: 0; padding: 0; line-height: 1.5;
      -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
    }
    @media screen {
      body { background: #090b10; padding: 24px 16px 60px 16px; }
      .wrapper { max-width: 820px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 24px; }
      .action-bar { max-width: 820px; margin: 0 auto 16px auto; display: flex; justify-content: space-between; padding: 12px 18px; background: #111622; border-radius: 16px; }
    }
    @media print {
      .wrapper { width: 100% !important; padding: 0 !important; }
      .action-bar { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="action-bar">
    <button onclick="window.print()" style="background:#7c3aed; color:#fff; font-weight:700; font-size:13px; padding:8px 18px; border:none; border-radius:10px; cursor:pointer;">
      🖨️ Print / Save to PDF
    </button>
    <div style="font-size:12px; color:#94a3b8; align-self:center;">Select <strong>"Save as PDF"</strong> in printer sheet</div>
  </div>
  <div class="wrapper">
    <header style="border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 28px;">
      <div style="font-size: 28px; font-weight: 900; color: #7c3aed;">OneCal</div>
      <h1 style="font-family: 'Playfair Display', Georgia, serif; font-size: 32px; font-weight: 700; margin: 2px 0 6px 0;">Executive Strategy & Event Diary</h1>
      <div style="font-size: 13px; color: #64748b;">Fiscal Year: <strong>${escapeHtml(fyLabel)}</strong> • Published for <strong>${escapeHtml(userLabel)}</strong></div>
    </header>
    <main>${entriesHtml}</main>
  </div>
  <script>window.addEventListener('DOMContentLoaded', () => setTimeout(() => window.print(), 600));</script>
</body>
</html>`;

  const blob = new Blob([printHtml], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  const printWindow = window.open(blobUrl, '_blank');
  if (!printWindow) window.location.href = blobUrl;
}

// ==========================================
// EVENT MODAL & DETAILS
// ==========================================
function openEventModal(eventId) {
  const evt = state.events.find(e => e.id === eventId);
  if (!evt) return;

  state.activeEventId = eventId;
  const modal = document.getElementById('modal-event');
  if (!modal) return;

  document.getElementById('modal-event-title').textContent = evt.name;
  document.getElementById('modal-event-type-badge').textContent = evt.event_type;
  document.getElementById('modal-event-privacy-badge').textContent = evt.privacy === 'private' ? '🔒 Private' : '🌐 Shared';
  document.getElementById('modal-event-date').textContent = `${formatDate(evt.start_date)} ${evt.end_date ? '– ' + formatDate(evt.end_date) : ''}`;
  document.getElementById('modal-event-location').textContent = `📍 ${evt.city_venue || evt.location_region}`;
  document.getElementById('modal-event-vertical').textContent = evt.vertical;
  document.getElementById('modal-event-desc').textContent = evt.description || 'No strategic description provided.';

  // Preparation Banner
  const heat = getPrepIntensityForDate(state.currentDate, evt);
  const prepBanner = document.getElementById('modal-prep-banner');
  const prepStatus = document.getElementById('modal-prep-status');
  const prepDesc = document.getElementById('modal-prep-desc');
  const prepBadge = document.getElementById('modal-prep-days-badge');

  if (heat.active) {
    prepBanner.className = `p-4 rounded-xl border flex items-center justify-between ${heat.class}`;
    prepStatus.textContent = `⚡ Preparation Window Active (${heat.label})`;
    prepDesc.textContent = `${evt.prep_days} total preparation days allocated before kickoff.`;
    prepBadge.textContent = heat.intensity === 'event' ? 'TODAY' : `T-${heat.daysRemaining}d`;
  } else {
    prepBanner.className = 'p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center justify-between text-slate-400';
    prepStatus.textContent = `Preparation Window: ${evt.prep_days} Days`;
    prepDesc.textContent = `Scheduled to kickoff ${formatDate(evt.start_date)}.`;
    prepBadge.textContent = `${evt.prep_days}d`;
  }

  // URL & Thumbnail
  const urlContainer = document.getElementById('modal-url-container');
  if (evt.url) {
    urlContainer.classList.remove('hidden');
    document.getElementById('modal-url-link').href = evt.url;
    document.getElementById('modal-url-title').textContent = evt.name;
    document.getElementById('modal-url-text').textContent = evt.url;
    document.getElementById('modal-url-thumb').src = evt.url_thumbnail || 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=300&q=80';
  } else {
    urlContainer.classList.add('hidden');
  }

  // Photos
  const photosContainer = document.getElementById('modal-photos-container');
  const photosGrid = document.getElementById('modal-photos-grid');
  if (evt.photos && evt.photos.length > 0) {
    photosContainer.classList.remove('hidden');
    photosGrid.innerHTML = evt.photos.map(p => `
      <img src="${escapeHtml(p)}" class="w-full h-24 object-cover rounded-xl border border-slate-700">
    `).join('');
  } else {
    photosContainer.classList.add('hidden');
  }

  // Comments
  renderModalComments(evt);

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeEventModal() {
  const modal = document.getElementById('modal-event');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
  state.activeEventId = null;
}

function renderModalComments(evt) {
  const listEl = document.getElementById('modal-comments-list');
  const countEl = document.getElementById('modal-comments-count');
  const comments = evt.comments || [];

  if (countEl) countEl.textContent = `${comments.length} entries`;
  if (!listEl) return;

  if (comments.length === 0) {
    listEl.innerHTML = `<div class="text-xs text-slate-500 italic text-center py-2">No team comments yet. Be the first to leave a note!</div>`;
    return;
  }

  listEl.innerHTML = comments.map(c => `
    <div class="bg-slate-900/90 border border-slate-800 p-3 rounded-xl space-y-1">
      <div class="flex items-center justify-between text-[11px]">
        <span class="font-bold text-purple-300">${escapeHtml(c.user || 'Team Member')}</span>
        <span class="text-slate-500">${c.time ? formatDate(c.time) : ''}</span>
      </div>
      <p class="text-xs text-slate-300">${escapeHtml(c.text)}</p>
    </div>
  `).join('');
}

function submitNewComment() {
  if (!state.activeEventId) return;
  const input = document.getElementById('input-new-comment');
  const val = input.value.trim();
  if (!val) return;

  const evt = state.events.find(e => e.id === state.activeEventId);
  if (!evt) return;

  if (!evt.comments) evt.comments = [];
  evt.comments.push({
    id: `c_${Date.now()}`,
    user: state.currentUser ? (state.currentUser.username || state.currentUser.email) : 'Team Member',
    text: val,
    time: new Date().toISOString()
  });

  input.value = '';
  saveLocalData();
  syncEventToSupabase(evt);
  renderModalComments(evt);
  showToast('Comment posted.', 'success');
}

// ==========================================
// VOICE RECORDER
// ==========================================
async function toggleVoiceRecording() {
  const dot = document.getElementById('voice-rec-dot');
  const label = document.getElementById('voice-rec-label');
  const timer = document.getElementById('voice-timer');

  if (!state.mediaRecorder || state.mediaRecorder.state === 'inactive') {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      state.mediaRecorder = new MediaRecorder(stream);
      state.audioChunks = [];

      state.mediaRecorder.ondataavailable = e => state.audioChunks.push(e.data);
      state.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(state.audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result;
          if (state.activeEventId) {
            const evt = state.events.find(e => e.id === state.activeEventId);
            if (evt) {
              if (!evt.comments) evt.comments = [];
              evt.comments.push({
                id: `c_voice_${Date.now()}`,
                user: state.currentUser ? state.currentUser.username : 'Team Member',
                text: '🎙️ Attached voice note briefing.',
                time: new Date().toISOString()
              });
              saveLocalData();
              syncEventToSupabase(evt);
              renderModalComments(evt);
              showToast('Voice note attached to event!', 'success');
            }
          }
        };
      };

      state.mediaRecorder.start();
      state.recordingSeconds = 0;
      dot.className = 'w-2 h-2 rounded-full bg-rose-500 animate-ping';
      label.textContent = 'Stop Recording';
      timer.classList.remove('hidden');

      state.recordingInterval = setInterval(() => {
        state.recordingSeconds++;
        const mins = String(Math.floor(state.recordingSeconds / 60)).padStart(2, '0');
        const secs = String(state.recordingSeconds % 60).padStart(2, '0');
        timer.textContent = `${mins}:${secs}`;
      }, 1000);

    } catch (err) {
      showToast('Microphone access denied.', 'error');
    }
  } else {
    state.mediaRecorder.stop();
    clearInterval(state.recordingInterval);
    dot.className = 'w-2 h-2 rounded-full bg-rose-500';
    label.textContent = 'Record Voice Note';
    timer.classList.add('hidden');
  }
}

// ==========================================
// PHOTO UPLOAD
// ==========================================
function handlePhotoUpload(e) {
  const file = e.target.files[0];
  if (!file || !state.activeEventId) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    const base64 = evt.target.result;
    const currentEvt = state.events.find(ev => ev.id === state.activeEventId);
    if (currentEvt) {
      if (!currentEvt.photos) currentEvt.photos = [];
      currentEvt.photos.push(base64);
      saveLocalData();
      syncEventToSupabase(currentEvt);
      openEventModal(state.activeEventId);
      showToast('Photo uploaded successfully!', 'success');
    }
  };
  reader.readAsDataURL(file);
}

// ==========================================
// CREATE & DELETE EVENTS
// ==========================================
function openNewEventModal() {
  const modal = document.getElementById('modal-create-event');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    const startInput = document.getElementById('form-evt-start');
    if (startInput) {
      const now = new Date();
      startInput.value = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    }
  }
}

function closeCreateEventModal() {
  const modal = document.getElementById('modal-create-event');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function handleCreateEvent(e) {
  e.preventDefault();

  const name = document.getElementById('form-evt-name').value;
  const start = document.getElementById('form-evt-start').value;
  const end = document.getElementById('form-evt-end').value;
  const type = document.getElementById('form-evt-type').value;
  const vertical = document.getElementById('form-evt-vertical').value;
  const scope = document.getElementById('form-evt-scope').value;
  const mode = document.getElementById('form-evt-mode').value;
  const privacy = document.getElementById('form-evt-privacy').value;
  const region = document.getElementById('form-evt-region').value;
  const prepDays = parseInt(document.getElementById('form-evt-prep').value) || 7;
  const venue = document.getElementById('form-evt-venue').value;
  const url = document.getElementById('form-evt-url').value;
  const desc = document.getElementById('form-evt-desc').value;

  const newEvt = {
    id: `evt_${Date.now()}`,
    user_id: state.currentUser ? state.currentUser.id : 'demo-user-1',
    created_by_name: state.currentUser ? (state.currentUser.username || state.currentUser.email) : 'Alastair Orchard',
    name,
    description: desc,
    start_date: new Date(start).toISOString(),
    end_date: end ? new Date(end).toISOString() : null,
    privacy,
    scope,
    mode,
    location_region: region,
    city_venue: venue,
    lat: getApproxLatForRegion(region),
    lng: getApproxLngForRegion(region),
    event_type: type,
    vertical,
    prep_days: prepDays,
    url,
    url_thumbnail: url ? 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=600&q=80' : null,
    photos: [],
    audio_notes: [],
    comments: [],
    fiscal_year: getFYFromDate(new Date(start))
  };

  state.events.push(newEvt);
  saveLocalData();
  syncEventToSupabase(newEvt);
  closeCreateEventModal();
  renderAllViews();
  showToast('Event created successfully!', 'success');
}

function deleteCurrentEvent() {
  if (!state.activeEventId) return;
  if (!confirm('Are you sure you want to delete this event?')) return;

  state.events = state.events.filter(e => e.id !== state.activeEventId);
  saveLocalData();
  closeEventModal();
  renderAllViews();
  showToast('Event deleted.', 'info');
}

// ==========================================
// SUPABASE SYNC & DATA BACKUPS
// ==========================================
function initSupabaseIfConfigured() {
  const url = localStorage.getItem('onecal_sb_url') || 'https://bfwlzobdpbuippfbbjud.supabase.co';
  const key = localStorage.getItem('onecal_sb_key') || 'sb_publishable_PcDpOFZptvEbE0wL8qDyLA_uqqkkf0A';

  if (url && key && window.supabase) {
    try {
      state.supabase = window.supabase.createClient(url, key);
      fetchEventsFromSupabase();
    } catch (err) {
      console.warn('Supabase client init error:', err);
    }
  }
}

async function fetchEventsFromSupabase() {
  if (!state.supabase) return;
  try {
    const { data, error } = await state.supabase.from('onecal_events').select('*');
    if (!error && data && data.length > 0) {
      state.events = data;
      saveLocalData();
      renderAllViews();
    }
  } catch (err) {
    console.warn('Could not fetch from Supabase:', err);
  }
}

async function syncEventToSupabase(evt) {
  if (!state.supabase) return;
  try {
    await state.supabase.from('onecal_events').upsert([evt]);
  } catch (err) {
    console.warn('Supabase upsert error:', err);
  }
}

function openSettingsModal() {
  const modal = document.getElementById('modal-settings');
  if (modal) {
    document.getElementById('cfg-supabase-url').value = localStorage.getItem('onecal_sb_url') || 'https://bfwlzobdpbuippfbbjud.supabase.co';
    document.getElementById('cfg-supabase-key').value = localStorage.getItem('onecal_sb_key') || 'sb_publishable_PcDpOFZptvEbE0wL8qDyLA_uqqkkf0A';
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeSettingsModal() {
  const modal = document.getElementById('modal-settings');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function saveSupabaseConfig() {
  const url = document.getElementById('cfg-supabase-url').value.trim();
  const key = document.getElementById('cfg-supabase-key').value.trim();
  localStorage.setItem('onecal_sb_url', url);
  localStorage.setItem('onecal_sb_key', key);
  initSupabaseIfConfigured();
  closeSettingsModal();
  showToast('Cloud Sync connected!', 'success');
}

function exportDataJSON() {
  const jsonStr = JSON.stringify(state.events, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `onecal_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  showToast('Backup JSON downloaded!', 'success');
}

function importDataJSON(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const imported = JSON.parse(evt.target.result);
      if (Array.isArray(imported)) {
        state.events = imported;
        saveLocalData();
        renderAllViews();
        closeSettingsModal();
        showToast(`Imported ${imported.length} events successfully!`, 'success');
      }
    } catch (err) {
      showToast('Invalid JSON file.', 'error');
    }
  };
  reader.readAsText(file);
}

function resetToSampleData() {
  if (confirm('Reset calendar to the default example dataset?')) {
    state.events = window.ONECAL_SAMPLE_EVENTS || [];
    saveLocalData();
    renderAllViews();
    closeSettingsModal();
    showToast('Example dataset reloaded.', 'info');
  }
}

// ==========================================
// UTILITY HELPERS
// ==========================================
function formatDate(dStr) {
  if (!dStr) return '';
  const d = new Date(dStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getApproxLatForRegion(reg) {
  const lats = { 'Germany': 51.1657, 'EMEA': 48.8566, 'Americas': 37.7749, 'APAC': 1.3521, 'Global': 40.7128 };
  return lats[reg] || 50.0;
}

function getApproxLngForRegion(reg) {
  const lngs = { 'Germany': 10.4515, 'EMEA': 2.3522, 'Americas': -122.4194, 'APAC': 103.8198, 'Global': -74.0060 };
  return lngs[reg] || 10.0;
}

function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-msg');
  const toastIcon = document.getElementById('toast-icon');
  if (!toast || !toastMsg) return;

  toastMsg.textContent = msg;
  toastIcon.textContent = type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️';
  toast.classList.remove('opacity-0', 'translate-y-20');
  toast.classList.add('opacity-100', 'translate-y-0');

  setTimeout(() => {
    toast.classList.remove('opacity-100', 'translate-y-0');
    toast.classList.add('opacity-0', 'translate-y-20');
  }, 3000);
}
