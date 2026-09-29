#!/usr/bin/env python3
import argparse,json
from pathlib import Path
import torch
from model import GPT,GPTConfig
ROOT=Path(__file__).resolve().parents[1]
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--config',default='config/micro.json');ap.add_argument('--checkpoint',required=True);ap.add_argument('--prompt',default='The number two');ap.add_argument('--tokens',type=int,default=180);ap.add_argument('--temperature',type=float,default=.8);ap.add_argument('--top-k',type=int,default=40);args=ap.parse_args()
 cfg=json.loads((ROOT/args.config).read_text());dev=torch.device('cuda' if torch.cuda.is_available() else 'cpu')
 if cfg.get('tokenizer')=='bpe':
  from tokenizers import Tokenizer
  tok=Tokenizer.from_file(str(ROOT/cfg['vocab_path']));ids=tok.encode(args.prompt).ids;decode=lambda x:tok.decode(x)
 else:
  v=json.loads((ROOT/cfg['vocab_path']).read_text());stoi=v['stoi'];itos=v['itos'];missing=[c for c in args.prompt if c not in stoi]
  if missing:raise SystemExit('prompt has out-of-vocabulary characters: '+repr(sorted(set(missing))))
  ids=[stoi[c] for c in args.prompt];decode=lambda x:''.join(itos[i] for i in x)
 state=torch.load(ROOT/args.checkpoint,map_location=dev,weights_only=False);model=GPT(GPTConfig(**state['model_config'])).to(dev);model.load_state_dict(state['model']);model.eval();x=torch.tensor([ids],dtype=torch.long,device=dev);y=model.generate(x,args.tokens,args.temperature,args.top_k)[0].tolist();print(decode(y))
if __name__=='__main__':main()
