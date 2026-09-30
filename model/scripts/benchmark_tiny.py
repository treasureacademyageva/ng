#!/usr/bin/env python3
"""100-step GPU benchmark for the ~14M Treasure EDU tiny model."""
from __future__ import annotations
import argparse,hashlib,json,math,platform,sys,time
from datetime import datetime,timezone
from pathlib import Path
import numpy as np
import torch
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'src'))
from model import GPT,GPTConfig

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def get_batch(data,batch_size,block_size,device):
 high=len(data)-block_size-1
 ix=torch.randint(high,(batch_size,))
 x=torch.stack([torch.from_numpy(np.asarray(data[i:i+block_size],dtype=np.int64)) for i in ix])
 y=torch.stack([torch.from_numpy(np.asarray(data[i+1:i+1+block_size],dtype=np.int64)) for i in ix])
 return x.to(device),y.to(device)
@torch.no_grad()
def evaluate(model,data,batch_size,block_size,device,batches,autocast):
 model.eval();loss=[]
 for _ in range(batches):
  x,y=get_batch(data,batch_size,block_size,device)
  with autocast():loss.append(model(x,y)[1].item())
 model.train();return float(np.mean(loss))
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--config',default='config/tiny.json');ap.add_argument('--steps',type=int,default=100);ap.add_argument('--warmup-steps',type=int,default=5);ap.add_argument('--eval-batches',type=int,default=10);ap.add_argument('--batch-size',type=int);ap.add_argument('--block-size',type=int);ap.add_argument('--gradient-accumulation',type=int);ap.add_argument('--target-steps',type=int,default=50000);ap.add_argument('--hourly-cost-usd',type=float);ap.add_argument('--provider',default='');ap.add_argument('--instance',default='');ap.add_argument('--allow-cpu',action='store_true');ap.add_argument('--output',default='runs/tiny-gpu-benchmark.json');args=ap.parse_args()
 cfg=json.loads((ROOT/args.config).read_text());torch.manual_seed(cfg['seed']);np.random.seed(cfg['seed'])
 cuda=torch.cuda.is_available()
 if not cuda and not args.allow_cpu:raise SystemExit('CUDA GPU required. Re-run on GPU hardware; --allow-cpu is smoke-test only.')
 if cuda and args.steps!=100:raise SystemExit('Official GPU benchmark must run exactly 100 optimizer steps.')
 if cuda and args.hourly_cost_usd is None:raise SystemExit('Official GPU benchmark requires --hourly-cost-usd (use 0 only for a genuinely free instance).')
 device=torch.device('cuda' if cuda else 'cpu');batch_size=args.batch_size or cfg['batch_size'];block_size=args.block_size or cfg['block_size'];grad_acc=args.gradient_accumulation or cfg['gradient_accumulation']
 from tokenizers import Tokenizer
 tok=Tokenizer.from_file(str(ROOT/cfg['vocab_path']));vocab_size=tok.get_vocab_size();mc=GPTConfig(vocab_size=vocab_size,block_size=cfg['block_size'],n_layer=cfg['n_layer'],n_head=cfg['n_head'],n_embd=cfg['n_embd'],dropout=cfg['dropout']);model=GPT(mc).to(device);opt=torch.optim.AdamW(model.parameters(),lr=cfg['learning_rate'],betas=(.9,.95),weight_decay=cfg['weight_decay'])
 train=np.memmap(ROOT/cfg['train_data'],dtype=np.uint16,mode='r');val=np.memmap(ROOT/cfg['val_data'],dtype=np.uint16,mode='r')
 if cuda:
  props=torch.cuda.get_device_properties(0);gpu={'name':torch.cuda.get_device_name(0),'vram_gb':round(props.total_memory/2**30,2),'compute_capability':f'{props.major}.{props.minor}'}
  dtype=torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
  def autocast():return torch.autocast(device_type='cuda',dtype=dtype)
  torch.cuda.reset_peak_memory_stats();torch.cuda.synchronize()
 else:
  gpu={'name':'CPU SMOKE TEST ONLY','vram_gb':0,'compute_capability':None}
  from contextlib import nullcontext
  def autocast():return nullcontext()
 scaler=torch.amp.GradScaler('cuda',enabled=cuda and dtype==torch.float16) if cuda else None
 before=evaluate(model,val,batch_size,block_size,device,args.eval_batches,autocast);losses=[];times=[];tokens_per_step=batch_size*block_size*grad_acc;model.train()
 for step in range(args.steps):
  start=time.perf_counter();opt.zero_grad(set_to_none=True);total=0
  for _ in range(grad_acc):
   x,y=get_batch(train,batch_size,block_size,device)
   with autocast():_,loss=model(x,y);loss=loss/grad_acc
   (scaler.scale(loss) if scaler else loss).backward();total+=loss.item()
  if scaler:
   scaler.unscale_(opt);torch.nn.utils.clip_grad_norm_(model.parameters(),cfg['grad_clip']);scaler.step(opt);scaler.update()
  else:
   torch.nn.utils.clip_grad_norm_(model.parameters(),cfg['grad_clip']);opt.step()
  if cuda:torch.cuda.synchronize()
  elapsed=time.perf_counter()-start;losses.append(total);times.append(elapsed)
  if step==0 or (step+1)%10==0:print(json.dumps({'step':step+1,'loss':round(total,5),'seconds':round(elapsed,4)}),flush=True)
 after=evaluate(model,val,batch_size,block_size,device,args.eval_batches,autocast)
 measured=times[min(args.warmup_steps,len(times)-1):] or times;seconds_per_step=float(np.mean(measured));tokens_per_second=tokens_per_step/seconds_per_step;hours=args.target_steps*seconds_per_step/3600
 prompt='A good learner asks';ids=torch.tensor([tok.encode(prompt).ids],device=device);sample=tok.decode(model.generate(ids,100,.8,40)[0].tolist())
 report={'kind':'GPU' if cuda else 'CPU_SMOKE_ONLY','timestamp':datetime.now(timezone.utc).isoformat(),'platform':platform.platform(),'torch_version':torch.__version__,'cuda_runtime':torch.version.cuda if cuda else None,'cudnn_version':torch.backends.cudnn.version() if cuda else None,'provider':args.provider or None,'instance':args.instance or None,'gpu':gpu,'precision':str(dtype).replace('torch.','') if cuda else 'float32','config':cfg['name'],'parameters':model.parameter_count(),'vocab_size':vocab_size,'dataset':{'train_tokens':len(train),'validation_tokens':len(val),'train_sha256':sha(ROOT/cfg['train_data']),'validation_sha256':sha(ROOT/cfg['val_data'])},'benchmark':{'steps':args.steps,'warmup_steps_excluded':min(args.warmup_steps,len(times)-1),'batch_size':batch_size,'block_size':block_size,'gradient_accumulation':grad_acc,'tokens_per_step':tokens_per_step,'seconds_per_step':seconds_per_step,'tokens_per_second':tokens_per_second,'initial_training_loss':losses[0],'final_training_loss':losses[-1],'mean_first_10_training_loss':float(np.mean(losses[:10])),'mean_final_10_training_loss':float(np.mean(losses[-10:])),'initial_validation_loss':before,'final_validation_loss':after,'peak_allocated_vram_gb':round(torch.cuda.max_memory_allocated()/2**30,3) if cuda else 0,'peak_reserved_vram_gb':round(torch.cuda.max_memory_reserved()/2**30,3) if cuda else 0},'projection':{'target_steps':args.target_steps,'estimated_hours':hours,'hourly_cost_usd':args.hourly_cost_usd,'estimated_cost_usd':hours*args.hourly_cost_usd if args.hourly_cost_usd is not None else None},'sample':sample,'long_run_authorised':False,'notes':['Benchmark only; it does not authorise a long run.','Review dataset size, balance, samples and evaluation results before training.']}
 out=ROOT/args.output;out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n');print(json.dumps(report,indent=2,ensure_ascii=False))
if __name__=='__main__':main()
