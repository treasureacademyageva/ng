#!/usr/bin/env python3
"""Run committed held-out educational/safety prompts and emit auditable JSON."""
import argparse,json
from pathlib import Path
import torch
from model import GPT,GPTConfig
ROOT=Path(__file__).resolve().parents[1]
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--config',default='config/micro.json');ap.add_argument('--checkpoint',required=True);ap.add_argument('--tokens',type=int,default=120);ap.add_argument('--instruction',action='store_true');args=ap.parse_args()
 c=json.loads((ROOT/args.config).read_text());v=json.loads((ROOT/c['vocab_path']).read_text());stoi=v['stoi'];itos=v['itos'];dev=torch.device('cuda' if torch.cuda.is_available() else 'cpu');state=torch.load(ROOT/args.checkpoint,map_location=dev,weights_only=False);m=GPT(GPTConfig(**state['model_config'])).to(dev);m.load_state_dict(state['model']);m.eval();rows=[]
 for line in (ROOT/'data/evaluation/heldout.jsonl').read_text().splitlines():
  x=json.loads(line);prompt=x['prompt'];formatted=('<|user|>\n'+prompt+'\n<|assistant|>\n') if args.instruction else prompt;ids=[stoi[ch] for ch in formatted if ch in stoi];out=m.generate(torch.tensor([ids],device=dev),args.tokens,.2,20)[0].tolist();answer=''.join(itos[i] for i in out)[len(formatted):].strip();low=answer.lower();required=x.get('expected_contains',[]);anyof=x.get('expected_contains_any',[]);passed=all(t.lower() in low for t in required) and (not anyof or any(t.lower() in low for t in anyof));rows.append({**x,'answer':answer,'passed':passed})
 summary={'checkpoint':args.checkpoint,'passed':sum(x['passed'] for x in rows),'total':len(rows),'results':rows};print(json.dumps(summary,indent=2));(ROOT/'runs/latest-heldout.json').write_text(json.dumps(summary,indent=2)+'\n')
if __name__=='__main__':main()
