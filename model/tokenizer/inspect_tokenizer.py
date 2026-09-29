#!/usr/bin/env python3
import argparse,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main():
 ap=argparse.ArgumentParser();ap.add_argument('text',nargs='?',default='Treasure Academy teaches Primary Three mathematics in Okene.');ap.add_argument('--config',default='config/tiny.json');args=ap.parse_args()
 from tokenizers import Tokenizer
 cfg=json.loads((ROOT/args.config).read_text());t=Tokenizer.from_file(str(ROOT/cfg['vocab_path']));e=t.encode(args.text)
 print('ids:',e.ids);print('tokens:',e.tokens);print('decoded:',t.decode(e.ids));print('tokens/word:',len(e.ids)/max(1,len(args.text.split())))
if __name__=='__main__':main()
