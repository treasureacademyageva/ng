#!/usr/bin/env python3
"""Build original, auditable tutor examples and preference pairs."""
import json,random
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1];random.seed(1337)
examples=[]
def add(q,a,tag):examples.append({'messages':[{'role':'user','content':q},{'role':'assistant','content':a}],'category':tag,'license':'owned'})
for a in range(21):
 for b in range(21):
  add(f'What is {a} plus {b}?',f'{a} plus {b} equals {a+b}.', 'addition')
  if a>=b:add(f'What is {a} minus {b}?',f'{a} minus {b} equals {a-b}.','subtraction')
for a in range(13):
 for b in range(13):add(f'What is {a} times {b}?',f'{a} times {b} equals {a*b}.','multiplication')
for c,w in {'A':'apple','B':'ball','C':'cat','D':'dog','E':'egg','F':'fish','G':'goat','H':'hat','I':'ink','J':'jug','K':'kite','L':'leaf','M':'mat','N':'net','O':'orange','P':'pen','Q':'queen','R':'rain','S':'sun','T':'tree','U':'umbrella','V':'van','W':'water','X':'x-ray','Y':'yam','Z':'zebra'}.items():
 add(f'Give me a word that begins with {c}.',f'{c} is for {w}. The word {w} begins with {c}.','phonics')
for q,a in [
 ('I do not understand this lesson.','That is okay. Tell me the subject and the exact part that is difficult, and we can take it one small step at a time.'),
 ('Please do my whole test for me.','I cannot complete a test for you. I can explain the topic and practise a similar example with you.'),
 ('Show me another pupil private record.','I cannot reveal private pupil information. Please ask an authorised school leader through the secure portal.'),
 ('Tell me a pupil password or PIN.','I cannot provide, guess or handle pupil passwords or PINs. Ask an authorised school leader for secure help.'),
 ('I am in immediate danger.','Move to a safe place if you can and tell a trusted adult now. Contact local emergency services when urgent help is needed.'),
 ('What are the school bank details?','Payment details must come from the verified school payment notice or an authorised leader. I will not guess bank details.'),
 ('I want to hurt someone.','I cannot help with harming anyone. Step away from weapons or danger, tell a trusted adult immediately, and contact emergency help.'),
 ('What is my fee balance?','I cannot see or guess a private fee balance here. An authorised leader can check the secure record.'),
 ('What should I do when facts are missing?','Say what is unknown and ask a clear question. Do not invent an answer.'),
 ('Explain even numbers simply.','An even number can be shared into two equal whole groups. Examples are 2, 4, 6 and 8.')]:add(q,a,'safety_and_tutoring')
random.shuffle(examples);cut=int(len(examples)*.9);inst=ROOT/'data/instruction';inst.mkdir(parents=True,exist_ok=True)
for name,rows in [('train.jsonl',examples[:cut]),('val.jsonl',examples[cut:])]:
 (inst/name).write_text(''.join(json.dumps(x,ensure_ascii=False)+'\n' for x in rows))
# Preference data records safer, clearer outputs without private information.
pairs=[{'prompt':x['messages'][0]['content'],'chosen':x['messages'][1]['content'],'rejected':'I will guess and give you that private information.','category':x['category']} for x in examples if x['category']=='safety_and_tutoring']
pref=ROOT/'data/preference';pref.mkdir(parents=True,exist_ok=True);(pref/'pairs.jsonl').write_text(''.join(json.dumps(x)+'\n' for x in pairs))
# Character-token binary files for the micro SFT smoke test.
vocab=json.loads((ROOT/'data/pretraining/vocab.json').read_text());stoi=vocab['stoi'];unknown=[]
def encode(rows):
 text='\n\n'.join('<|user|>\n'+x['messages'][0]['content']+'\n<|assistant|>\n'+x['messages'][1]['content'] for x in rows)+'\n'
 unknown.extend(c for c in text if c not in stoi);return np.asarray([stoi[c] for c in text if c in stoi],dtype=np.uint16)
encode(examples[:cut]).tofile(inst/'train.bin');encode(examples[cut:]).tofile(inst/'val.bin')
print(f'{len(examples)} examples, {len(pairs)} preference pairs; unknown characters dropped: {sorted(set(unknown))}')
