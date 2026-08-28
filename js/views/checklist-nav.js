// The checklist's own screen: a section list you drill into, matching the
// familiar "list of categories → tap into one" pattern. On a wide screen
// both panes sit side by side; on a phone, opening a section is a full
// screen navigation with a back arrow — driven by the same CSS/markup, just
// toggled by whether a section is selected in the URL (see .cl-shell rules).

import * as store from '../core/store.js';
import { mountSectionItems, isFlagged } from './checklist.js';
import { newSection } from '../report/template.js';
import { html, raw, esc, setTopbar, promptSheet, confirmSheet, toast } from '../core/ui.js';
import { go } from '../core/router.js';

export async function checklistNav(view, { id, sectionId }) {
  const hydrated = await store.hydrate(id);
  if (!hydrated) { go('/inspections', { replace: true }); return; }
  const { inspection } = hydrated;
  const persistNow = () => store.saveInspection(inspection);

  const activeSection = sectionId ? inspection.template.sections.find((s) => s.id === sectionId) : null;
  if (sectionId && !activeSection) { go(`/inspection/${id}/checklist`, { replace: true }); return; }

  setTopbar({
    title: activeSection ? activeSection.title : 'Checklist',
    back: () => (activeSection ? go(`/inspection/${id}/checklist`) : go(`/inspection/${id}`)),
    actions: activeSection
      ? [{ label: 'Rename', onClick: renameSection }]
      : [{ label: '+ Section', onClick: addSection }],
  });

  view.innerHTML = html`
    <div class="cl-shell ${activeSection ? 'has-section' : ''}">
      <div class="cl-sidebar" id="cl-sidebar"></div>
      <div class="cl-main" id="cl-main"></div>
    </div>
  `;

  drawSidebar();

  if (activeSection) {
    mountSectionItems(view.querySelector('#cl-main'), inspection, activeSection, () => store.saveInspection(inspection), drawSidebar);
    if (activeSection.items.length === 0 || activeSection.custom) {
      const del = document.createElement('button');
      del.className = 'btn danger wide';
      del.style.marginTop = '12px';
      del.textContent = 'Delete This Section';
      del.onclick = deleteSection;
      view.querySelector('#cl-main').appendChild(del);
    }
  } else {
    view.querySelector('#cl-main').innerHTML = `<div class="empty"><div class="big">&#9635;</div><p class="small">Choose a section on the left to get started.</p></div>`;
  }

  function drawSidebar() {
    const sidebar = view.querySelector('#cl-sidebar');
    sidebar.innerHTML = html`
      <div class="spread" style="margin-bottom:8px"><h3 style="margin:0">Sections</h3>
        <button class="btn sm ghost" data-add-section>+ Add</button></div>
      <div class="list">${raw(sectionListHtml())}</div>
    `;
    sidebar.querySelector('[data-add-section]').onclick = addSection;
  }

  function sectionListHtml() {
    return inspection.template.sections.map((s) => {
      const answered = s.items.filter((it) => {
        const r = inspection.data[it.id];
        if (!r) return false;
        const hasValue = Array.isArray(r.value) ? r.value.length > 0 : r.value !== undefined && r.value !== '';
        return hasValue || !!r.comment;
      }).length;
      const flagged = s.items.filter((it) => isFlagged(inspection, it)).length;
      return `<a class="item ${s.id === sectionId ? 'cl-active' : ''}" href="#/inspection/${id}/checklist/${s.id}">
        <div class="g"><div class="t">${esc(s.title)}</div>
          <div class="s">${answered}/${s.items.length} answered${flagged ? ` · ${flagged} flagged` : ''}</div></div>
        <span class="chev">&#8250;</span>
      </a>`;
    }).join('');
  }

  async function addSection() {
    const title = await promptSheet('New Section', { label: 'Section title', placeholder: 'e.g. Detached Workshop' });
    if (!title) return;
    const section = newSection(title);
    inspection.template.sections.push(section);
    await persistNow();
    go(`/inspection/${id}/checklist/${section.id}`);
  }

  async function renameSection() {
    const title = await promptSheet('Rename Section', { label: 'Section title', value: activeSection.title });
    if (!title) return;
    activeSection.title = title;
    await persistNow();
    checklistNav(view, { id, sectionId });
  }

  async function deleteSection() {
    if (!await confirmSheet('Delete this section?', 'All items, notes and photos recorded under it will be removed from this job.')) return;
    inspection.template.sections = inspection.template.sections.filter((s) => s.id !== activeSection.id);
    await persistNow();
    toast('Section deleted');
    go(`/inspection/${id}/checklist`);
  }
}
