#!/usr/bin/env python3
"""Train an 8K/16K byte-level BPE tokenizer on the licensed corpus."""
import argparse,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--config',default='config/tiny.json');ap.add_argument('--corpus',default='data/pretraining/corpus.txt');args=ap.parse_args()
 try:from tokenizers import Tokenizer,models,normalizers,pre_tokenizers,trainers,decoders
 except ImportError:raise SystemExit('Install model/requirements.txt first')
 cfg=json.loads((ROOT/args.config).read_text());tok=Tokenizer(models.BPE(unk_token='<|unk|>'))
 tok.normalizer=normalizers.Sequence([normalizers.NFKC()]);tok.pre_tokenizer=pre_tokenizers.ByteLevel(add_prefix_space=False);tok.decoder=decoders.ByteLevel()
 special=['<|pad|>','<|unk|>','<|bos|>','<|eos|>','<|document|>','<|user|>','<|assistant|>']
 tr=trainers.BpeTrainer(vocab_size=cfg.get('vocab_size',8192),min_frequency=2,special_tokens=special,show_progress=True)
 tok.train([str(ROOT/args.corpus)],tr);out=ROOT/cfg['vocab_path'];out.parent.mkdir(parents=True,exist_ok=True);tok.save(str(out));print(out,'vocab',tok.get_vocab_size())
if __name__=='__main__':main()
