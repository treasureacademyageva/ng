#!/usr/bin/env python3
from __future__ import annotations
import argparse,hashlib,json,math,os,random,time
from datetime import datetime,timezone
from pathlib import Path
import numpy as np
import torch
from model import GPT,GPTConfig
ROOT=Path(__file__).resolve().parents[1]

def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def load_cfg(path):
 c=json.loads(path.read_text())
 if c.get('tokenizer')=='bpe':
  from tokenizers import Tokenizer
  c['vocab_size']=Tokenizer.from_file(str(ROOT/c['vocab_path'])).get_vocab_size()
 else:
  v=json.loads((ROOT/c['vocab_path']).read_text());c['vocab_size']=len(v['itos'])
 return c
def device_for(x):
 if x!='auto':return torch.device(x)
 if torch.cuda.is_available():return torch.device('cuda')
 if hasattr(torch.backends,'mps') and torch.backends.mps.is_available():return torch.device('mps')
 return torch.device('cpu')
def cosine_lr(step,c):
 if step<c['warmup_steps']:return c['learning_rate']*(step+1)/max(1,c['warmup_steps'])
 ratio=min(1,max(0,(step-c['warmup_steps'])/max(1,c['max_steps']-c['warmup_steps'])))
 return c['min_learning_rate']+0.5*(1+math.cos(math.pi*ratio))*(c['learning_rate']-c['min_learning_rate'])
def batch(data,c,device):
 high=len(data)-c['block_size']-1
 if high<=0:raise ValueError('token file is shorter than block_size')
 ix=torch.randint(high,(c['batch_size'],))
 x=torch.stack([torch.from_numpy(np.asarray(data[i:i+c['block_size']],dtype=np.int64)) for i in ix])
 y=torch.stack([torch.from_numpy(np.asarray(data[i+1:i+1+c['block_size']],dtype=np.int64)) for i in ix])
 return x.to(device),y.to(device)
@torch.no_grad()
def evaluate(model,data,c,device):
 model.eval();losses=[]
 for _ in range(c['eval_batches']):
  x,y=batch(data,c,device);_,loss=model(x,y);losses.append(loss.item())
 model.train();return float(np.mean(losses))
def save(path,model,opt,step,c,run_id):
 state={'format_version':1,'step':step,'run_id':run_id,'model_config':model.config.__dict__,'config':c,'model':model.state_dict(),'optimizer':opt.state_dict(),'torch_rng':torch.get_rng_state(),'saved_at':datetime.now(timezone.utc).isoformat(),'vocab_sha256':digest(ROOT/c['vocab_path']),'train_data_sha256':digest(ROOT/c['train_data'])}
 tmp=path.with_suffix('.tmp');torch.save(state,tmp);os.replace(tmp,path)

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--config',default='config/micro.json');ap.add_argument('--max-steps',type=int);ap.add_argument('--resume',help='Continue the same run, including optimizer and step');ap.add_argument('--init-from',help='Start a new run from model weights only (for SFT)');args=ap.parse_args()
 if args.resume and args.init_from:raise SystemExit('Choose --resume or --init-from, not both')
 cfg_path=(ROOT/args.config).resolve();c=load_cfg(cfg_path)
 if args.max_steps:c['max_steps']=args.max_steps
 random.seed(c['seed']);np.random.seed(c['seed']);torch.manual_seed(c['seed'])
 dev=device_for(c.get('device','auto'));print('device',dev)
 mc=GPTConfig(**{k:c[k] for k in ('vocab_size','block_size','n_layer','n_head','n_embd','dropout')});model=GPT(mc).to(dev)
 print(f"parameters {model.parameter_count():,}")
 opt=torch.optim.AdamW(model.parameters(),lr=c['learning_rate'],betas=(.9,.95),weight_decay=c['weight_decay'])
 start=0;run_id=datetime.now().strftime('%Y%m%d-%H%M%S')+'-'+c['name']
 if args.resume:
  state=torch.load(ROOT/args.resume,map_location=dev,weights_only=False);model.load_state_dict(state['model']);opt.load_state_dict(state['optimizer']);start=state['step'];run_id=state['run_id'];print('resumed',start,run_id)
 elif args.init_from:
  state=torch.load(ROOT/args.init_from,map_location=dev,weights_only=False)
  if state['model_config']!=mc.__dict__:raise ValueError('initial checkpoint architecture does not match config')
  model.load_state_dict(state['model']);print('initialised weights from',args.init_from,'at source step',state.get('step'))
 run=ROOT/'runs'/run_id;run.mkdir(parents=True,exist_ok=True);(run/'config.json').write_text(json.dumps(c,indent=2)+'\n')
 train=np.memmap(ROOT/c['train_data'],dtype=np.uint16,mode='r');val=np.memmap(ROOT/c['val_data'],dtype=np.uint16,mode='r')
 metrics=run/'metrics.jsonl';model.train();started=time.time()
 for step in range(start,c['max_steps']):
  lr=cosine_lr(step,c)
  for g in opt.param_groups:g['lr']=lr
  opt.zero_grad(set_to_none=True);total=0.0
  for _ in range(c['gradient_accumulation']):
   x,y=batch(train,c,dev);_,loss=model(x,y);(loss/c['gradient_accumulation']).backward();total+=loss.item()/c['gradient_accumulation']
  torch.nn.utils.clip_grad_norm_(model.parameters(),c['grad_clip']);opt.step();done=step+1
  record={'step':done,'train_loss':total,'lr':lr,'elapsed_seconds':round(time.time()-started,2)}
  if done==1 or done%c['eval_interval']==0 or done==c['max_steps']:
   record['val_loss']=evaluate(model,val,c,dev);record['val_perplexity']=math.exp(min(20,record['val_loss']))
   print(json.dumps(record),flush=True)
  with metrics.open('a') as f:f.write(json.dumps(record)+'\n')
  if done%c['checkpoint_interval']==0 or done==c['max_steps']:
   ck=ROOT/'checkpoints'/f"{c['name']}-step{done:07d}.pt";save(ck,model,opt,done,c,run_id);save(ROOT/'checkpoints'/f"{c['name']}-latest.pt",model,opt,done,c,run_id);print('checkpoint',ck)
 summary={'run_id':run_id,'steps':c['max_steps'],'parameters':model.parameter_count(),'device':str(dev),'elapsed_seconds':round(time.time()-started,2),'checkpoint':f"checkpoints/{c['name']}-latest.pt"};(run/'state.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
if __name__=='__main__':main()
