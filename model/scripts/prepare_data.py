#!/usr/bin/env python3
"""Normalize licensed sources, deduplicate and build deterministic token files."""
from __future__ import annotations
import argparse,hashlib,json,re,unicodedata
from pathlib import Path
import numpy as np
from deduplication import NearDuplicateIndex
ROOT=Path(__file__).resolve().parents[1]
def clean_text(s:str)->str:
 s=unicodedata.normalize('NFKC',s).replace('\r\n','\n').replace('\r','\n');s=re.sub(r'https?://\S+','',s);s=re.sub(r'(?m)^\s*\d{7,}\s*$','',s);s=re.sub(r'[ \t]+',' ',s);s=re.sub(r'\n{4,}','\n\n\n',s);return s.strip()
def strip_gutenberg(s:str)->str:
 a=re.search(r'\*\*\* START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*',s,re.I)
 if a:s=s[a.end():]
 b=re.search(r'\*\*\* END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK',s,re.I)
 if b:s=s[:b.start()]
 return s
def hash_bytes(b:bytes)->str:return hashlib.sha256(b).hexdigest()
def source_text(src):
 kind=src['kind'];text=None
 if kind=='local_json':
  d=json.loads((ROOT/src['path']).read_text());rows=d.get('docs',d if isinstance(d,list) else []);text='\n\n'.join(str(x.get('text','')).strip() for x in rows if x.get('text'))
 elif kind=='generated_local':
  p=ROOT/'data'/src['path'] if not str(src['path']).startswith('data/') else ROOT/src['path'];text=p.read_text(errors='replace') if p.exists() else None
 elif kind=='gutenberg_text':
  p=ROOT/'data/raw'/(src['id']+'.txt');text=strip_gutenberg(p.read_text(errors='replace')) if p.exists() else None
 elif kind in {'pdf_text','epub_text'}:
  p=ROOT/src['curated_path'] if src.get('curated_path') else ROOT/'data/licensed'/(src['id']+'.txt');text=p.read_text(errors='replace') if p.exists() else None
 return clean_text(text) if text else None
def units(text):
 """Paragraph units; split line-oriented generated files into bounded chunks."""
 out=[]
 for para in re.split(r'\n\s*\n',text):
  para=clean_text(para)
  if len(para)<20:continue
  if len(para)>2000 and '\n' in para:
   chunk=[];size=0
   for line in para.splitlines():
    line=line.strip()
    if not line:continue
    if chunk and size+len(line)>1500:out.append('\n'.join(chunk));chunk=[];size=0
    chunk.append(line);size+=len(line)+1
   if chunk:out.append('\n'.join(chunk))
  else:out.append(para)
 return out
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--config',default='config/micro.json');args=ap.parse_args();cfg=json.loads((ROOT/args.config).read_text());manifest=json.loads((ROOT/'data/sources.json').read_text());deduper=NearDuplicateIndex(threshold=.88,min_words=30);duplicate_counts={'exact':0,'near':0};train_docs=[];val_docs=[];provenance=[]
 for src in manifest['sources']:
  if not src.get('enabled') or not src.get('approved_for_training',src.get('reviewed',False)):continue
  text=source_text(src)
  if not text:continue
  docs=[]
  for unit_index,para in enumerate(units(text),1):
   match=deduper.add_or_match(f"{src['id']}:{unit_index}",para)
   if match:duplicate_counts[match.kind]+=1;continue
   h=hashlib.sha256(para.casefold().encode()).hexdigest();docs.append((h,para))
  if not docs:continue
  nval=1 if len(docs)>1 else 0;nval=max(nval,round(len(docs)*.05));val_hashes={h for h,_ in sorted(docs)[:nval]};src_train=[];src_val=[]
  for h,para in docs:(src_val if h in val_hashes else src_train).append(para)
  train_docs.append('\n\n'.join(src_train));val_docs.append('\n\n'.join(src_val));joined='\n\n'.join(p for _,p in docs)
  provenance.append({'id':src['id'],'license':src['license'],'characters':len(joined),'paragraphs':len(docs),'train_paragraphs':len(src_train),'validation_paragraphs':len(src_val),'sha256':hash_bytes(joined.encode())})
 marker='\n\n<|document|>\n\n';train_corpus=marker.join(x for x in train_docs if x)+'\n';val_corpus=marker.join(x for x in val_docs if x)+'\n';corpus=train_corpus+'\n<|validation|>\n'+val_corpus
 out=ROOT/'data/pretraining';out.mkdir(parents=True,exist_ok=True);(out/'corpus.txt').write_text(corpus)
 if cfg['tokenizer']=='char':
  chars=sorted(set(corpus));stoi={c:i for i,c in enumerate(chars)};encode=lambda s:np.asarray([stoi[c] for c in s],dtype=np.uint16);vocab={'type':'char','itos':chars,'stoi':stoi};(ROOT/cfg['vocab_path']).write_text(json.dumps(vocab,ensure_ascii=False,indent=2)+'\n');vocab_size=len(chars);meta_path=out/'metadata.json'
 elif cfg['tokenizer']=='bpe':
  try:from tokenizers import Tokenizer
  except ImportError:raise SystemExit('Install tokenizers from requirements.txt first')
  tok_path=ROOT/cfg['vocab_path']
  if not tok_path.exists():raise SystemExit(f'Tokenizer missing: run tokenizer/train_tokenizer.py --config {args.config}')
  tok=Tokenizer.from_file(str(tok_path));vocab_size=tok.get_vocab_size()
  if vocab_size>65535:raise SystemExit('Vocabulary exceeds uint16 capacity')
  encode=lambda s:np.asarray(tok.encode(s).ids,dtype=np.uint16);meta_path=out/f'metadata-bpe-{vocab_size}.json'
 else:raise SystemExit(f"Unsupported tokenizer: {cfg['tokenizer']}")
 train_ids=encode(train_corpus);val_ids=encode(val_corpus)
 if len(train_ids)<cfg['block_size']+2 or len(val_ids)<cfg['block_size']+2:raise SystemExit('train/validation split is too small for block size')
 train_path=ROOT/cfg['train_data'];val_path=ROOT/cfg['val_data'];train_path.parent.mkdir(parents=True,exist_ok=True);val_path.parent.mkdir(parents=True,exist_ok=True);train_ids.tofile(train_path);val_ids.tofile(val_path)
 meta={'characters':len(train_corpus)+len(val_corpus),'train_characters':len(train_corpus),'val_characters':len(val_corpus),'tokens':int(len(train_ids)+len(val_ids)),'train_tokens':int(len(train_ids)),'val_tokens':int(len(val_ids)),'vocab_size':vocab_size,'deduplication':'exact_and_near_duplicate_document_units','deduplication_report':{'threshold':.88,'minimum_words':30,'exact_removed':duplicate_counts['exact'],'near_removed':duplicate_counts['near']},'split':'deterministic 95/5 deduplicated document units within every source; units do not cross splits','corpus_sha256':hash_bytes(corpus.encode()),'sources':provenance};meta_path.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n');print(json.dumps(meta,indent=2))
if __name__=='__main__':main()
