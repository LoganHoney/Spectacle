import * as store from '../core/store.js';
import * as media from '../core/media.js';
import { renderFullReport, renderFormReport } from '../report/render.js';
import { buildFullReportHtml, buildFormReportHtml } from '../report/export.js';
import { getForm } from '../forms/engine.js';
import { getEmailTemplate } from '../report/emailTemplates.js';
import { buildMergeContext, mergeText } from '../core/merge.js';
import { html, raw, esc, setTopbar, toast, downloadBlob, slug } from '../core/ui.js';
import { go } from '../core/router.js';

export async function reportView(view, { id, form: formId }) {
  const hydrated = await store.hydrate(id);
  if (!hydrated) { go('/inspections', { replace: true }); return; }
  const { inspection, property, client } = hydrated;
  const form = formId ? getForm(formId) : null;

  setTopbar({
    title: form ? form.code : 'Report',
    back: () => go(`/inspection/${id}`),
    actions: [],
  });

  view.innerHTML = html`
    <div class="row wrap no-print" style="margin:0 0 16px">
      ${form ? '' : raw(`<a class="chip" aria-pressed="false" href="#/inspection/${id}/report">Full Report</a>`)}
      ${raw(await formChips())}
      <span class="spacer"></span>
    </div>
    <div class="row wrap no-print" style="margin:0 0 18px;gap:8px">
      <button class="btn primary" data-print>Print / Save PDF</button>
      <button class="btn" data-export>Export Digital Copy</button>
      ${raw(navigator.share ? '<button class="btn ghost" data-share>Share</button>' : '')}
    </div>
    <div id="report-root" class="rp-root"><div class="empty small">Building report…</div></div>
  `;

  async function formChips() {
    const { FORM_MENU } = await import('../forms/engine.js');
    return FORM_MENU.map((f) => {
      const active = f.id === formId;
      return `<a class="chip" aria-pressed="${active}" href="#/inspection/${id}/report?form=${f.id}">${esc(f.code)}</a>`;
    }).join('');
  }

  const root = view.querySelector('#report-root');
  const urlFor = (record, which) => media.objectUrl(record, which);
  const bodyHtml = form ? await renderFormReport(hydrated, formId, urlFor) : await renderFullReport(hydrated, urlFor);
  root.innerHTML = bodyHtml;

  const filename = () => {
    const base = slug([property ? store.propertyLabel(property).split(',')[0] : client?.name, form?.code].filter(Boolean).join(' '));
    return `${base || 'inspection-report'}.html`;
  };

  view.querySelector('[data-print]').onclick = () => window.print();

  view.querySelector('[data-export]').onclick = async () => {
    toast('Building report file…', 15000);
    try {
      const htmlStr = form ? await buildFormReportHtml(hydrated, formId) : await buildFullReportHtml(hydrated);
      const blob = new Blob([htmlStr], { type: 'text/html' });
      downloadBlob(blob, filename());
      toast('Report saved');
    } catch (err) {
      console.error(err);
      toast('Could not build the report file');
    }
  };

  const shareBtn = view.querySelector('[data-share]');
  if (shareBtn) {
    shareBtn.onclick = async () => {
      toast('Preparing to share…', 15000);
      try {
        const htmlStr = form ? await buildFormReportHtml(hydrated, formId) : await buildFullReportHtml(hydrated);
        const file = new File([htmlStr], filename(), { type: 'text/html' });
        const templateKey = formId === 'fourpoint' ? 'fourpoint' : formId === 'windmit' ? 'windmit' : 'full';
        const tpl = getEmailTemplate(hydrated.settings, templateKey);
        const fields = buildMergeContext(hydrated);
        const shareData = { files: [file], title: mergeText(tpl.subject, fields), text: mergeText(tpl.body, fields) };
        if (navigator.canShare && !navigator.canShare(shareData)) {
          downloadBlob(new Blob([htmlStr], { type: 'text/html' }), filename());
          toast('Sharing unsupported here — saved instead');
          return;
        }
        await navigator.share(shareData);
      } catch (err) {
        if (err?.name !== 'AbortError') { console.error(err); toast('Could not share the report'); }
      }
    };
  }
}
