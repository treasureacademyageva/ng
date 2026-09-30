#!/usr/bin/env python3
"""Fail closed when the corpus manifest, lockfile, files or licences disagree."""
from __future__ import annotations
import hashlib,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 manifest_path=ROOT/'data/sources.json';lock_path=ROOT/'data/source-lock.json';manifest=json.loads(manifest_path.read_text());lock=json.loads(lock_path.read_text());errors=[]
 if lock.get('manifest_sha256')!=sha(manifest_path):errors.append('source-lock manifest hash is stale')
 records={x['id']:x for x in lock.get('sources',[])}
 if len(records)!=len(lock.get('sources',[])):errors.append('duplicate source id in source-lock')
 ids=set()
 for src in manifest['sources']:
  sid=src.get('id')
  if not sid or sid in ids:errors.append(f'duplicate/missing manifest id: {sid}')
  ids.add(sid)
  if not src.get('enabled'):continue
  for field in ('kind','title','creator','license','language','level','subject','reviewed'):
   if field not in src:errors.append(f'{sid}: missing {field}')
  rec=records.get(sid)
  if not rec:errors.append(f'{sid}: enabled but not locked');continue
  if rec.get('license')!=src.get('license'):errors.append(f'{sid}: licence differs between manifest and lock')
  local=rec.get('path')
  if local:
   p=(ROOT/local) if src.get('kind')=='local_json' else (ROOT/'data'/local)
   if not p.exists() or sha(p)!=rec.get('sha256'):errors.append(f'{sid}: local file hash mismatch')
  raw=rec.get('raw')
  if raw:
   p=ROOT/raw
   if not p.exists() or sha(p)!=rec.get('sha256'):errors.append(f'{sid}: raw file hash mismatch')
  text=rec.get('text')
  if text:
   p=ROOT/text
   if not p.exists() or sha(p)!=rec.get('text_sha256'):errors.append(f'{sid}: extracted text hash mismatch')
   elif re.search(r'\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b',p.read_text(errors='replace'),re.I):errors.append(f'{sid}: email address in extracted training source')
  if src.get('approved_for_training',src.get('reviewed',False)):
   if not src.get('reviewed'):errors.append(f'{sid}: training-approved but unreviewed')
   if src.get('kind') not in {'generated_local','gutenberg_text','pdf_text','epub_text'}:errors.append(f'{sid}: unsupported training source kind')
   if src.get('kind') in {'pdf_text','epub_text'} and not text:errors.append(f'{sid}: approved extracted source has no locked text')
  if sid.startswith('siyavula-') and src.get('license')!='CC-BY-4.0':errors.append(f'{sid}: EPUB states CC BY 4.0')
 report={'manifest_sources':len(manifest['sources']),'enabled_sources':sum(bool(x.get('enabled')) for x in manifest['sources']),'training_sources':sum(bool(x.get('enabled')) and bool(x.get('approved_for_training',x.get('reviewed',False))) for x in manifest['sources']),'locked_sources':len(records),'errors':errors};print(json.dumps(report,indent=2));raise SystemExit(1 if errors else 0)
if __name__=='__main__':main()
