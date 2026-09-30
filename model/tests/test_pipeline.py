import json,sys
from pathlib import Path
import numpy as np
import pytest
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))

def test_every_source_has_provenance_and_license():
 data=json.loads((ROOT/'data/sources.json').read_text())
 for s in data['sources']:
  assert s.get('id') and s.get('title') and s.get('creator') and s.get('license')

def test_unreviewed_language_is_not_training_approved():
 data=json.loads((ROOT/'data/sources.json').read_text())
 assert any(s.get('language')=='ha' and not s.get('reviewed') and not s.get('approved_for_training') for s in data['sources'])
 assert all(s.get('reviewed') for s in data['sources'] if s.get('approved_for_training'))

def test_siyavula_epubs_have_exact_license_and_training_gate():
 data=json.loads((ROOT/'data/sources.json').read_text());rows=[s for s in data['sources'] if s['id'].startswith('siyavula-natural-sciences-')]
 assert len(rows)==3
 assert all(s['kind']=='epub_text' and s['license']=='CC-BY-4.0' and s['approved_for_training'] for s in rows)

def test_retrieval_kb_not_memorised():
 data=json.loads((ROOT/'data/sources.json').read_text())
 kb=next(s for s in data['sources'] if s['id']=='treasure-public-kb')
 assert kb['approved_for_training'] is False
 meta_path=ROOT/'data/pretraining/metadata.json'
 if not meta_path.exists():pytest.skip('run scripts/prepare_data.py first')
 meta=json.loads(meta_path.read_text())
 assert kb['id'] not in {s['id'] for s in meta['sources']}
 assert all(s['train_paragraphs']>0 and s['validation_paragraphs']>0 for s in meta['sources'])
 assert meta['split'].startswith('deterministic 95/5')

def test_deterministic_token_split_is_usable():
 cfg=json.loads((ROOT/'config/micro.json').read_text())
 if not (ROOT/cfg['train_data']).exists():pytest.skip('run scripts/prepare_data.py first')
 train=np.memmap(ROOT/cfg['train_data'],dtype=np.uint16,mode='r');val=np.memmap(ROOT/cfg['val_data'],dtype=np.uint16,mode='r')
 assert len(train)>100_000 and len(val)>cfg['block_size']*10
 vocab=json.loads((ROOT/cfg['vocab_path']).read_text())
 assert int(max(train))<len(vocab['itos'])

def test_transformer_forward_shape():
 torch=pytest.importorskip('torch')
 from model import GPT,GPTConfig
 m=GPT(GPTConfig(vocab_size=92,block_size=16,n_layer=2,n_head=4,n_embd=32,dropout=0))
 x=torch.zeros((2,16),dtype=torch.long);logits,loss=m(x,x)
 assert logits.shape==(2,16,92) and loss.ndim==0 and m.parameter_count()>10_000
