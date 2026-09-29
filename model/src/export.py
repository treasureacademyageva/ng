#!/usr/bin/env python3
"""Export inference-only weights and a model card; never exports optimizer state."""
import argparse,json,shutil
from datetime import datetime,timezone
from pathlib import Path
import torch
ROOT=Path(__file__).resolve().parents[1]
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--checkpoint',required=True);ap.add_argument('--name',default='treasure-edu-micro');args=ap.parse_args();state=torch.load(ROOT/args.checkpoint,map_location='cpu',weights_only=False);out=ROOT/'exports'/args.name;out.mkdir(parents=True,exist_ok=True)
 torch.save({'format_version':1,'model_config':state['model_config'],'model':state['model'],'step':state['step']},out/'model.pt')
 vocab=ROOT/state['config']['vocab_path'];shutil.copy2(vocab,out/vocab.name)
 card={'name':args.name,'architecture':'decoder-only causal transformer','from_random_weights':True,'training_step':state['step'],'parameters':sum(x.numel() for x in state['model'].values()),'created_at':datetime.now(timezone.utc).isoformat(),'intended_use':'research and educational tutoring behind deterministic safety and retrieval controls','not_for':'authentication, private records, payments, emergency decisions, or unsupervised high-stakes use','license_note':'Weights inherit unresolved obligations from the listed corpus sources; do not distribute until a legal review of data/source-lock.json.'}
 (out/'model-card.json').write_text(json.dumps(card,indent=2)+'\n');print(out)
if __name__=='__main__':main()
