#!/usr/bin/env python3
"""License-gated corpus fetcher. Downloads only manifest-approved sources."""
from __future__ import annotations
import argparse, hashlib, io, json, shutil, subprocess, sys, urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
APPROVED=("owned","CC0","CC-BY-","CC-BY-SA-","US-Public-Domain")
MAX_BYTES=50*1024*1024

def sha256(data:bytes)->str:return hashlib.sha256(data).hexdigest()
def allowed(license_name:str)->bool:return any(license_name.startswith(x) for x in APPROVED)

def fetch(url:str)->bytes:
    req=urllib.request.Request(url,headers={"User-Agent":"TreasureEDU/0.1 corpus research; contact treasuregroupofschool@gmail.com"})
    with urllib.request.urlopen(req,timeout=60) as r:
        n=int(r.headers.get("Content-Length") or 0)
        if n>MAX_BYTES:raise ValueError(f"source is {n} bytes; cap is {MAX_BYTES}")
        data=r.read(MAX_BYTES+1)
    if len(data)>MAX_BYTES:raise ValueError("source exceeded download cap")
    return data

def main()->int:
    ap=argparse.ArgumentParser();ap.add_argument("--manifest",default="data/sources.json");ap.add_argument("--strict",action="store_true");args=ap.parse_args()
    manifest=(ROOT/args.manifest).resolve();doc=json.loads(manifest.read_text())
    raw=ROOT/"data/raw";licensed=ROOT/"data/licensed";raw.mkdir(parents=True,exist_ok=True);licensed.mkdir(parents=True,exist_ok=True)
    lock={"manifest_version":doc["version"],"manifest_sha256":sha256(manifest.read_bytes()),"fetched_at":datetime.now(timezone.utc).isoformat(),"sources":[]};errors=[]
    for src in doc["sources"]:
        if not src.get("enabled"):continue
        lic=src.get("license","")
        if not allowed(lic):
            errors.append(f"{src['id']}: unapproved license {lic!r}");continue
        kind=src["kind"]
        if kind in {"local_json","generated_local"}:
            p=(ROOT/src["path"]) if kind=="local_json" else (ROOT/"data"/src["path"])
            rec={"id":src["id"],"kind":kind,"status":"local","license":lic,"path":src["path"]}
            if p.exists():
                data=p.read_bytes();rec.update({"bytes":len(data),"sha256":sha256(data)})
            else:rec["status"]="missing"
            lock["sources"].append(rec);continue
        try:
            data=fetch(src["url"]);ext=".pdf" if kind=="pdf_text" else ".txt";dest=raw/(src["id"]+ext);dest.write_bytes(data)
            rec={"id":src["id"],"url":src["url"],"license":lic,"bytes":len(data),"sha256":sha256(data),"raw":str(dest.relative_to(ROOT)),"status":"downloaded"}
            if kind=="pdf_text":
                tool=shutil.which("pdftotext");out=licensed/(src["id"]+".txt");pdf_start=data.find(b"%PDF-")
                if pdf_start<0:raise ValueError("download did not contain a PDF header")
                pdf_data=data[pdf_start:]
                if tool:
                    clean_pdf=licensed/(src["id"]+".pdf");clean_pdf.write_bytes(pdf_data)
                    subprocess.run([tool,"-layout",str(clean_pdf),str(out)],check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE);clean_pdf.unlink(missing_ok=True)
                    rec.update({"extract_status":"ok-pdftotext","text":str(out.relative_to(ROOT)),"text_sha256":sha256(out.read_bytes())})
                else:
                    try:
                        from pypdf import PdfReader
                        pages=[p.extract_text() or "" for p in PdfReader(io.BytesIO(pdf_data)).pages];out.write_text("\n\n".join(pages),encoding="utf-8")
                        rec.update({"extract_status":"ok-pypdf","text":str(out.relative_to(ROOT)),"text_sha256":sha256(out.read_bytes())})
                    except ImportError:rec["extract_status"]="pdf-extractor-unavailable"
            lock["sources"].append(rec);print(f"fetched {src['id']}: {len(data):,} bytes")
        except Exception as e:
            errors.append(f"{src['id']}: {e}");print("ERROR",errors[-1],file=sys.stderr)
    (ROOT/"data/source-lock.json").write_text(json.dumps(lock,indent=2,ensure_ascii=False)+"\n")
    print(f"locked {len(lock['sources'])} sources; {len(errors)} errors")
    if errors:(ROOT/"data/fetch-errors.log").write_text("\n".join(errors)+"\n")
    return 1 if errors and args.strict else 0
if __name__=="__main__":raise SystemExit(main())
