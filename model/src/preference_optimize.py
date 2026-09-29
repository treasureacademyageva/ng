#!/usr/bin/env python3
"""Minimal DPO stage for reviewed chosen/rejected pairs (character checkpoints)."""
from __future__ import annotations
import argparse,json,random
from pathlib import Path
import torch
from torch.nn import functional as F
from model import GPT,GPTConfig
ROOT=Path(__file__).resolve().parents[1]

def encoded(stoi,prompt,answer,block):
 prefix='<|user|>\n'+prompt+'\n<|assistant|>\n';text=prefix+answer+'\n';ids=[stoi[c] for c in text if c in stoi][-block:]
 x=torch.tensor(ids[:-1],dtype=torch.long);y=torch.tensor(ids[1:],dtype=torch.long)
 # Loss applies only where the answer begins, except when left truncation removes prompt.
 answer_start=max(0,len(ids)-len(answer)-1);mask=torch.arange(len(y))>=max(0,answer_start-1)
 return x,y,mask

def logprob(model,item,device):
 x,y,mask=item;x=x.to(device)[None,:];y=y.to(device);mask=mask.to(device);logits,_=model(x)
 lp=F.log_softmax(logits[0],dim=-1).gather(1,y[:,None]).squeeze(1);return lp[mask].mean()
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--config',default='config/sft-micro.json');ap.add_argument('--checkpoint',required=True);ap.add_argument('--pairs',default='data/preference/pairs.jsonl');ap.add_argument('--steps',type=int,default=100);ap.add_argument('--beta',type=float,default=.1);ap.add_argument('--lr',type=float,default=1e-5);args=ap.parse_args();random.seed(1337);torch.manual_seed(1337)
 cfg=json.loads((ROOT/args.config).read_text());v=json.loads((ROOT/cfg['vocab_path']).read_text());stoi=v['stoi'];dev=torch.device('cuda' if torch.cuda.is_available() else 'cpu');state=torch.load(ROOT/args.checkpoint,map_location=dev,weights_only=False)
 policy=GPT(GPTConfig(**state['model_config'])).to(dev);policy.load_state_dict(state['model']);ref=GPT(GPTConfig(**state['model_config'])).to(dev);ref.load_state_dict(state['model']);ref.eval();ref.requires_grad_(False);opt=torch.optim.AdamW(policy.parameters(),lr=args.lr,weight_decay=.01)
 pairs=[json.loads(x) for x in (ROOT/args.pairs).read_text().splitlines() if x.strip()];data=[(encoded(stoi,p['prompt'],p['chosen'],cfg['block_size']),encoded(stoi,p['prompt'],p['rejected'],cfg['block_size'])) for p in pairs]
 policy.train()
 for step in range(args.steps):
  chosen,rejected=random.choice(data);pc=logprob(policy,chosen,dev);pr=logprob(policy,rejected,dev)
  with torch.no_grad():rc=logprob(ref,chosen,dev);rr=logprob(ref,rejected,dev)
  loss=-F.logsigmoid(args.beta*((pc-pr)-(rc-rr)));opt.zero_grad();loss.backward();torch.nn.utils.clip_grad_norm_(policy.parameters(),1.0);opt.step()
  if step==0 or (step+1)%25==0:print(json.dumps({'step':step+1,'loss':loss.item(),'policy_margin':(pc-pr).item()}))
 out=ROOT/'checkpoints'/'micro-char-dpo-latest.pt';torch.save({'format_version':1,'step':args.steps,'model_config':state['model_config'],'config':cfg,'model':policy.state_dict(),'source_checkpoint':args.checkpoint,'beta':args.beta},out);print(out)
if __name__=='__main__':main()
