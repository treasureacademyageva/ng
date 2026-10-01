#!/usr/bin/env python3
"""Build a self-contained private review portal for human reviewers.

The portal runs without network access. It stores progress in the browser when
available and can export/import JSON. Exported decisions are not approvals until
validated and imported into the hash-bound repository manifests.
"""
from __future__ import annotations

import csv
import hashlib
import html
import json
from pathlib import Path

from prepare_human_review_handoff import load_candidate_texts, read_jsonl

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "data/source-candidates.json"
PILOT = ROOT / "data/authoring/pilot-balanced-v1-review.csv"
DRAFTS = ROOT / "data/staging/authoring/pilot-v1-drafts.jsonl"
OUTPUT = ROOT / "data/staging/review-workbooks/START-REVIEWING.html"
REPORT = ROOT / "reports/review-portal.json"


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def candidate_entity(item: dict, text: str = "") -> dict:
    licence = item["license"]
    resolution = item.get("automated_hold_resolution") or {}
    disposition = item.get("licence_disposition") or {}
    return {
        "id": item["id"],
        "title": item["title"],
        "hash": item["extracted_sha256"],
        "content": text,
        "metadata": [
            ["Item ID", item["id"]], ["Creator", item["creator"]], ["Publisher", item["publisher"]],
            ["Language", item["language"]], ["Primary subject", item["primary_subject"]],
            ["Context", item["context_class"]], ["Licence", licence["identifier"]],
            ["Licence evidence", licence["evidence_url"]], ["Attribution", item["attribution"]],
            ["Source URL", item["source_url"]], ["Revision", item["source_revision"]],
            ["Staging status", item["staging_status"]], ["Content SHA-256", item["extracted_sha256"]],
            ["Automated hold resolution", resolution.get("code", "none")],
            ["Licence hold", disposition.get("reason", "none")],
        ],
    }


def pilot_entity(record: dict) -> dict:
    return {
        "id": record["sample_id"],
        "title": record["title"],
        "hash": record["content_sha256"],
        "content": record["content"],
        "metadata": [
            ["Sample ID", record["sample_id"]], ["Brief ID", record["brief_id"]],
            ["Subject", record["subject"]], ["Primary class", record["primary_class"]],
            ["Topic", record["topic"]], ["Creator type", record["creator_type"]],
            ["Rights", record["rights_status"]], ["Words", record["words"]],
            ["Content SHA-256", record["content_sha256"]],
        ],
    }


def main() -> None:
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    items = registry["items"]
    ready = [item for item in items if item["staging_status"] == "STAGED_UNAPPROVED"]
    excluded = [item for item in items if item["staging_status"] == "LICENSE_EXCLUDED"]
    candidate_texts = load_candidate_texts(ready)
    candidate_entities = {
        item["id"]: candidate_entity(item, candidate_texts.get(item["id"], "")) for item in items
    }
    pilot_manifest = {row["sample_id"]: row for row in read_csv(PILOT)}
    draft_records = read_jsonl(DRAFTS)
    if set(pilot_manifest) != {row["sample_id"] for row in draft_records}:
        raise SystemExit("private drafts do not match the pilot manifest")
    for record in draft_records:
        digest = hashlib.sha256(record["content"].encode("utf-8")).hexdigest()
        if digest != record["content_sha256"] or digest != pilot_manifest[record["sample_id"]]["content_sha256"]:
            raise SystemExit(f"{record['sample_id']}: draft/manifest hash mismatch")
    pilot_entities = {record["sample_id"]: pilot_entity(record) for record in draft_records}
    tracks = {
        "candidate_licence": {
            "label": "Candidate licence review (54)", "entitySet": "candidates",
            "ids": [item["id"] for item in items], "showContent": False,
            "requiredRole": "authorised_licence_reviewer",
            "recordFile": "model/data/reviews/candidate-intake-review.csv",
            "decisions": ["PENDING", "APPROVED", "CHANGES_REQUIRED", "REJECTED"],
            "prompts": [
                "Confirm the evidence applies to this exact item and revision.",
                "Confirm attribution, commercial-use and derivative permissions.",
                "Do not clear conditional rights by guesswork; obtain legal advice.",
            ],
        },
        "candidate_teacher": {
            "label": "Candidate teacher review (50)", "entitySet": "candidates",
            "ids": [item["id"] for item in ready], "showContent": True,
            "requiredRole": "qualified_nigerian_primary_teacher",
            "recordFile": "model/data/reviews/candidate-intake-review.csv",
            "decisions": ["PENDING", "APPROVED", "CHANGES_REQUIRED", "REJECTED"],
            "prompts": [
                "Check curriculum usefulness, factual accuracy and primary-level fit.",
                "Identify language, examples or assumptions needing Nigerian adaptation.",
                "Check that the title, subject and context labels match the content.",
            ],
        },
        "candidate_safeguarding": {
            "label": "Candidate safeguarding review (50)", "entitySet": "candidates",
            "ids": [item["id"] for item in ready], "showContent": True,
            "requiredRole": "designated_safeguarding_lead",
            "recordFile": "model/data/reviews/candidate-intake-review.csv",
            "decisions": ["PENDING", "APPROVED", "CHANGES_REQUIRED", "REJECTED"],
            "prompts": [
                "Check age fit, dignity, stereotypes, distress and unsafe instructions.",
                "Check for pupil, family, contact, location or financial privacy risks.",
                "Require changes or rejection whenever a risk is unresolved.",
            ],
        },
        "pilot_teacher": {
            "label": "Original pilot teacher review (96)", "entitySet": "pilot",
            "ids": [row["sample_id"] for row in draft_records], "showContent": True,
            "requiredRole": "qualified_nigerian_primary_teacher",
            "recordFile": "model/data/authoring/pilot-balanced-v1-review.csv",
            "decisions": ["PENDING", "APPROVED", "CHANGES_REQUIRED", "REJECTED"],
            "prompts": [
                "Check the topic, explanation, examples, exercises and answer guide.",
                "Check difficulty and progression for the stated Primary class.",
                "List every correction needed before approval.",
            ],
        },
        "pilot_safeguarding": {
            "label": "Original pilot safeguarding review (96)", "entitySet": "pilot",
            "ids": [row["sample_id"] for row in draft_records], "showContent": True,
            "requiredRole": "designated_safeguarding_lead",
            "recordFile": "model/data/authoring/pilot-balanced-v1-review.csv",
            "decisions": ["PENDING", "APPROVED", "CHANGES_REQUIRED", "REJECTED"],
            "prompts": [
                "Check age fit, inclusion, stereotypes, distress and activity safety.",
                "Confirm examples do not invite disclosure of private information.",
                "List every correction needed before approval.",
            ],
        },
        "conditional_legal": {
            "label": "Conditional-rights legal review (4)", "entitySet": "candidates",
            "ids": [item["id"] for item in excluded], "showContent": False,
            "requiredRole": "qualified_legal_counsel",
            "recordFile": "Legal advice first; then update candidate licence decision and notes",
            "decisions": ["PENDING", "CLEARED", "NOT_CLEARED", "MORE_INFORMATION_REQUIRED"],
            "prompts": [
                "For CC BY-SA, assess downstream share-alike implications for datasets and model artefacts.",
                "For US-public-domain claims, assess Nigerian jurisdiction and Project Gutenberg conditions.",
                "Record the scope and assumptions of advice; do not infer clearance beyond them.",
            ],
        },
    }
    portal_data = {
        "schema": "treasure-human-review-portal-v1",
        "generatedAt": "2026-10-01",
        "branch": "preview",
        "trainingAuthorised": False,
        "candidates": candidate_entities,
        "pilot": pilot_entities,
        "tracks": tracks,
    }
    encoded = json.dumps(portal_data, ensure_ascii=False).replace("</", "<\\/")
    html_text = PORTAL_HTML.replace("__PORTAL_DATA__", encoded)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(html_text, encoding="utf-8")
    report = {
        "version": 1,
        "generated_at": "2026-10-01",
        "status": "PRIVATE_INTERACTIVE_PORTAL_REVIEW_DECISIONS_NOT_IMPORTED",
        "portal": str(OUTPUT.relative_to(ROOT)),
        "sha256": hashlib.sha256(OUTPUT.read_bytes()).hexdigest(),
        "bytes": OUTPUT.stat().st_size,
        "tracks": {key: len(value["ids"]) for key, value in tracks.items()},
        "human_decisions_imported": 0,
        "training_approvals_granted": 0,
        "instructions": "Export review JSON and attach it in chat for validation and hash-bound import.",
    }
    REPORT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))


PORTAL_HTML = r'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Treasure Review Portal</title><style>
:root{color-scheme:light;--ink:#152238;--muted:#5d6b80;--navy:#0b2e59;--blue:#1769aa;--gold:#f2b134;--line:#d7deea;--paper:#fff;--bg:#eef3f8;--danger:#9c2f2f;--ok:#176b45}*{box-sizing:border-box}body{margin:0;font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;color:var(--ink);background:var(--bg)}header{position:sticky;top:0;z-index:3;background:linear-gradient(120deg,var(--navy),#164b7d);color:#fff;padding:15px 22px;box-shadow:0 2px 12px #0003}header h1{font-size:20px;margin:0}header p{margin:3px 0 0;color:#dce9f5}.shell{display:grid;grid-template-columns:310px minmax(0,1fr);min-height:calc(100vh - 78px)}aside{padding:20px;border-right:1px solid var(--line);background:#f8fafc}main{padding:24px;max-width:1040px;width:100%;margin:auto}.panel,.card{background:var(--paper);border:1px solid var(--line);border-radius:14px;box-shadow:0 3px 15px #1d35570d}.panel{padding:16px;margin-bottom:16px}.warning{border-left:5px solid var(--gold);background:#fff9e8}.danger{color:var(--danger);font-weight:700}.ok{color:var(--ok);font-weight:700}label{display:block;font-weight:700;margin:12px 0 5px}select,input,textarea,button{font:inherit}select,input,textarea{width:100%;border:1px solid #aeb9c9;border-radius:8px;padding:9px;background:#fff}textarea{min-height:110px;resize:vertical}button{border:0;border-radius:8px;padding:9px 13px;cursor:pointer;background:var(--blue);color:#fff;font-weight:700}button.secondary{background:#e6edf5;color:var(--ink)}button.dangerBtn{background:#8c3131}.row{display:flex;gap:8px;flex-wrap:wrap}.row>*{flex:1}.progress{height:9px;background:#dce4ee;border-radius:99px;overflow:hidden}.progress span{display:block;height:100%;background:var(--gold)}.card{padding:24px}.card h2{margin-top:0}.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:7px 18px;color:var(--muted);font-size:13px}.meta strong{color:var(--ink)}.prompts{background:#f3f8fd;border-left:4px solid var(--blue);padding:12px 18px;margin:18px 0}.content{white-space:pre-wrap;background:#fafbfd;border:1px solid var(--line);border-radius:10px;padding:18px;max-height:55vh;overflow:auto}.form{margin-top:20px;border-top:2px solid var(--line);padding-top:14px}.confirm{display:flex;align-items:flex-start;gap:8px;background:#fff7df;border:1px solid #edcc74;border-radius:8px;padding:10px;margin-top:12px}.confirm input{width:auto;margin-top:4px}.small{font-size:13px;color:var(--muted)}#exportBox{display:none;margin-top:14px}#exportText{min-height:220px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px}.nav{display:flex;justify-content:space-between;gap:10px;margin-top:15px}.status{min-height:24px;margin:10px 0;font-weight:700}@media(max-width:800px){.shell{grid-template-columns:1fr}aside{border-right:0;border-bottom:1px solid var(--line)}header{position:static}main{padding:14px}.content{max-height:none}}
</style></head><body><header><h1>Treasure Human Review Portal</h1><p>Private review workspace · no decision is imported automatically · long run not authorised</p></header>
<div class="shell"><aside>
<div class="panel warning"><strong>Start here</strong><ol><li>Choose only a track you are genuinely qualified to review.</li><li>Read one item and its prompts.</li><li>Enter your real name, required role, date, decision and notes.</li><li>Save each item.</li><li>Export JSON and attach it in chat with: <em>Import these reviews.</em></li></ol><p class="small">If you do not hold the required role, leave the decision PENDING. You may still add preliminary notes, but they will not count as approval.</p></div>
<label for="track">Review track</label><select id="track"></select>
<label for="search">Find item by title or ID</label><input id="search" placeholder="Type to search"><select id="itemList" size="8"></select>
<div class="panel"><strong id="progressText">0 / 0 reviewed</strong><div class="progress"><span id="progressBar" style="width:0"></span></div><p class="small" id="storageStatus"></p></div>
<div class="row"><button id="exportBtn">Export progress</button><button class="secondary" id="importBtn">Import JSON</button></div>
<div id="exportBox"><label for="exportText">Review JSON</label><textarea id="exportText" placeholder="Export appears here. You can also paste a previous export here and press Import JSON."></textarea><div class="row"><button id="downloadBtn">Download JSON</button><button class="secondary" id="copyBtn">Copy text</button><button class="dangerBtn" id="clearBtn">Clear local progress</button></div><p class="small">If download/copy is blocked in the preview, select the text manually and paste it into chat.</p></div>
</aside><main><div id="status" class="status"></div><article id="card" class="card"></article></main></div>
<script id="portalData" type="application/json">__PORTAL_DATA__</script><script>
const DATA=JSON.parse(document.getElementById('portalData').textContent);const KEY='treasure-review-portal-v1-progress';let state={reviews:{}};let currentTrack='pilot_teacher';let currentIndex=0;let workspaceConnected=false;
const $=id=>document.getElementById(id);function storageLoad(){try{const saved=localStorage.getItem(KEY);if(saved)state=JSON.parse(saved);$('storageStatus').textContent='Browser backup is available.'}catch(e){$('storageStatus').textContent='Browser storage is unavailable; workspace saving will still be attempted.'}}
function storageSave(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}}
async function workspaceLoad(){try{const response=await fetch('/api/reviews',{credentials:'same-origin'});if(!response.ok)throw Error('not connected');const saved=await response.json();if(saved&&saved.reviews)state.reviews={...state.reviews,...saved.reviews};workspaceConnected=true;storageSave();$('storageStatus').textContent='Connected: reviews save directly to the private workspace.';render()}catch(e){workspaceConnected=false;$('storageStatus').textContent+=' Static mode: export a backup before closing.'}}
async function workspaceSave(track,id,review){const response=await fetch('/api/reviews',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({track,itemId:id,review})});if(!response.ok){const detail=await response.text();throw Error(detail||'workspace save failed')}return response.json()}
function entities(){const t=DATA.tracks[currentTrack];return DATA[t.entitySet]}function ids(){return DATA.tracks[currentTrack].ids}function reviewKey(id){return currentTrack+':'+id}function getReview(id){return state.reviews[reviewKey(id)]||{reviewerName:'',reviewerRole:DATA.tracks[currentTrack].requiredRole,reviewedAt:'',decision:'PENDING',notes:'',confirmed:false}}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}function setStatus(msg,ok=true){$('status').textContent=msg;$('status').className='status '+(ok?'ok':'danger')}
function populateTracks(){for(const [key,t] of Object.entries(DATA.tracks)){const o=document.createElement('option');o.value=key;o.textContent=t.label;$('track').appendChild(o)}}
function filteredIds(){const q=$('search').value.trim().toLowerCase();return ids().filter(id=>!q||id.toLowerCase().includes(q)||entities()[id].title.toLowerCase().includes(q))}
function populateList(selectCurrent=true){const list=filteredIds();$('itemList').innerHTML='';for(const id of list){const o=document.createElement('option');o.value=id;o.textContent=entities()[id].title;$('itemList').appendChild(o)}if(list.length){const id=ids()[Math.min(currentIndex,ids().length-1)];if(selectCurrent||!list.includes(id))currentIndex=ids().indexOf(list.includes(id)?id:list[0]);$('itemList').value=ids()[currentIndex]}render()}
function progress(){const all=ids();const done=all.filter(id=>getReview(id).decision!=='PENDING').length;$('progressText').textContent=`${done} / ${all.length} reviewed`;$('progressBar').style.width=(all.length?100*done/all.length:0)+'%'}
function render(){const all=ids();if(!all.length){$('card').innerHTML='<p>No items.</p>';return}currentIndex=Math.max(0,Math.min(currentIndex,all.length-1));const id=all[currentIndex];$('itemList').value=id;const e=entities()[id],t=DATA.tracks[currentTrack],r=getReview(id);const metadata=e.metadata.map(([a,b])=>`<div><strong>${esc(a)}:</strong> ${esc(b)}</div>`).join('');const prompts=t.prompts.map(p=>`<li>☐ ${esc(p)}</li>`).join('');const decisions=t.decisions.map(d=>`<option ${d===r.decision?'selected':''}>${esc(d)}</option>`).join('');$('card').innerHTML=`<h2>${currentIndex+1}. ${esc(e.title)}</h2><div class="meta">${metadata}</div><div class="prompts"><strong>Review prompts</strong><ul>${prompts}</ul></div>${t.showContent?`<h3>Full text to review</h3><p class="small">Read the complete extracted training text below. For long books, scroll inside this box.</p><div class="content">${esc(e.content)}</div>`:'<p class="small"><strong>This track reviews evidence and metadata, so no book text is shown. Choose a teacher or safeguarding track to read the full text.</strong></p>'}<section class="form"><p><strong>Decision record:</strong> ${esc(t.recordFile)}</p><div class="row"><div><label>Reviewer’s real name</label><input id="reviewerName" value="${esc(r.reviewerName)}"></div><div><label>Required role</label><input id="reviewerRole" value="${esc(r.reviewerRole)}" readonly></div><div><label>Review date</label><input id="reviewedAt" type="date" value="${esc(r.reviewedAt)}"></div></div><label>Decision</label><select id="decision">${decisions}</select><label>Notes and required corrections</label><textarea id="notes">${esc(r.notes)}</textarea><label class="confirm"><input id="confirmed" type="checkbox" ${r.confirmed?'checked':''}><span>I confirm that I am the named human reviewer, genuinely hold the required role shown above, reviewed this exact SHA-256 content/evidence, and understand that this portal does not grant training approval.</span></label><div class="nav"><button class="secondary" id="prevBtn">← Previous</button><button id="saveBtn">Save this review</button><button class="secondary" id="nextBtn">Next →</button></div></section>`;$('prevBtn').onclick=()=>move(-1);$('nextBtn').onclick=()=>move(1);$('saveBtn').onclick=saveCurrent;progress();setStatus(`Viewing ${currentIndex+1} of ${all.length}: ${id}`)}
function move(delta){currentIndex=Math.max(0,Math.min(ids().length-1,currentIndex+delta));render()}
async function saveCurrent(){const id=ids()[currentIndex],t=DATA.tracks[currentTrack];const r={reviewerName:$('reviewerName').value.trim(),reviewerRole:$('reviewerRole').value.trim(),reviewedAt:$('reviewedAt').value,decision:$('decision').value,notes:$('notes').value.trim(),confirmed:$('confirmed').checked,contentSha256:entities()[id].hash,savedAt:new Date().toISOString()};if(r.decision!=='PENDING'){if(!r.reviewerName||!r.reviewedAt||!r.confirmed){setStatus('A non-pending decision requires your real name, date and confirmation.',false);return}if(r.reviewerRole!==t.requiredRole){setStatus('Reviewer role does not match this track.',false);return}if(['CHANGES_REQUIRED','REJECTED','NOT_CLEARED','MORE_INFORMATION_REQUIRED'].includes(r.decision)&&!r.notes){setStatus('This decision requires explanatory notes.',false);return}}state.reviews[reviewKey(id)]=r;storageSave();progress();if(workspaceConnected){try{await workspaceSave(currentTrack,id,r);setStatus('Saved directly to the private workspace.',true)}catch(e){setStatus('Saved only in this browser: '+e.message,false)}}else setStatus('Saved in this browser. Export a backup before closing.',true)}
function exportPayload(){return{schema:'treasure-human-review-export-v1',portalSchema:DATA.schema,exportedAt:new Date().toISOString(),branch:DATA.branch,trainingApprovalGranted:false,reviews:Object.entries(state.reviews).map(([key,value])=>{const split=key.indexOf(':');return{track:key.slice(0,split),itemId:key.slice(split+1),...value}})}}
function showExport(){const text=JSON.stringify(exportPayload(),null,2);$('exportText').value=text;$('exportBox').style.display='block';setStatus('Export prepared. Attach this JSON in chat for validation and import.',true);return text}
function importText(){try{const obj=JSON.parse($('exportText').value);if(obj.schema!=='treasure-human-review-export-v1'||!Array.isArray(obj.reviews))throw Error('wrong schema');for(const r of obj.reviews){if(!DATA.tracks[r.track]||!DATA.tracks[r.track].ids.includes(r.itemId))throw Error('unknown track or item');const e=DATA[DATA.tracks[r.track].entitySet][r.itemId];if(r.contentSha256!==e.hash)throw Error('content hash mismatch for '+r.itemId);const copy={...r};delete copy.track;delete copy.itemId;state.reviews[r.track+':'+r.itemId]=copy}storageSave();render();setStatus(`Imported ${obj.reviews.length} review record(s).`,true)}catch(e){setStatus('Import failed: '+e.message,false)}}
$('track').onchange=e=>{currentTrack=e.target.value;currentIndex=0;$('search').value='';populateList()};$('search').oninput=()=>populateList(false);$('itemList').onchange=e=>{currentIndex=ids().indexOf(e.target.value);render()};$('exportBtn').onclick=showExport;$('importBtn').onclick=()=>{$('exportBox').style.display='block';if($('exportText').value.trim())importText();else setStatus('Paste a previous review JSON export into the box, then press Import JSON again.',true)};$('downloadBtn').onclick=()=>{if(workspaceConnected){window.location.href='/api/export';return}const text=showExport(),blob=new Blob([text],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='treasure-review-export.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};$('copyBtn').onclick=async()=>{const text=showExport();try{await navigator.clipboard.writeText(text);setStatus('Export copied to clipboard.',true)}catch(e){$('exportText').focus();$('exportText').select();setStatus('Clipboard blocked; the export text is selected for manual copying.',false)}};$('clearBtn').onclick=()=>{if(confirm('Clear all locally saved review progress?')){state={reviews:{}};storageSave();render()}};populateTracks();storageLoad();$('track').value=currentTrack;populateList();workspaceLoad();
</script></body></html>'''


if __name__ == "__main__":
    main()
