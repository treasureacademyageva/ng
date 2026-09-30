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
# Broader primary mathematics with varied totals, exact division, fractions and measures.
for total in range(21,101):
 for part in range(0,total+1,3):
  other=total-part
  lines += [f"{part} plus {other} equals {total}.",f"If a group of {total} counters is split into {part} and {other}, the two parts still total {total}.",f"{total} minus {part} equals {other}."]
for divisor in range(1,13):
 for quotient in range(1,13):
  product=divisor*quotient
  lines += [f"{product} divided by {divisor} equals {quotient}.",f"Sharing {product} objects equally among {divisor} groups gives {quotient} objects in each group."]
for denominator in range(2,13):
 for numerator in range(1,denominator):
  lines.append(f"The fraction {numerator}/{denominator} means {numerator} equal part{'s' if numerator!=1 else ''} out of {denominator} equal parts.")
for n in range(100,1001,10):
 hundreds=n//100;tens=(n%100)//10;units=n%10
 lines.append(f"In {n}, the hundreds digit is {hundreds}, the tens digit is {tens}, and the units digit is {units}.")
for n in range(1,101):
 lines += [f"{n} centimetres is {n/100:g} metres.",f"{n} groups of ten contain {n*10} objects."]

# Original language examples use familiar Nigerian names and British spelling.
actions=[("Amina","reads","a short story"),("Chidi","counts","the bottle tops"),("Efe","waters","the garden"),("Hauwa","draws","a bright circle"),("Ife","carries","a blue bag"),("Tunde","opens","the classroom window"),("Zainab","writes","a clear sentence"),("Ojo","sorts","the red counters")]
for subject,verb,obj in actions:
 lines += [f"{subject} {verb} {obj}.",f"In the sentence '{subject} {verb} {obj}', {subject} is the subject and {verb} is the verb.",f"Who {verb} {obj}? {subject} does."]
word_families={"-at":["bat","cat","hat","mat","sat"],"-en":["den","hen","men","pen","ten"],"-ig":["big","dig","fig","pig","wig"],"-op":["hop","mop","pop","top"],"-un":["bun","fun","run","sun"]}
for family,words in word_families.items():
 lines.append(f"The {family} word family includes {', '.join(words)}.")
 for w in words:lines.append(f"Spell {w}: {' '.join(w.upper())}.")

# Short original comprehension records keep answers adjacent to their source text.
passages=[
 ("Amina planted three bean seeds in moist soil. She placed the pot near light and checked the soil each morning. After several days, a green shoot appeared.",[("What did Amina plant?","Three bean seeds."),("Where did she place the pot?","Near light."),("What appeared?","A green shoot.")]),
 ("Chidi had twelve counters. He shared them equally among three friends. Each friend received four counters.",[("How many counters were there?","Twelve."),("How many friends shared them?","Three."),("How many did each friend receive?","Four.")]),
 ("Hauwa saw dark clouds before break time. She took her books indoors. Soon, rain fell on the playground.",[("What did Hauwa see?","Dark clouds."),("Where did she take her books?","Indoors."),("What happened next?","Rain fell.")]),
 ("Tunde borrowed a library book on Monday. He kept it clean, read it carefully, and returned it on Friday.",[("What did Tunde borrow?","A library book."),("How did he treat it?","He kept it clean and read it carefully."),("When did he return it?","Friday.")]),
 ("Zainab filled one cup with clean water and another with sandy water. She could see through the clean water more easily.",[("How many cups did Zainab fill?","Two."),("Which water was easier to see through?","The clean water."),("What was in the other cup?","Sandy water.")]),
 ("Efe counted five birds on a wall. Two flew away, so three birds remained.",[("How many birds were there first?","Five."),("How many flew away?","Two."),("How many remained?","Three.")]),
 ("Ojo measured a pencil with a ruler. One end was at zero and the other was at fifteen centimetres.",[("What did Ojo measure?","A pencil."),("Which tool did he use?","A ruler."),("How long was the pencil?","Fifteen centimetres.")]),
 ("Ife washed her hands with soap and clean water before eating. She rubbed between her fingers and rinsed them well.",[("When did Ife wash her hands?","Before eating."),("What did she use?","Soap and clean water."),("Where did she rub?","Between her fingers.")])]
for passage,questions in passages:
 lines.append("Reading passage: "+passage)
 for question,answer in questions:lines.append(f"Question: {question} Answer: {answer}")

lines += [
 "A sentence begins with a capital letter and ends with punctuation.",
 "A noun names a person, place, animal or thing.",
 "A verb can show an action or a state.",
 "An adjective describes a noun.",
 "A question asks for information and ends with a question mark.",
 "Nigeria is a country in West Africa.",
 "Abuja is the capital city of Nigeria.",
 "Nigeria has thirty-six states and the Federal Capital Territory.",
 "The colours of Nigeria's flag are green, white and green.",
 "Nigeria became independent on 1 October 1960.",
 "The naira is Nigeria's currency.",
 "Kogi State is in the North Central region of Nigeria.",
 "Okene is a town in Kogi State.",
 "The River Niger and the River Benue meet at Lokoja.",
 "A community is a group of people who live or work in the same area.",
 "People in a community can cooperate to solve shared problems.",
 "Rules explain what people should or should not do in a place.",
 "A responsible citizen respects other people and public property.",
 "A map represents a place using a smaller scale.",
 "The four main compass directions are north, east, south and west.",
 "A map key explains the meaning of symbols on a map.",
 "Water can be solid ice, liquid water or water vapour.",
 "Melting changes a solid into a liquid.",
 "Freezing changes a liquid into a solid.",
 "Evaporation changes liquid water into water vapour.",
 "Plants need water, air, light and suitable conditions to grow.",
 "Roots can anchor a plant and absorb water and minerals from soil.",
 "Leaves can use light, water and carbon dioxide to make food for a plant.",
 "Animals need suitable food, water, air and shelter.",
 "A habitat is the place where an organism lives.",
 "A food chain shows how energy passes from one organism to another.",
 "The Earth moves around the Sun, and the Moon moves around the Earth.",
 "The Sun is a star and is the main source of light and heat for Earth.",
 "A push or a pull is a force.",
 "Sound is made by vibrations.",
 "Transparent materials let most light pass through.",
 "An electrical circuit needs a complete path for current to flow.",
 "Wash your hands with clean water and soap.",
 "A child should tell a trusted adult when something feels unsafe.",
 "When information is missing, ask a clear question instead of guessing."
]
# Reframe facts as prompts without duplicating one fixed order.
base=list(lines[1:])
for s in base[:900]: lines.append("Learn and remember: "+s)
out.write_text("\n".join(lines)+"\n",encoding="utf-8")
print(out, f"{len(lines):,} lines", f"{out.stat().st_size:,} bytes")
