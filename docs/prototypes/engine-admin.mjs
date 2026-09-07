/** Local management UI; portable design copies remain visibly read-only. */
import { mountPhotoIntake } from './photo-intake.mjs';
export function mountAdmin({ payload, onOpen, onBinChange }) {
  const $ = id => document.getElementById(id), dialog = $('admin-dialog');
  let bins = payload.bins || [], connected = false, poll = null, running = false;
  const photos = mountPhotoIntake($('admin-photos'), {onSaved:()=>load()});
  const message = (value, error = false) => { $('admin-status').textContent = value; $('admin-status').classList.toggle('error', error); };
  async function api(route, body) {
    const response = await fetch('/api/admin/' + route, { cache: 'no-store', ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Local Admin is unavailable here. Start it with npm run lab.');
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'The request could not be completed.');
    return result;
  }
  function health(summary = {}) {
    $('admin-health').replaceChildren();
    for (const [label, value] of [['OBJECTS', summary.total ?? payload.records.length], ['BINS', bins.length], ['CARDS', summary.cards ?? payload.stats.cards], ['LOCATION NEEDED', summary.unassigned ?? payload.records.filter(c => c.container === 'Location not recorded').length]]) {
      const p = document.createElement('p'), strong = document.createElement('strong'), small = document.createElement('span');strong.textContent = value;small.textContent = label;p.append(strong, small);$('admin-health').append(p);
    }
  }
  function printLinks() {
    const id = $('print-bin').value;
    for (const kind of ['label', 'sheet']) { const link = $('print-' + kind);link.href = '/admin/print/bin/' + encodeURIComponent(id) + '/' + kind;link.setAttribute('aria-disabled', String(!connected)); }
    $('print-master').href = '/admin/print/master';$('admin-export').href = '/api/admin/export';
    for (const id of ['print-master', 'admin-export']) $(id).setAttribute('aria-disabled', String(!connected));
    document.querySelector('.paper-label b').textContent = bins.find(b=>b.id===$('print-bin').value)?.title||'Bin 01';
    for (const id of ['admin-build-print', 'admin-build', 'admin-print-only']) $(id).disabled = !connected || running;
  }
  function renderBins() {
    $('admin-bin-list').replaceChildren(); const previous = $('print-bin').value; $('print-bin').replaceChildren();
    for (const bin of bins) {
      const row = document.createElement('form');row.className = 'admin-bin-row';
      const identity = document.createElement('div');identity.className = 'bin-identity';
      const number = document.createElement('strong'), count = document.createElement('small');number.textContent = bin.id;count.textContent = bin.count + ' copies';identity.append(number, count);
      const fields = document.createElement('div');fields.className = 'bin-fields';
      const nameLabel = document.createElement('label');nameLabel.textContent = 'BIN NAME';
      const name = document.createElement('input');name.value = bin.title;name.maxLength = 60;name.required = true;name.setAttribute('aria-label', `Name for bin ${bin.id}`);nameLabel.append(name);
      const locationLabel = document.createElement('label');locationLabel.textContent = 'LOCATION';
      const location = document.createElement('input');location.value = bin.location;location.maxLength = 100;location.placeholder = 'Add a room, shelf, or cabinet';location.setAttribute('aria-label', `Location for bin ${bin.id}`);locationLabel.append(location);
      fields.append(nameLabel, locationLabel);const save = document.createElement('button');save.type = 'submit';save.textContent = 'Save';save.setAttribute('aria-label', `Save bin ${bin.id}`);save.className = 'bin-save';save.disabled = true;
      name.disabled = location.disabled = !connected;
      const dirty = () => { save.disabled = !connected || running || (name.value.trim() === bin.title && location.value.trim() === bin.location); };name.oninput = location.oninput = dirty;
      row.onsubmit = async e => {
        e.preventDefault();save.disabled = true;save.textContent = 'Saving…';
        try { const { bin: saved } = await api('bin', { id: bin.id, title: name.value, location: location.value, revision: bin.revision });Object.assign(bin, saved);name.value = bin.title;location.value = bin.location;onBinChange(bin);message(`Saved ${bin.title}. Print previews use this update now; build to refresh saved pages and PDFs.`);renderBinOptions(); }
        catch (error) { message(error.message, true); }
        finally { save.textContent = 'Save';dirty(); }
      };
      row.append(identity, fields, save);$('admin-bin-list').append(row);
    }
    renderBinOptions(previous);printLinks();
  }
  function renderBinOptions(selected = $('print-bin').value) {
    $('print-bin').replaceChildren();for (const bin of bins) { const option = document.createElement('option');option.value = bin.id;option.textContent = `${bin.title} · ${bin.count} copies`; $('print-bin').append(option); }
    if (bins.some(bin => bin.id === selected)) $('print-bin').value = selected;
  }
  async function load() {
    message('');
    try { const state = await api('state');bins = state.bins;connected = true;health(state.summary);for (const bin of bins) onBinChange(bin); }
    catch (error) { connected = false;health();message(error.message || 'Open the local app with npm run lab to manage the collection.', true); }
    $('admin-connection').textContent = connected ? 'LOCAL · CONNECTED' : 'PREVIEW · READ ONLY';$('admin-signal').classList.toggle('online', connected);renderBins();photos.setConnected(connected);if (connected) await checkJob();
  }
  async function checkJob() {
    try {
      const job = await api('job');running = job.status === 'running';printLinks();
      $('print-job-status').textContent = running ? 'Working · ' + job.stage : job.status === 'complete' ? (['build','review'].includes(job.action)?'Build finished · collection pages refreshed.':'Finished · PDFs are ready below.') : job.status === 'failed' ? job.error : '';
      $('print-log-wrap').hidden = !job.log;$('print-job-log').textContent = job.log || '';
      $('print-files').replaceChildren();
      if (job.files?.length) { const heading = document.createElement('h4');heading.textContent = 'Saved PDFs';$('print-files').append(heading); }
      for (const bin of bins) {
        const files = (job.files || []).filter(file => file.name === `bin-${bin.id}-label.pdf` || file.name === `bin-${bin.id}-sheet.pdf`);if (!files.length) continue;
        const row = document.createElement('div'), name = document.createElement('span');row.className = 'print-file-row';name.textContent = bin.title;row.append(name);
        for (const file of files) { const a = document.createElement('a');a.href = file.url;a.target = '_blank';a.rel = 'noopener';a.textContent = file.name.endsWith('label.pdf') ? 'Label PDF ↗' : 'Sheet PDF ↗';a.title = 'Generated ' + new Date(file.updatedAt).toLocaleString();row.append(a); }$('print-files').append(row);
      }
      clearTimeout(poll);if (running && dialog.open) poll = setTimeout(checkJob, 1500);
    } catch (error) { message(error.message, true); }
  }
  async function run(action) {
    try { running = true;printLinks();message('');await api('job', { action });await checkJob(); }
    catch (error) { running = false;printLinks();message(error.message, true); }
  }
  for (const button of document.querySelectorAll('[data-admin-view]')) button.onclick = () => {
    const view = button.dataset.adminView;for (const item of document.querySelectorAll('[data-admin-view]')) item.setAttribute('aria-pressed', String(item === button));for (const section of ['bins', 'print', 'backup', 'photos']) $('admin-' + section).hidden = section !== view;document.querySelector('.admin-content').scrollTop=0;
  };
  $('admin').onclick = () => { onOpen();dialog.showModal();health();renderBins();load();photos.resume(); };
  $('admin-reload').onclick = load;$('print-bin').onchange = printLinks;
  $('admin-build-print').onclick = () => run('build-print');$('admin-build').onclick = () => run('build');$('admin-print-only').onclick = () => run('print');
  dialog.addEventListener('close', () => {clearTimeout(poll);photos.pause();});
  dialog.addEventListener('click', e => { if (e.target.closest('a[aria-disabled="true"]')) e.preventDefault(); });
}
