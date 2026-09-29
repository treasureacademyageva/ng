#!/usr/bin/env python3
"""Normalize licensed sources, deduplicate and build deterministic token files."""
from __future__ import annotations
import argparse, hashlib, json, re, unicodedata
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]

def clean_text(s:str)->str:
 s=unicodedata.normalize("NFKC",s).replace("\r\n","\n").replace("\r","\n")
 s=re.sub(r"[ \t]+"," ",s);s=re.sub(r"\n{4,}","\n\n\n",s)
 return s.strip()
def strip_gutenberg(s:str)->str:
 a=re.search(r"\*\*\* START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*",s,re.I)
 b=re.search(r"\*\*\* END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK",s,re.I)
 if a:s=s[a.end():]
 if b:s=s[:b.start()]
 return s
def hash_bytes(b:bytes)->str:return hashlib.sha256(b).hexdigest()

def docs(manifest):
 for src in manifest["sources"]:
  if not src.get("enabled") or not src.get("approved_for_training",src.get("reviewed",False)):continue
  kind=src["kind"];text=None
  if kind=="local_json":
   d=json.loads((ROOT/src["path"]).read_text())
   rows=d.get("docs",d if isinstance(d,list) else [])
   text="\n\n".join(str(x.get("text","")).strip() for x in rows if x.get("text"))
  elif kind=="generated_local":
   p=ROOT/"data"/src["path"] if not str(src["path"]).startswith("data/") else ROOT/src["path"]
   if not p.exists():continue
   text=p.read_text(errors="replace")
  elif kind=="gutenberg_text":
   p=ROOT/"data/raw"/(src["id"]+".txt")
   if p.exists():text=strip_gutenberg(p.read_text(errors="replace"))
  elif kind=="pdf_text":
   p=ROOT/src["curated_path"] if src.get("curated_path") else ROOT/"data/licensed"/(src["id"]+".txt")
   if p.exists():text=p.read_text(errors="replace")
  if text:
   text=clean_text(text)
   if text:yield src,text

def main():
 ap=argparse.ArgumentParser();ap.add_argument("--config",default="config/micro.json");args=ap.parse_args()
 cfg=json.loads((ROOT/args.config).read_text());manifest=json.loads((ROOT/"data/sources.json").read_text())
 seen=set();chunks=[];provenance=[]
 for src,text in docs(manifest):
  paras=[]
  for p in re.split(r"\n\s*\n",text):
   p=clean_text(p)
   if len(p)<20:continue
   h=hashlib.sha256(p.casefold().encode()).hexdigest()
   if h in seen:continue
   seen.add(h);paras.append(p)
  if not paras:continue
  joined="\n\n".join(paras)
  chunks.append(joined);provenance.append({"id":src["id"],"license":src["license"],"characters":len(joined),"paragraphs":len(paras),"sha256":hash_bytes(joined.encode())})
 corpus="\n\n<|document|>\n\n".join(chunks)+"\n"
 out=ROOT/"data/pretraining";out.mkdir(parents=True,exist_ok=True)
 (out/"corpus.txt").write_text(corpus)
 if cfg["tokenizer"]=="char":
  chars=sorted(set(corpus));stoi={c:i for i,c in enumerate(chars)};ids=np.asarray([stoi[c] for c in corpus],dtype=np.uint16)
  vocab={"type":"char","itos":chars,"stoi":stoi};(ROOT/cfg["vocab_path"]).write_text(json.dumps(vocab,ensure_ascii=False,indent=2)+"\n")
  vocab_size=len(chars);meta_path=out/"metadata.json"
 elif cfg["tokenizer"]=="bpe":
  try:from tokenizers import Tokenizer
  except ImportError:raise SystemExit("Install tokenizers from requirements.txt first")
  tok_path=ROOT/cfg["vocab_path"]
  if not tok_path.exists():raise SystemExit(f"Tokenizer missing: run tokenizer/train_tokenizer.py --config {args.config}")
  tok=Tokenizer.from_file(str(tok_path));vocab_size=tok.get_vocab_size()
  if vocab_size>65535:raise SystemExit("Vocabulary exceeds uint16 capacity")
  ids=np.asarray(tok.encode(corpus).ids,dtype=np.uint16);meta_path=out/(f"metadata-bpe-{vocab_size}.json")
 else:raise SystemExit(f"Unsupported tokenizer: {cfg['tokenizer']}")
 cut=max(cfg["block_size"]+2,int(len(ids)*.95));cut=min(cut,len(ids)-cfg["block_size"]-2)
 train_path=ROOT/cfg["train_data"];val_path=ROOT/cfg["val_data"];train_path.parent.mkdir(parents=True,exist_ok=True);val_path.parent.mkdir(parents=True,exist_ok=True)
 ids[:cut].tofile(train_path);ids[cut:].tofile(val_path)
 meta={"characters":len(corpus),"tokens":int(len(ids)),"train_tokens":int(cut),"val_tokens":int(len(ids)-cut),"vocab_size":vocab_size,"corpus_sha256":hash_bytes(corpus.encode()),"sources":provenance}
 meta_path.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+"\n")
 print(json.dumps(meta,indent=2))
if __name__=="__main__":main()
