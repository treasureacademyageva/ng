#!/usr/bin/env python3
"""Schema, arithmetic, duplication and leakage checks for evaluation v2."""
from __future__ import annotations
import argparse,json,re
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ACTIONS={'ANSWER','ASK_CLARIFICATION','USE_RETRIEVAL','REQUIRE_LOGIN','HAND_OFF_TO_HUMAN','REFUSE'}
def norm(s):return re.sub(r'[^a-z0-9]+',' ',s.casefold()).strip()
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--cases',default='data/evaluation/cases-v2.jsonl');args=ap.parse_args();p=ROOT/args.cases
 rows=[json.loads(x) for x in p.read_text().splitlines() if x.strip()];errors=[];ids=set();prompts={};cats=Counter();acts=Counter()
 for line,row in enumerate(rows,1):
  rid=row.get('id');cat=row.get('category');action=row.get('expected_action');turns=row.get('turns') or []
  if not rid or rid in ids:errors.append(f'line {line}: duplicate/missing id {rid}')
  ids.add(rid);cats[cat]+=1;acts[action]+=1
  if action not in ACTIONS:errors.append(f'{rid}: invalid action {action}')
  if not turns or turns[-1].get('role')!='user':errors.append(f'{rid}: final turn must be user')
  final=norm(turns[-1].get('content','')) if turns else ''
  if final in prompts:errors.append(f'{rid}: duplicate final prompt with {prompts[final]}')
  prompts[final]=rid
  if action=='ANSWER' and not row.get('expected_answer'):errors.append(f'{rid}: ANSWER has no expected answer')
  if set(map(str.casefold,row.get('expected_contains',[])))&set(map(str.casefold,row.get('forbidden_contains',[]))):errors.append(f'{rid}: required and forbidden text overlap')
  m=row.get('metadata',{})
  if 'operation' in m:
   a,b=m['a'],m['b'];want={'add':a+b,'subtract':a-b,'multiply':a*b,'divide':a//b}[m['operation']]
   if want!=m.get('answer') or str(want) not in row.get('expected_contains',[]):errors.append(f'{rid}: arithmetic answer mismatch')
  combined=json.dumps(row,ensure_ascii=False)
  if re.search(r'\b(?:\d[ -]?){10,16}\b',combined):errors.append(f'{rid}: possible live phone/account number')
 if not 200<=len(rows)<=300:errors.append(f'total {len(rows)} outside 200..300')
 if any(v<8 for v in cats.values()):errors.append('every category needs at least eight cases')
 if set(acts)!=ACTIONS:errors.append('not every action is represented')
 # Exact final-prompt leakage against generated instruction files when available.
 train_prompts=set()
 for fp in [ROOT/'data/instruction/train.jsonl',ROOT/'data/instruction/val.jsonl']:
  if fp.exists():
   for x in fp.read_text().splitlines():
    if not x.strip():continue
    d=json.loads(x);msgs=d.get('messages',[])
    if msgs:train_prompts.add(norm(msgs[0].get('content','')))
 leaked=[rid for q,rid in prompts.items() if q in train_prompts]
 if leaked:errors.append('exact instruction leakage: '+','.join(leaked[:10]))
 report={'total':len(rows),'categories':dict(sorted(cats.items())),'actions':dict(sorted(acts.items())),'exact_instruction_prompt_leaks':len(leaked),'errors':errors}
 print(json.dumps(report,indent=2));raise SystemExit(1 if errors else 0)
if __name__=='__main__':main()
