#!/usr/bin/env python3
"""License-gated corpus fetcher. Downloads only manifest-approved sources."""
from __future__ import annotations
import argparse, hashlib, io, json, posixpath, shutil, subprocess, sys, urllib.request, zipfile
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from xml.etree import ElementTree as ET

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

class _TextExtractor(HTMLParser):
    blocks={"p","h1","h2","h3","h4","h5","h6","li","td","th","blockquote","div"}
    def __init__(self):super().__init__();self.parts=[];self.skip=0
    def handle_starttag(self,tag,attrs):
        if tag in {"script","style","svg"}:self.skip+=1
        elif tag in self.blocks and not self.skip:self.parts.append("\n")
    def handle_endtag(self,tag):
        if tag in {"script","style","svg"} and self.skip:self.skip-=1
        elif tag in self.blocks and not self.skip:self.parts.append("\n")
    def handle_data(self,data):
        if not self.skip:self.parts.append(data)

def extract_epub(data:bytes)->str:
    """Extract XHTML in EPUB spine order using only the standard library."""
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        container=ET.fromstring(z.read("META-INF/container.xml"));rootfile=next(x for x in container.iter() if x.tag.endswith("rootfile"));opf_name=rootfile.attrib["full-path"]
        opf=ET.fromstring(z.read(opf_name));items={x.attrib["id"]:x.attrib["href"] for x in opf.iter() if x.tag.endswith("item") and x.attrib.get("media-type") in {"application/xhtml+xml","text/html"}}
        order=[x.attrib["idref"] for x in opf.iter() if x.tag.endswith("itemref")];base=posixpath.dirname(opf_name);parser=_TextExtractor()
        for item_id in order:
            href=items.get(item_id)
            if href:parser.feed(z.read(posixpath.normpath(posixpath.join(base,href))).decode("utf-8","replace"))
    lines=[" ".join(line.split()) for line in "".join(parser.parts).splitlines()]
    return "\n\n".join(line for line in lines if line)+"\n"

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
            data=fetch(src["url"]);ext={"pdf_text":".pdf","epub_text":".epub"}.get(kind,".txt");dest=raw/(src["id"]+ext);dest.write_bytes(data)
            rec={"id":src["id"],"url":src["url"],"license":lic,"bytes":len(data),"sha256":sha256(data),"raw":str(dest.relative_to(ROOT)),"status":"downloaded"}
            if kind=="epub_text":
                out=licensed/(src["id"]+".txt");out.write_text(extract_epub(data),encoding="utf-8")
                rec.update({"extract_status":"ok-epub-spine","text":str(out.relative_to(ROOT)),"text_sha256":sha256(out.read_bytes())})
            elif kind=="pdf_text":
                tool=shutil.which("pdftotext");out=licensed/(src["id"]+".txt");pdf_start=data.find(b"%PDF-")
                if pdf_start<0:raise ValueError("download did not contain a PDF header")
                pdf_data=data[pdf_start:];curated=ROOT/src["curated_path"] if src.get("curated_path") else None
                if curated and curated.exists():
                    rec.update({"extract_status":"curated-reviewed","text":str(curated.relative_to(ROOT)),"text_sha256":sha256(curated.read_bytes())})
                elif tool:
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
