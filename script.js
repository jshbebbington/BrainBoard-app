// ======= State & Persistence =======
const STORAGE_KEY = 'keepCloneData.v1';
const defaultData = () => ({
  sections: [
    { id: uid(), name: 'Personal' },
    { id: uid(), name: 'Work' },
    { id: uid(), name: 'Ideas' },
    { id: uid(), name: 'To-Do' },
  ],
  notes: []
});

function load(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultData();
    const parsed = JSON.parse(raw);
    if(!parsed || !Array.isArray(parsed.sections) || !Array.isArray(parsed.notes)) return defaultData();
    return parsed;
  }catch(e){ console.warn('Load failed, using defaults', e); return defaultData(); }
}
function save(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = load();

// ======= Utilities =======
function uid(){ return Math.random().toString(36).slice(2, 10); }
function el(html){ const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
function toast(msg){ const t = document.getElementById('toast'); t.textContent = msg; t.style.display='block'; setTimeout(()=> t.style.display='none', 1800); }
function byId(id){ return document.getElementById(id); }
function escapeHtml(str){
  return (str+"")
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

// ======= Rendering =======
const board = byId('board');

function renderSectionPicker(){
  const sel = byId('qSection');
  sel.innerHTML = '';
  state.sections.forEach(s => {
    const opt = document.createElement('option'); opt.value = s.id; opt.textContent = s.name; sel.appendChild(opt);
  });
}

function render(){
  const q = byId('search').value.trim().toLowerCase();
  board.innerHTML = '';
  state.sections.forEach(section => {
    const col = el(`
      <section class="column" data-section="${section.id}" ondragover="event.preventDefault()">
        <header>
          <h3>${section.name}</h3>
          <div class="col-actions">
            <button class="iconbtn" title="Rename">✎</button>
            <button class="iconbtn" title="Delete section">🗑️</button>
          </div>
        </header>
        <div class="notes"></div>
      </section>
    `);
    const notesWrap = col.querySelector('.notes');
    col.addEventListener('drop', e => {
      const noteId = e.dataTransfer.getData('text/note-id');
      if(!noteId) return;
      const note = state.notes.find(n => n.id === noteId);
      if(note){ note.sectionId = section.id; note.updatedAt = Date.now(); save(); render(); }
    });
    col.querySelectorAll('.iconbtn')[0].addEventListener('click', () => {
      const name = prompt('Rename section', section.name);
      if(name && name.trim()){ section.name = name.trim(); save(); render(); renderSectionPicker(); }
    });
    col.querySelectorAll('.iconbtn')[1].addEventListener('click', () => {
      if(!confirm('Delete this section? Notes will be moved to the first section.')) return;
      const first = state.sections[0];
      if(first && first.id !== section.id){
        state.notes.forEach(n => { if(n.sectionId === section.id) n.sectionId = first.id; });
      }
      state.sections = state.sections.filter(s => s.id !== section.id);
      save(); render(); renderSectionPicker();
    });
    const notes = state.notes
      .filter(n => n.sectionId === section.id)
      .filter(n => !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q) || (n.tags||[]).some(t => t.toLowerCase().includes(q)))
      .sort((a,b)=> Number(b.pinned) - Number(a.pinned) || (b.updatedAt||b.createdAt) - (a.updatedAt||a.createdAt));
    notes.forEach(note => notesWrap.appendChild(renderNote(note)));
    board.appendChild(col);
  });
  renderSectionPicker();
}

function renderNote(note){
  const accent = note.color || '#334155';
  const tags = (note.tags || []).map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join('');
  const created = new Date(note.createdAt).toLocaleString();
  const elNote = el(`
    <article class="note" draggable="true" data-note="${note.id}">
      <div class="accent" style="background:${accent}"></div>
      <div class="title">${escapeHtml(note.title || 'Untitled')}</div>
      <div class="content">${escapeHtml(note.body || '')}</div>
      <div class="meta">
        <div class="tags">${tags}</div>
        <div class="btns">
          <button class="iconbtn" title="Pin">${note.pinned ? '📌' : '📍'}</button>
          <button class="iconbtn" title="Edit">✎</button>
          <button class="iconbtn" title="Color">🎨</button>
          <button class="iconbtn" title="Delete">🗑️</button>
        </div>
      </div>
      <small style="color:var(--muted)">Created: ${created}</small>
    </article>
  `);
  elNote.addEventListener('dragstart', e => {
    e.dataTransfer.setData('text/note-id', note.id);
  });
  const [pinBtn, editBtn, colorBtn, delBtn] = elNote.querySelectorAll('.iconbtn');
  pinBtn.addEventListener('click', () => { note.pinned = !note.pinned; note.updatedAt = Date.now(); save(); render(); });
  editBtn.addEventListener('click', () => editNote(note));
  colorBtn.addEventListener('click', async () => {
    const picked = await pickColor(note.color || '#334155');
    if(picked){ note.color = picked; note.updatedAt = Date.now(); save(); render(); }
  });
  delBtn.addEventListener('click', () => {
    if(confirm('Delete this note?')){ state.notes = state.notes.filter(n => n.id !== note.id); save(); render(); }
  });
  return elNote;
}

function editNote(note){
  const title = prompt('Title', note.title || '');
  if(title === null) return;
  const body = prompt('Content', note.body || '');
  if(body === null) return;
  const tagStr = prompt('Tags (comma separated)', (note.tags||[]).join(', '));
  if(tagStr === null) return;
  note.title = title.trim();
  note.body = body.trim();
  note.tags = tagStr.split(',').map(s => s.trim()).filter(Boolean);
  note.updatedAt = Date.now();
  save(); render();
}

function pickColor(current){
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'color';
    input.value = current || '#334155';
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    input.addEventListener('change', ()=>{ resolve(input.value); document.body.removeChild(input); });
    input.click();
  });
}

// ======= Quick Add & Section CRUD =======
byId('addSection').addEventListener('click', () => {
  const name = byId('newSectionName').value.trim();
  if(!name) return toast('Section name required');
  state.sections.push({ id: uid(), name });
  byId('newSectionName').value = '';
  save(); render(); renderSectionPicker(); toast('Section added');
});

byId('addNote').addEventListener('click', () => {
  const title = byId('qTitle').value.trim();
  const body = byId('qBody').value.trim();
  const sectionId = byId('qSection').value || (state.sections[0] && state.sections[0].id);
  if(!title && !body) return toast('Type something first');
  const note = { id: uid(), title, body, sectionId, color: '#334155', pinned:false, tags:[], createdAt: Date.now(), updatedAt: Date.now() };
  state.notes.unshift(note);
  byId('qTitle').value = ''; byId('qBody').value = '';
  save(); render(); toast('Note added');
});

// ======= Search =======
byId('search').addEventListener('input', () => render());
byId('clearSearch').addEventListener('click', () => { byId('search').value=''; render(); });

// ======= Export / Import / Reset =======
byId('exportBtn').addEventListener('click', () => {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'keep-notes-export.json'; a.click();
  URL.revokeObjectURL(url);
  toast('Exported JSON downloaded');
});

byId('importInput').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if(!file) return;
  try{
    const text = await file.text();
    const imported = JSON.parse(text);
    if(!imported || !Array.isArray(imported.sections) || !Array.isArray(imported.notes)) throw new Error('Invalid file');
    state = imported; save(); render(); renderSectionPicker(); toast('Imported successfully');
  }catch(err){ alert('Import failed: ' + err.message); }
  e.target.value = '';
});

byId('resetBtn').addEventListener('click', () => {
  if(confirm('Reset all data? This cannot be undone.')){
    state = defaultData(); save(); render(); renderSectionPicker(); toast('Reset complete');
  }
});

// ======= Init =======
render();
