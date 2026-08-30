"""Verifies the expanded comment library: comments.js parses and seeds
without error, every category matches a real template section title (so
"From library" auto-lands correctly), every subgroup used by a comment has
at least one template item with a matching `group`, and the phrasing
conventions (appeared to be / at the time of the inspection / recommendation
wording) hold across every entry.
"""
import json
import sys
import time

sys.path.insert(0, __file__.rsplit("\\", 1)[0])
from cdp_console import start_edge, get_ws_url, WS, disable_cache, URL  # noqa: E402

JS = r"""
(async () => {
  try {
    const commentsMod = await import('/js/report/comments.js');
    const tplMod = await import('/js/report/template.js');
    const { STARTER_COMMENTS, COMMENTS_VERSION } = commentsMod;
    const master = await tplMod.defaultTemplate();

    const sectionTitles = new Set(master.sections.map(s => s.title));
    const groupsBySection = new Map();
    for (const s of master.sections) {
      groupsBySection.set(s.title, new Set(s.items.map(i => i.group).filter(Boolean)));
    }

    const categoryMismatches = [];
    const subgroupMismatches = [];
    const phrasingIssues = [];

    for (const c of STARTER_COMMENTS) {
      if (c.category !== 'General' && !sectionTitles.has(c.category)) {
        categoryMismatches.push(c.category + ' :: ' + c.title);
      }
      if (c.subgroup) {
        const groups = groupsBySection.get(c.category);
        if (!groups || !groups.has(c.subgroup)) {
          subgroupMismatches.push(c.category + ' / ' + c.subgroup + ' :: ' + c.title);
        }
      }
      const bodyOk = c.body.includes('appeared to be') || c.body.includes('at the time of the inspection')
        || c.title.includes('fill-in') || c.category === 'General' || c.title.includes('location');
      if (!bodyOk) phrasingIssues.push('BODY: ' + c.category + ' :: ' + c.title);
      if (c.recommendation) {
        const recOk = /is recommended\.$/.test(c.recommendation);
        if (!recOk) phrasingIssues.push('REC: ' + c.category + ' :: ' + c.title + ' -> ' + c.recommendation);
      }
    }

    const byCategory = {};
    for (const c of STARTER_COMMENTS) byCategory[c.category] = (byCategory[c.category] || 0) + 1;

    return JSON.stringify({
      ok: true,
      totalComments: STARTER_COMMENTS.length,
      commentsVersion: COMMENTS_VERSION,
      byCategory,
      categoryMismatches,
      subgroupMismatches,
      phrasingIssues,
      templateSections: [...sectionTitles],
    });
  } catch (e) {
    return JSON.stringify({ ok: false, error: String((e && e.stack) || e) });
  }
})()
"""


def main():
    proc = start_edge()
    try:
        ws_url = get_ws_url()
        ws = WS(ws_url)
        disable_cache(ws)
        ws.call("Runtime.enable")
        ws.call("Page.enable")
        ws.call("Page.navigate", {"url": URL})
        time.sleep(2.5)

        eval_id = ws.call("Runtime.evaluate", {
            "expression": JS,
            "awaitPromise": True,
            "returnByValue": True,
        })
        deadline = time.time() + 15
        result = None
        while time.time() < deadline:
            msg = ws.recv_frame(timeout=0.5)
            if msg == "TIMEOUT" or msg is None:
                continue
            if msg.get("id") == eval_id:
                result = msg
                break
        print(json.dumps(result, indent=2) if result else "no response")
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()


if __name__ == "__main__":
    main()
