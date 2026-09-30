#!/usr/bin/env python3
"""Validate a measured 100-step benchmark and derive review metrics."""
from __future__ import annotations
import argparse,hashlib,json,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 ap=argparse.ArgumentParser();ap.add_argument('report',nargs='?',default='results/tiny-gpu-benchmark-t4-20260930.json');args=ap.parse_args();p=Path(args.report);p=p if p.is_absolute() else ROOT/p;r=json.loads(p.read_text());b=r.get('benchmark',{});d=r.get('dataset',{});proj=r.get('projection',{});errors=[];warnings=[]
 def need(condition,message):
  if not condition:errors.append(message)
 need(r.get('kind')=='GPU','kind must be GPU');need(b.get('steps')==100,'benchmark must contain exactly 100 steps');need(r.get('parameters')==13_980_672,'unexpected parameter count');need(r.get('vocab_size')==8192,'unexpected vocabulary size');need(r.get('long_run_authorised') is False,'benchmark must not authorise a long run');need(b.get('tokens_per_step')==b.get('batch_size',0)*b.get('block_size',0)*b.get('gradient_accumulation',0),'tokens_per_step mismatch')
 if b.get('seconds_per_step',0)>0:need(abs(b['tokens_per_second']-b['tokens_per_step']/b['seconds_per_step'])<1e-6,'throughput arithmetic mismatch')
 else:errors.append('seconds_per_step must be positive')
 if proj.get('target_steps') and b.get('seconds_per_step'):need(abs(proj['estimated_hours']-proj['target_steps']*b['seconds_per_step']/3600)<1e-9,'duration projection mismatch')
 for key in ('initial_training_loss','final_training_loss','initial_validation_loss','final_validation_loss'):
  need(isinstance(b.get(key),(int,float)) and math.isfinite(b[key]),f'{key} must be finite')
 if b.get('final_validation_loss',math.inf)>=b.get('initial_validation_loss',-math.inf):warnings.append('validation loss did not improve')
 if not str(r.get('sample','')).strip():errors.append('generated sample missing')
 hash_checks={}
 for key,name in [('train_sha256','bpe-train.bin'),('validation_sha256','bpe-val.bin')]:
  local=ROOT/'data/pretraining'/name
  if local.exists():hash_checks[key]=sha(local)==d.get(key);need(hash_checks[key],f'{name} hash mismatch')
 passes=100*b.get('tokens_per_step',0)/d.get('train_tokens',1);projected=proj.get('target_steps',0)*b.get('tokens_per_step',0)/d.get('train_tokens',1)
 out={'report_sha256':sha(p),'schema_and_arithmetic_valid':not errors,'local_hash_checks':hash_checks,'tokens_presented_100_steps':100*b.get('tokens_per_step',0),'corpus_equivalent_passes_100_steps':passes,'projected_corpus_passes':projected,'final_validation_perplexity':math.exp(b['final_validation_loss']) if isinstance(b.get('final_validation_loss'),(int,float)) else None,'errors':errors,'warnings':warnings,'long_run_authorised':False};print(json.dumps(out,indent=2));raise SystemExit(1 if errors else 0)
if __name__=='__main__':main()
