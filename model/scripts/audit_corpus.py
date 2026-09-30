#!/usr/bin/env python3
"""Quantify source/language/subject balance and reject premature long runs."""
from __future__ import annotations
import argparse,json
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--metadata',default='data/pretraining/metadata-bpe-8192.json');ap.add_argument('--config',default='config/tiny.json');ap.add_argument('--parameters',type=int,default=13980672);ap.add_argument('--output',default='runs/corpus-audit.json');args=ap.parse_args();meta=json.loads((ROOT/args.metadata).read_text());cfg=json.loads((ROOT/args.config).read_text());manifest={x['id']:x for x in json.loads((ROOT/'data/sources.json').read_text())['sources']};subjects=Counter();languages=Counter();sources=[]
 for x in meta['sources']:
  m=manifest[x['id']];subjects[m['subject']]+=x['characters'];languages[m['language']]+=x['characters'];sources.append({'id':x['id'],'characters':x['characters'],'share':x['characters']/meta['characters'],'subject':m['subject'],'language':m['language'],'license':m['license']})
 train=meta['train_tokens'];tokens_step=cfg['batch_size']*cfg['block_size']*cfg['gradient_accumulation'];max_presented=cfg['max_steps']*tokens_step;reasons=[]
 if train<10_000_000:reasons.append('fewer than 10 million unique BPE training tokens')
 if max(subjects.values())/meta['characters']>.5:reasons.append('one subject family exceeds 50% of characters')
 if not any('social' in x for x in subjects):reasons.append('no dedicated reviewed Nigerian social-studies source')
 if sum(v for k,v in languages.items() if k in {'en-NG','ha','ig','yo'})/meta['characters']<.3:reasons.append('Nigerian language/context sources are under 30% of characters')
 report={'characters':meta['characters'],'bpe_tokens':meta['tokens'],'train_bpe_tokens':train,'parameters':args.parameters,'unique_train_tokens_per_parameter':train/args.parameters,'subjects_characters':dict(subjects),'languages_characters':dict(languages),'sources':sources,'configured_tokens_per_step':tokens_step,'corpus_equivalent_passes_in_100_steps':100*tokens_step/train,'corpus_equivalent_passes_at_max_steps':max_presented/train,'long_run_ready':not reasons,'blocking_reasons':reasons,'decision':'DO NOT AUTHORISE LONG RUN' if reasons else 'ELIGIBLE FOR REVIEW; NOT AUTOMATICALLY AUTHORISED'};out=ROOT/args.output;out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
if __name__=='__main__':main()
