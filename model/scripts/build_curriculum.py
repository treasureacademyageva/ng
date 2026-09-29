#!/usr/bin/env python3
"""Generate original, deterministic foundation lessons owned by the project."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
out=ROOT/"data/cleaned/original-foundations.txt";out.parent.mkdir(parents=True,exist_ok=True)
ones=["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"]
tens=["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"]
def word(n):
 if n<20:return ones[n]
 if n<100:return tens[n//10]+("-"+ones[n%10] if n%10 else "")
 if n==100:return "one hundred"
letters="abcdefghijklmnopqrstuvwxyz"
vowels=set("aeiou")
lines=["FOUNDATIONS: LETTERS, NUMBERS, WORDS AND PRIMARY MATHEMATICS\n"]
for c in letters:
 lines += [f"{c} is a lowercase letter.",f"{c.upper()} is the uppercase form of {c}.",f"The letter {c.upper()} comes {'first' if c=='a' else 'after '+letters[letters.index(c)-1].upper()} in this sequence.",f"{c.upper()} is {'a vowel' if c in vowels else 'a consonant'} in this lesson."]
for a,b in zip(letters,letters[1:]):lines.append(f"{a.upper()} comes before {b.upper()}. {b.upper()} comes after {a.upper()}.")
phonics={"a":"apple","b":"ball","c":"cat","d":"dog","e":"egg","f":"fish","g":"goat","h":"hat","i":"ink","j":"jug","k":"kite","l":"leaf","m":"mat","n":"net","o":"orange","p":"pen","q":"queen","r":"rain","s":"sun","t":"tree","u":"umbrella","v":"van","w":"water","x":"x-ray","y":"yam","z":"zebra"}
for c,x in phonics.items():lines += [f"{c.upper()} is for {x}.",f"The word {x} begins with {c.upper()}.",f"Spell {x}: {' '.join(x.upper())}."]
for n in range(101):lines += [f"The numeral {n} is written in words as {word(n)}.",f"{word(n).capitalize()} means {n}."]
for a in range(21):
 for b in range(21-a):
  lines.append(f"{a} plus {b} equals {a+b}.")
  lines.append(f"If you have {a+b} objects and take away {b}, {a} objects remain.")
for a in range(13):
 for b in range(13):lines.append(f"{a} times {b} equals {a*b}.")
for n in range(2,101):
 lines.append(f"{n} is {'even' if n%2==0 else 'odd'}.")
 if n>1: lines.append(f"One more than {n-1} is {n}. One less than {n} is {n-1}.")
lines += [
 "A sentence begins with a capital letter and ends with punctuation.",
 "A noun names a person, place, animal or thing.",
 "A verb can show an action or a state.",
 "An adjective describes a noun.",
 "A question asks for information and ends with a question mark.",
 "Nigeria is a country in West Africa.",
 "Abuja is the capital city of Nigeria.",
 "Nigeria has thirty-six states and the Federal Capital Territory.",
 "Kogi State is in the North Central region of Nigeria.",
 "Okene is a town in Kogi State.",
 "The River Niger and the River Benue meet at Lokoja.",
 "Water can be solid ice, liquid water or water vapour.",
 "Plants need water, air, light and suitable conditions to grow.",
 "The Earth moves around the Sun, and the Moon moves around the Earth.",
 "Wash your hands with clean water and soap.",
 "A child should tell a trusted adult when something feels unsafe.",
 "When information is missing, ask a clear question instead of guessing."
]
# Reframe facts as prompts without duplicating one fixed order.
base=list(lines[1:])
for s in base[:900]: lines.append("Learn and remember: "+s)
out.write_text("\n".join(lines)+"\n",encoding="utf-8")
print(out, f"{len(lines):,} lines", f"{out.stat().st_size:,} bytes")
