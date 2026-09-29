#!/usr/bin/env python3
import argparse,json,math
from pathlib import Path
import numpy as np,torch
from model import GPT,GPTConfig
ROOT=Path(__file__).resolve().parents[1]
def get_batch(data,block,batch,device):
 ix=torch.randint(len(data)-block-1,(batch,));x=torch.stack([torch.tensor(np.asarray(data[i:i+block],dtype=np.int64)) for i in ix]);y=torch.stack([torch.tensor(np.asarray(data[i+1:i+1+block],dtype=np.int64)) for i in ix]);return x.to(device),y.to(device)
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--config',default='config/micro.json');ap.add_argument('--checkpoint',required=True);ap.add_argument('--batches',type=int,default=50);args=ap.parse_args();c=json.loads((ROOT/args.config).read_text());dev=torch.device('cuda' if torch.cuda.is_available() else 'cpu')
 state=torch.load(ROOT/args.checkpoint,map_location=dev,weights_only=False);m=GPT(GPTConfig(**state['model_config'])).to(dev);m.load_state_dict(state['model']);m.eval();data=np.memmap(ROOT/c['val_data'],dtype=np.uint16,mode='r');loss=[]
 with torch.no_grad():
  for _ in range(args.batches):x,y=get_batch(data,c['block_size'],c['batch_size'],dev);loss.append(m(x,y)[1].item())
 mean=float(np.mean(loss));result={'checkpoint':args.checkpoint,'step':state['step'],'validation_loss':mean,'perplexity':math.exp(min(20,mean)),'batches':args.batches,'parameters':m.parameter_count()};print(json.dumps(result,indent=2));out=ROOT/'runs'/'latest-evaluation.json';out.write_text(json.dumps(result,indent=2)+'\n')
if __name__=='__main__':main()
