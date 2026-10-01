#!/usr/bin/env python3
"""Generate one deterministic AI-assisted draft for every approved pilot brief.

Draft text is private ignored staging. The committed pilot manifest records only
hashes and remains fail-closed: all human reviews stay pending and no draft is
approved for training.
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

from deduplication import NearDuplicateIndex

ROOT = Path(__file__).resolve().parents[1]
QUEUE = ROOT / "data/authoring/primary-math-english-briefs.csv"
PILOT = ROOT / "data/authoring/pilot-balanced-v1-review.csv"
OUTPUT = ROOT / "data/staging/authoring/pilot-v1-drafts.jsonl"
REPORT = ROOT / "reports/primary-draft-generation.json"

CONTEXTS = [
    "a classroom materials shelf", "a school garden", "a neighbourhood market", "a community library",
    "a family meal table", "a bus-stop timetable", "a clean-water station", "a local sports field",
    "a craft table", "a fruit stall", "a reading corner", "a school health club",
]


def words(text: str) -> int:
    return len(re.findall(r"[^\W_]+(?:['’][^\W_]+)?", text, re.UNICODE))


def math_material(topic: str, primary_class: int, index: int) -> tuple[str, str, list[str], list[str], list[str]]:
    lower = topic.casefold()
    context = CONTEXTS[index % len(CONTEXTS)]
    if "profit" in lower or "loss" in lower or "discount" in lower:
        concept = "Profit is selling price minus cost price. Loss is cost price minus selling price. A discount reduces the marked price; it does not change the meaning of cost price."
        worked = "A learning kit costs ₦2,400 and is sold for ₦2,700. Profit = ₦2,700 − ₦2,400 = ₦300. If a ₦3,000 item has a 10% discount, the discount is ₦300 and the customer pays ₦2,700."
        guided = ["Find the profit when cost is ₦1,500 and selling price is ₦1,850.", "Find the sale price after a 20% discount on ₦5,000."]
        independent = ["A trader loses ₦250 on an item that cost ₦2,000. Find the selling price.", "Explain why a discount is not automatically a loss."]
        answers = ["₦350", "₦4,000", "₦1,750", "A loss depends on cost price; a discount compares marked and sale prices."]
    elif "ratio" in lower or "proportion" in lower or "scale" in lower or "rates" in lower:
        concept = "A ratio compares quantities in the same order. Equivalent ratios multiply or divide both parts by the same non-zero number. A rate compares quantities with different units."
        worked = "A class display uses 2 blue cards for every 3 green cards. For 6 blue cards, multiply both parts by 3: 2:3 = 6:9. Nine green cards are needed."
        guided = ["Complete 4:5 = 12:__.", "A cyclist covers 18 km in 2 hours. Find the average kilometres per hour."]
        independent = ["Simplify 15:25.", "On a scale where 1 cm represents 4 km, what distance does 7 cm represent?"]
        answers = ["15", "9 km/h", "3:5", "28 km"]
    elif "probability" in lower or "mean" in lower or "statistics" in lower or "graphs" in lower or "charts" in lower or "data" in lower or "tables" in lower:
        if primary_class == 1:
            concept = "Data are facts we collect. We can sort objects by one clear feature, count each group and draw one picture for each object. A picture graph needs a title and labels."
            worked = "Sort six counters by colour: red, blue, red, green, blue, red. The groups have 3 red, 2 blue and 1 green counter. A picture graph can show three red marks, two blue marks and one green mark."
            guided = ["Sort circle, square, circle and triangle by shape.", "Which colour group in the model has the most counters?"]
            independent = ["Sort five classroom objects by a feature you can see.", "Draw a picture graph and state which group has the fewest objects."]
            answers = ["Circles: 2; square: 1; triangle: 1", "Red", "Answers vary but every object belongs to one clear group.", "The answer must agree with the learner's graph."]
        elif primary_class == 2:
            concept = "A tally records each observation once. Four vertical strokes and a fifth crossing stroke make a group of five. A table or pictograph then shows the totals clearly."
            worked = "Fruit choices are orange, mango, mango, banana, mango and orange. Tally and count: orange 2, mango 3, banana 1. Mango is most common and banana is least common."
            guided = ["Tally these scores: 1, 2, 1, 3, 1.", "How many choices were recorded in the model?"]
            independent = ["Collect ten fictional colour choices and make a tally table.", "Draw a pictograph where one symbol represents one choice."]
            answers = ["1 has 3 tallies; 2 and 3 have 1 each", "6", "Tallies must total 10.", "The pictograph totals must match the table."]
        elif primary_class == 3:
            concept = "A frequency table records how often each value occurs. A bar chart uses equal intervals, labelled axes and bars of equal width so that categories can be compared fairly."
            worked = "Four teams collected 3, 6, 4 and 5 books. On a bar chart, place team names on the horizontal axis and number of books on the vertical axis. The tallest bar is 6 for the second team."
            guided = ["Make a frequency table for 2, 3, 2, 4, 2.", "Which model team collected the fewest books?"]
            independent = ["Draw a bar chart for red 4, blue 2 and green 5.", "Write two statements that compare categories in your graph."]
            answers = ["2 occurs 3 times; 3 and 4 occur once each", "The first team, with 3 books", "Bars must reach 4, 2 and 5 on an equal scale.", "Statements must agree with the graph."]
        else:
            concept = "Data are collected observations. A table organises values, a graph displays them, and the mean is the total divided by the number of values. Probability describes how likely an event is."
            worked = "Four reading groups finished 6, 8, 7 and 9 pages. Total = 30 pages. Mean = 30 ÷ 4 = 7.5 pages. A bar chart should use an equal scale and labelled axes."
            guided = ["Find the mean of 4, 6 and 8.", "State the most frequent value in 2, 3, 3, 4, 5."]
            independent = ["Create a frequency table for 1, 2, 2, 3, 3, 3.", "A bag has 3 red and 2 blue counters. What is the probability of blue?"]
            answers = ["6", "3", "1 occurs once, 2 twice, 3 three times", "2/5"]
    elif "open sentences" in lower or "algebra" in lower or "number patterns" in lower or "skip counting" in lower:
        if primary_class <= 2:
            concept = "A number pattern follows a rule. Skip counting adds the same amount each time. Learners can use counters or a number line to identify what changes and continue the pattern."
            worked = "The pattern 5, 10, 15, 20 grows by 5 each time. The next terms are 25 and 30. On a number line, each jump has the same length."
            guided = ["Continue 2, 4, 6, __, __.", "State the rule for 10, 20, 30, 40."]
            independent = ["Continue 35, 40, 45 for three more terms.", "Create a pattern that adds 2 each time and write six terms."]
            answers = ["8, 10", "Add 10", "50, 55, 60", "Answers vary; each adjacent difference must be 2."]
        else:
            concept = "A number pattern follows a rule. An open sentence contains an unknown value. We find the unknown by keeping both sides balanced."
            worked = "The pattern 5, 10, 15, 20 grows by 5. The next terms are 25 and 30. For □ + 7 = 19, subtract 7 from both sides, so □ = 12."
            guided = ["Continue 12, 16, 20, __, __.", "Solve n − 9 = 14."]
            independent = ["Describe the rule for 3, 6, 12, 24.", "Solve 4 × m = 28."]
            answers = ["24, 28", "23", "Multiply by 2", "7"]
    elif ("fraction" in lower or "halves" in lower or "thirds" in lower or "quarters" in lower) and "decimal" not in lower and "percent" not in lower:
        if primary_class <= 2:
            concept = "A fraction names equal parts of one whole or equal parts of a set. A half means two equal parts, a third means three equal parts and a quarter means four equal parts. Unequal pieces do not form correct halves or quarters."
            worked = "Share 8 bottle tops equally between two trays. Each tray receives 4, so one half of 8 is 4. Fold a paper rectangle into four equal parts and shade one part to show one quarter."
            guided = ["Find one half of 10 counters.", "How many equal parts make one quarter?"]
            independent = ["Draw a shape divided into two equal parts and shade one half.", "Share 12 objects equally among four groups. How many are in one quarter?"]
            answers = ["5", "4", "The two parts must be equal.", "3"]
        else:
            concept = "A fraction names equal parts of one whole or equal parts of a set. The denominator tells the number of equal parts; the numerator tells how many parts are selected."
            worked = "Divide 12 oranges equally into 4 groups. Each group has 3 oranges, so one quarter of 12 is 3. Also, 1/2 and 2/4 are equivalent because they cover the same amount."
            guided = ["Find one third of 15.", "Write a fraction equivalent to 1/2."]
            independent = ["Add 2/5 + 1/5.", "Which is greater: 3/4 or 2/4? Explain."]
            answers = ["5", "For example 2/4", "3/5", "3/4 because the wholes and denominators are the same and 3 > 2"]
    elif "decimal" in lower or "percent" in lower:
        concept = "Decimals extend place value to tenths and hundredths. A percentage is a number of parts out of 100. Fractions, decimals and percentages can name the same value."
        worked = "0.75 means 75 hundredths, so 0.75 = 75/100 = 3/4 = 75%. For ₦12.50 + ₦3.25, align decimal points to obtain ₦15.75."
        guided = ["Write 0.4 as a fraction with denominator 10.", "Find 25% of 80."]
        independent = ["Order 0.6, 0.06 and 0.66.", "Convert 3/5 to a percentage."]
        answers = ["4/10", "20", "0.06, 0.6, 0.66", "60%"]
    elif "money" in lower or "naira" in lower or "budget" in lower or "savings" in lower or "transactions" in lower or "spending" in lower:
        if primary_class == 1:
            concept = "Naira amounts tell how much money is represented. We can combine simple amounts and compare which is more or less. A clock, calendar and money label each answer with its correct unit."
            worked = "A pencil costs ₦20 and an eraser costs ₦10. Together they cost ₦30. On a clock, the minute hand at 12 and hour hand at 3 show 3 o'clock; seven days make one week."
            guided = ["Combine ₦50 and ₦20.", "Name the day that comes after Monday."]
            independent = ["Choose two fictional prices below ₦100 and add them.", "Draw a clock that shows 6 o'clock."]
            answers = ["₦70", "Tuesday", "The sum must match the two chosen amounts.", "Minute hand at 12 and hour hand at 6"]
        elif primary_class == 2:
            concept = "Money calculations use addition to find a total and subtraction to find change. Write the naira sign, keep amounts in the same unit and check that change plus cost equals the amount paid."
            worked = "A book costs ₦120 and a pencil costs ₦50. Total = ₦170. Paying ₦200 gives ₦200 − ₦170 = ₦30 change, and ₦170 + ₦30 checks the payment."
            guided = ["Find the total of ₦75 and ₦40.", "Find the change from ₦500 after spending ₦320."]
            independent = ["Add three fictional prices below ₦200.", "Explain how addition can check a change calculation."]
            answers = ["₦115", "₦180", "Answers vary with correct addition.", "Cost plus change should equal the amount paid."]
        else:
            concept = "Money calculations use the same addition and subtraction rules as other numbers. A budget separates planned income, spending and savings. Amounts must be written clearly with the naira sign."
            worked = "Three notebooks cost ₦250 each. Total = 3 × ₦250 = ₦750. Paying ₦1,000 gives change of ₦1,000 − ₦750 = ₦250."
            guided = ["Find the total cost of two items at ₦175 each.", "Find the change from ₦2,000 after spending ₦1,260."]
            independent = ["Plan how to divide ₦1,500 between a ₦900 need and savings.", "Explain why a want should not replace an essential item in a small budget."]
            answers = ["₦350", "₦740", "For example ₦900 for the need and ₦600 saved", "Essential needs receive priority in a limited budget."]
    elif "area" in lower or "volume" in lower or "perimeter" in lower or "distance" in lower or "speed" in lower or "metric" in lower or "length" in lower or "mass" in lower or "capacity" in lower or "unit conversion" in lower:
        if primary_class == 1:
            concept = "Measurement compares objects using the same property. Length tells how long, mass tells how heavy and capacity tells how much a container can hold. Fair comparisons use the same unit each time."
            worked = "Place two pencils at the same starting line. The pencil that reaches farther is longer. If a book tips a balance pan downward against an eraser, the book is heavier."
            guided = ["Choose the better word for a bucket: full or empty.", "Measure a desk with equal paper clips placed end to end."]
            independent = ["Order three objects from shortest to longest.", "Name one container that holds more than a cup and explain your comparison."]
            answers = ["Either word may describe its current capacity; explain the observation.", "The answer is the counted number of paper clips with no gaps.", "Order must follow a direct comparison.", "For example a clean bucket; the comparison must use the same liquid or unit."]
        elif primary_class == 2:
            concept = "Standard units make measurements comparable. Centimetres and metres measure length, grams and kilograms measure mass, and millilitres and litres measure capacity. The chosen unit should suit the object."
            worked = "A crayon is 9 cm long, so centimetres are suitable. A classroom wall may be 6 m long, so metres are more convenient. A water bottle may hold 500 mL."
            guided = ["Choose cm or m for the length of a book.", "Choose mL or L for a spoonful of water."]
            independent = ["Measure two safe objects in centimetres and find the difference.", "Order 1 L, 500 mL and 250 mL from least to greatest."]
            answers = ["cm", "mL", "Answers depend on the measured objects.", "250 mL, 500 mL, 1 L"]
        elif primary_class == 3:
            concept = "Metric units describe length, mass and capacity. Perimeter is the total distance around a flat shape, found by adding all side lengths in the same unit."
            worked = "A rectangular card has sides 6 cm, 4 cm, 6 cm and 4 cm. Perimeter = 6 + 4 + 6 + 4 = 20 cm. The answer uses centimetres because perimeter is a length."
            guided = ["Find the perimeter of a square with 5 cm sides.", "Convert 2 m to centimetres."]
            independent = ["Find the perimeter of a 9 cm by 3 cm rectangle.", "Choose a suitable unit for the mass of a bag of rice and explain."]
            answers = ["20 cm", "200 cm", "24 cm", "Kilograms are suitable for a bag; the exact choice depends on its size."]
        else:
            concept = "Measurement compares a quantity with a standard unit. Perimeter measures distance around a shape, area measures surface covered, volume measures space occupied, and speed compares distance with time."
            worked = "A rectangular mat is 6 m long and 4 m wide. Perimeter = 2 × (6 + 4) = 20 m. Area = 6 × 4 = 24 m²."
            guided = ["Convert 3 m to centimetres.", "Find the area of a 7 cm by 5 cm rectangle."]
            independent = ["A 2 L container fills four equal cups. What is each cup's capacity?", "A bus covers 120 km in 3 hours. Find its average speed."]
            answers = ["300 cm", "35 cm²", "0.5 L or 500 mL", "40 km/h"]
    elif "angle" in lower or "shape" in lower or "polygon" in lower or "triangle" in lower or "quadrilateral" in lower or "coordinates" in lower or "symmetry" in lower or "geometry" in lower or "lines" in lower:
        if primary_class <= 2:
            concept = "Shapes can be named and sorted by visible properties. A circle is round, a triangle has three straight sides, and a rectangle has four straight sides. Solid objects can roll, slide or stack depending on their faces."
            worked = "Sort a coin shape, a rectangular card and a triangular cut-out. The coin shape is a circle with no straight side; the card has four sides; the triangle has three sides and three corners."
            guided = ["How many sides and corners does a triangle have?", "Name one solid object that can roll."]
            independent = ["Draw a circle, triangle, square and rectangle.", "Sort a safe set of objects into shapes that roll and shapes that stack."]
            answers = ["3 sides and 3 corners", "For example a ball or clean tin", "Each drawing must show the named properties.", "Grouping should follow the observed surfaces."]
        else:
            concept = "Geometry describes position, shape and space. Shapes are classified by properties such as sides, vertices, equal lengths, parallel lines, angles and lines of symmetry."
            worked = "A rectangle has four right angles and two pairs of opposite equal, parallel sides. Its diagonals are equal. A square has these properties and also has four equal sides."
            guided = ["Name a polygon with three sides.", "Classify an angle smaller than 90°."]
            independent = ["Plot (2, 3) and move two units right. State the new coordinate.", "Explain one difference between a rhombus and a square."]
            answers = ["Triangle", "Acute angle", "(4, 3)", "A square must have four right angles; a rhombus need not."]
    elif "time" in lower or "days" in lower or "months" in lower or "calendar" in lower:
        if primary_class <= 2:
            concept = "A clock shows time and a calendar organises days, weeks and months. The short clock hand shows the hour. At an exact hour, the long hand points to 12. Seven days make one week."
            worked = "At 4 o'clock, the short hand points to 4 and the long hand points to 12. If today is Wednesday, tomorrow is Thursday and yesterday was Tuesday."
            guided = ["Draw 8 o'clock on a clock face.", "How many days are in one week?"]
            independent = ["Name the day before Friday and the day after Friday.", "Choose a month on a calendar and count its days."]
            answers = ["Short hand at 8; long hand at 12", "7", "Thursday and Saturday", "The answer depends on the chosen month and calendar year."]
        else:
            concept = "Time can be read from clocks and calendars. Sixty minutes make one hour, twenty-four hours make one day, and elapsed time is the difference between starting and finishing times."
            worked = "An activity starts at 9:15 a.m. and ends at 10:00 a.m. From 9:15 to 10:00 is 45 minutes."
            guided = ["What time is two hours after 11:00 a.m.?", "How many days are in one week?"]
            independent = ["Find the elapsed time from 1:35 p.m. to 3:05 p.m.", "Use a calendar to identify the day seven days after a chosen date."]
            answers = ["1:00 p.m.", "7", "1 hour 30 minutes", "The weekday is the same one week later."]
    elif "factor" in lower or "multiple" in lower or "division" in lower or "multiplication" in lower or "equal groups" in lower:
        if primary_class == 2:
            concept = "Multiplication combines equal groups and division shares equally. Learners can draw groups, use repeated addition and check that every group has the same number."
            worked = "Three plates hold 4 counters each. Repeated addition gives 4 + 4 + 4 = 12, so 3 × 4 = 12. Sharing 12 counters equally among 3 plates gives 4 on each plate."
            guided = ["Find 5 groups of 2.", "Share 15 counters equally among 3 groups."]
            independent = ["Draw an array for 4 × 3.", "Write a multiplication and division fact for 20 objects in 5 equal groups."]
            answers = ["10", "5", "Four rows of 3 or three rows of 4 show 12.", "5 × 4 = 20 and 20 ÷ 5 = 4"]
        elif primary_class == 3:
            concept = "Multiplication facts describe equal groups, and division is the inverse operation. Arrays, skip counting and known facts help solve new facts and simple word problems."
            worked = "Six rows of 4 seedlings make 6 × 4 = 24 seedlings. Therefore 24 ÷ 6 = 4 and 24 ÷ 4 = 6. The related facts form one fact family."
            guided = ["Calculate 7 × 5.", "Use multiplication to solve 42 ÷ 6."]
            independent = ["Write the fact family for 8, 6 and 48.", "Five packets contain 9 cards each. Find the total."]
            answers = ["35", "7", "8 × 6 = 48, 6 × 8 = 48, 48 ÷ 8 = 6, 48 ÷ 6 = 8", "45 cards"]
        else:
            concept = "Multiplication combines equal groups. Division separates a quantity into equal groups or finds how many equal groups can be made. Factors divide a number exactly; multiples are products."
            worked = "Four trays hold 6 oranges each: 4 × 6 = 24. Sharing 24 oranges equally among 4 trays gives 24 ÷ 4 = 6."
            guided = ["Calculate 7 × 8.", "List the factors of 12."]
            independent = ["Find 156 ÷ 12.", "Write the first five multiples of 9."]
            answers = ["56", "1, 2, 3, 4, 6, 12", "13", "9, 18, 27, 36, 45"]
    elif "addition" in lower or "subtraction" in lower or "operations" in lower or "estimation" in lower:
        if primary_class == 1:
            concept = "Addition joins groups and subtraction removes objects or finds a difference. Counters, drawings and a number line help learners show what happened before writing a number sentence."
            worked = "There are 23 counters and 14 more are added. Combine tens and ones: 20 + 10 = 30 and 3 + 4 = 7, so 23 + 14 = 37. Removing 5 leaves 32."
            guided = ["Calculate 16 + 12 using tens and ones.", "Take 7 away from 25."]
            independent = ["Draw a number line to solve 31 + 6.", "Write and solve a subtraction story for 40 − 13."]
            answers = ["28", "18", "37", "The story must begin with 40, remove 13 and leave 27."]
        elif primary_class == 2:
            concept = "Addition combines quantities and subtraction finds what remains or the difference. Align hundreds, tens and units. Regroup ten units as one ten or ten tens as one hundred when needed."
            worked = "For 268 + 157, add units: 8 + 7 = 15, write 5 and regroup 1 ten. Add tens and hundreds to obtain 425. Check that the answer is larger than both addends."
            guided = ["Calculate 346 + 278.", "Calculate 700 − 265."]
            independent = ["Solve 509 + 184 and check by estimating.", "Write a word problem represented by 640 − 275."]
            answers = ["624", "435", "693; about 500 + 200 = 700", "Answers vary; the correct difference is 365."]
        else:
            concept = "Addition combines quantities and subtraction finds a difference or what remains. Place-value columns must align. Estimation helps us decide whether an exact answer is reasonable."
            worked = "For 2,468 + 1,735, align units, tens, hundreds and thousands. The exact sum is 4,203. Rounding to the nearest hundred gives 2,500 + 1,700 = 4,200, which checks the size."
            guided = ["Calculate 684 + 279.", "Estimate 1,982 − 613 to the nearest hundred."]
            independent = ["Calculate 5,004 − 2,786 and check by addition.", "Insert brackets to make 6 + 2 × 5 clear, then evaluate using order of operations."]
            answers = ["963", "About 1,400", "2,218", "Multiplication first gives 16; (6 + 2) × 5 gives 40."]
    else:
        limit = {1: 100, 2: 1000, 3: 10000, 4: 100000, 5: 1000000, 6: 10000000}[primary_class]
        concept = "Whole-number place value depends on position. Each place is ten times the place to its right. Reading, writing, comparing and expanding numbers all use this structure."
        if primary_class == 1:
            worked = "In 47, the digit 4 represents 4 tens or 40, and 7 represents 7 ones. Therefore 47 = 40 + 7. It is greater than 39 because 4 tens are greater than 3 tens."
            guided = ["Write 63 as tens and ones.", "Which is greater: 58 or 85?"]
            independent = ["Arrange 25, 52 and 42 from least to greatest.", "Write in figures: sixty-eight."]
            answers = ["6 tens and 3 ones, or 60 + 3", "85", "25, 42, 52", "68"]
        elif primary_class == 2:
            worked = "In 582, the digit 5 represents 500, 8 represents 80 and 2 represents 2. Therefore 582 = 500 + 80 + 2. Compare hundreds first when ordering three-digit numbers."
            guided = ["Write 307 in expanded form.", "State the value of 9 in 694."]
            independent = ["Arrange 405, 450 and 354 from least to greatest.", "Write in figures: seven hundred and nineteen."]
            answers = ["300 + 7", "90", "354, 405, 450", "719"]
        else:
            worked = f"In 4,582, the digit 4 represents 4,000, 5 represents 500, 8 represents 80 and 2 represents 2. Therefore 4,582 = 4,000 + 500 + 80 + 2. The class range extends to {limit:,}."
            guided = ["Write 6,307 in expanded form.", "State the value of 9 in 29,451."]
            independent = ["Arrange 4,205; 4,052; 4,520 from least to greatest.", "Write in figures: seven thousand and nineteen."]
            answers = ["6,000 + 300 + 7", "9,000", "4,052; 4,205; 4,520", "7,019"]
    intro = f"Use {context} as a familiar setting, but keep the numbers fictional and reusable. Learners should explain each step, name the operation or property used, and check whether the result is sensible."
    return concept, worked, guided, independent, answers + [intro]


def english_material(topic: str, primary_class: int, index: int) -> tuple[str, str, list[str], list[str], list[str]]:
    lower = topic.casefold()
    context = CONTEXTS[index % len(CONTEXTS)]
    if "letter names" in lower or "letter sounds" in lower:
        concept = "A letter has a name and can represent a sound. Learners should hear the first sound, say it clearly, connect it to the letter and use it in a simple word."
        model = "Say: moon, mat, mango. Each begins with /m/, written m. Contrast sun, sit, soap, which begin with /s/, written s. The letter name and the sound are related but not identical."
        guided = ["Say the first sound in fish, fan and five.", "Sort map, sun, milk and sock under m or s."]
        independent = ["Write three words beginning with b.", "Circle the word that begins with /t/: cup, top, bag."]
        answers = ["/f/", "m: map, milk; s: sun, sock", "Any suitable words such as ball, bed, bus", "top"]
    elif "blending" in lower or "digraph" in lower or "vowel patterns" in lower or "consonant blends" in lower:
        concept = "Blending joins spoken sounds to read a word; segmenting separates a word into sounds for spelling. A digraph uses two letters for one sound, while a blend keeps both sounds."
        model = "Blend /s/ /u/ /n/ to read sun. Segment shop as /sh/ /o/ /p/. In frog, /f/ and /r/ are both heard in the initial blend fr."
        guided = ["Blend /m/ /a/ /p/.", "Segment fish into its sounds."]
        independent = ["Underline the digraph in chair.", "Write one word beginning with bl and one ending with ng."]
        answers = ["map", "/f/ /i/ /sh/", "ch", "For example blue and sing"]
    elif "vocabulary" in lower or "synonym" in lower or "antonym" in lower or "figurative" in lower or "context" in lower or "unfamiliar words" in lower:
        if primary_class == 1:
            concept = "Vocabulary means the words we understand and use. Learners connect a printed word with an object, action or clear picture, then use the word in a short sentence."
            model = "Read and act: sit, stand, open, close. Match book, chair and bag to classroom objects. In 'Open the red book,' open is the action word and red tells which book."
            guided = ["Point to or draw a chair, then say a sentence with chair.", "Act the opposite actions open and close."]
            independent = ["Choose five classroom words and draw or label them.", "Use one chosen word in a complete spoken sentence."]
            answers = ["For example: The chair is blue.", "Actions should show contrasting meanings.", "Labels must match the pictures or objects.", "The sentence must communicate a complete thought."]
        elif primary_class == 2:
            concept = "Vocabulary grows when learners connect words to familiar home, school and community settings. Context and simple word relationships help clarify meaning."
            model = "In 'The basket was empty, so we put fruit inside,' the second part helps explain empty. School words may include lesson, library and playground; community words may include road, clinic and market."
            guided = ["Use market in a complete sentence.", "Give the opposite of empty."]
            independent = ["Group six words under home, school or community.", "Explain one new word using a drawing and a sentence."]
            answers = ["Answers vary with correct meaning.", "full", "Each word should fit the chosen setting.", "The drawing and sentence should show the same meaning."]
        else:
            concept = "Readers use surrounding words, examples and word parts to infer meaning. Synonyms have similar meanings; antonyms have contrasting meanings. Figurative language creates an image rather than always speaking literally."
            model = "In 'The narrow path allowed only one person through,' the phrase only one person helps us infer that narrow means not wide. Tiny is a synonym for small; enormous is an antonym."
            guided = ["Use context to explain sturdy in: The sturdy chair held the heavy box.", "Give a synonym for joyful."]
            independent = ["Give an antonym for scarce.", "Explain the image in: The morning sun painted the roofs gold."]
            answers = ["Strong or firmly made", "Happy or delighted", "Plentiful or abundant", "Sunlight made the roofs appear golden; no literal paint is used."]
    elif "noun" in lower or "pronoun" in lower or "parts of speech" in lower or "phrases" in lower or "clauses" in lower or "sentence structure" in lower or "subject" in lower and "predicate" in lower:
        if primary_class == 2:
            concept = "A complete sentence tells a whole idea. The subject names who or what the sentence is about, and the predicate tells what the subject does or is."
            model = "In 'The bell rang loudly,' the bell is the subject and rang loudly is the predicate. In 'Two pupils carry books,' two pupils is the subject and carry books is the predicate."
            guided = ["Identify the subject in: The red bus stopped.", "Identify the predicate in: Our class reads stories."]
            independent = ["Add a predicate to: The small bird ___.", "Add a subject to: ___ opened the box."]
            answers = ["The red bus", "reads stories", "For example: The small bird sang.", "For example: The teacher opened the box."]
        else:
            concept = "Words and groups of words have jobs in a sentence. A subject names who or what the sentence is about; a predicate tells what the subject does or is. A clause contains a subject and a verb."
            model = "In 'The careful pupils arranged the books,' pupils is the noun and subject, careful is an adjective, arranged is the verb, and the books completes the predicate. They can replace the pupils as a pronoun."
            guided = ["Identify the subject and verb in: The bell rang.", "Replace Amina and Tunde with a pronoun in a new sentence."]
            independent = ["Expand 'Birds fly' with an adjective and an adverb.", "State whether 'because the rain stopped' is a phrase or a clause."]
            answers = ["Subject: bell; verb: rang", "They", "For example: Bright birds fly swiftly.", "A clause, because it contains the subject rain and verb stopped."]
    elif "tense" in lower or "concord" in lower or "active voice" in lower or "passive voice" in lower or "verb forms" in lower:
        concept = "Verb tense locates an action in time. Subject–verb concord means the verb form agrees with its subject. Active voice foregrounds the doer; passive voice foregrounds the receiver."
        model = "Present: The pupil reads. Past: The pupil read yesterday. Future: The pupil will read tomorrow. Active: The club planted a tree. Passive: A tree was planted by the club."
        guided = ["Correct: The girls walks home.", "Change to past tense: We visit the library."]
        independent = ["Change to passive voice: The team cleaned the field.", "Write one sentence that keeps the same tense throughout."]
        answers = ["The girls walk home.", "We visited the library.", "The field was cleaned by the team.", "Answers vary but must be consistent."]
    elif "direct speech" in lower or "reported speech" in lower:
        concept = "Direct speech gives the speaker's exact words and uses quotation marks. Reported speech communicates the message without quoting every word; pronouns, tense and time expressions may change."
        model = "Direct: Ada said, 'I am ready today.' Reported: Ada said that she was ready that day. The reporting clause is separated correctly and the meaning is retained."
        guided = ["Punctuate: Musa said I found the key.", "Report: 'We will return tomorrow,' the visitors said."]
        independent = ["Write a two-line dialogue with correct punctuation.", "Change your dialogue to reported speech."]
        answers = ["Musa said, 'I found the key.'", "The visitors said that they would return the next day.", "Answers vary.", "Meaning, pronouns and tense should remain logical."]
    elif "capital" in lower or "punctuation" in lower or "question marks" in lower or "commas" in lower or "sentence types" in lower or "conjunction" in lower:
        if primary_class == 1:
            concept = "A complete sentence tells a whole idea. It begins with a capital letter and ends with a full stop for a statement or a question mark for a question."
            model = "Statement: The bag is red. Question: Is the bag red? Notice the capital letter at the beginning and the different mark at the end."
            guided = ["Correct: the cup is full", "Add an end mark: Where is my pencil"]
            independent = ["Write one short statement about a book.", "Write one question about a classroom object."]
            answers = ["The cup is full.", "Where is my pencil?", "Answer needs a capital letter and full stop.", "Answer needs a capital letter and question mark."]
        else:
            concept = "A complete sentence expresses a complete thought. Capital letters begin sentences and proper names. End marks show statement, question or strong feeling; commas and conjunctions help organise ideas."
            model = "Statement: The gate is open. Question: Is the gate open? Command: Please open the gate. Join related ideas: The rain stopped, so the match continued."
            guided = ["Correct: where is the red book", "Join with because: We went indoors. Rain began."]
            independent = ["Write one statement, question and command about a library.", "Add commas where needed: We packed pencils books rulers and paper."]
            answers = ["Where is the red book?", "We went indoors because rain began.", "Answers vary with correct end marks.", "We packed pencils, books, rulers and paper."]
    elif "summary" in lower or "note making" in lower or "précis" in lower or "key information" in lower:
        concept = "Notes capture key ideas in brief words or phrases. A summary restates the central meaning accurately and concisely, omitting repetition, examples and minor details."
        model = "Source: 'The club collected bottles on Monday and sorted them on Tuesday so that the compound would be cleaner.' Notes: club—collected/sorted bottles—cleaner compound. Summary: The club sorted collected bottles to clean the compound."
        guided = ["Underline the main action in the model source.", "Remove the day details without changing the central meaning."]
        independent = ["Write three notes from a short paragraph supplied by the teacher.", "Turn the notes into one clear sentence using your own wording."]
        answers = ["Collected and sorted bottles", "The club collected and sorted bottles to clean the compound.", "Answers depend on the supplied paragraph.", "Summary must be accurate, concise and original in wording."]
    elif "letter" in lower or "messages" in lower or "greetings" in lower or "invitations" in lower or "notices" in lower or "reports" in lower or "speeches" in lower or "practical communication" in lower or "instructions" in lower:
        concept = "Functional writing matches purpose, audience and format. It should state necessary facts clearly without private information, invented official claims or unnecessary detail."
        model = "Notice: READING CLUB MEETING. Date: Thursday. Time: 1:30 p.m. Place: Reading corner. Purpose: Choose next week's book. The heading and details let readers act without guessing."
        guided = ["Identify the purpose and audience of the model notice.", "Rewrite 'Come there later' with a clear time and place."]
        independent = ["Draft a short invitation to a fictional class display.", "Write three ordered instructions for caring for a shared book."]
        answers = ["Purpose: announce a meeting; audience: reading-club members", "Answers must supply a specific fictional time and place.", "Include event, fictional date/time/place and courteous wording.", "Use clear action verbs and logical order."]
    elif "main idea" in lower or "comprehension" in lower or "inference" in lower or "author purpose" in lower or "evidence" in lower or "sequencing events" in lower:
        concept = "Comprehension combines what a text states with careful reasoning. The main idea covers the whole passage; details support it; an inference must be supported by textual evidence."
        model = "Passage: 'Clouds gathered during practice. The coach looked at the sky and moved the cones indoors. Minutes later, heavy rain began.' Inference: The coach expected rain. Evidence: clouds gathered and the coach moved equipment indoors."
        guided = ["State the main event in the model passage.", "What happened first: rain began or the cones were moved?"]
        independent = ["Explain why the coach acted before the rain.", "State the author's likely purpose in one sentence."]
        answers = ["Practice equipment was moved indoors before rain.", "The cones were moved first.", "The clouds suggested rain was coming.", "To show how observing signs can guide a sensible decision."]
    elif "paragraph" in lower or "connected group" in lower or "composition" in lower or "narrative" in lower or "descriptive" in lower or "argumentative" in lower or "persuasive" in lower or "explanatory" in lower or "picture-guided" in lower:
        concept = "A composition has a clear purpose and logical order. A paragraph develops one controlling idea with supporting details and links. Narrative tells events; description creates a picture; explanation shows how or why; persuasion supports a position."
        model = "Topic sentence: Our reading corner became easier to use after we organised it. Supporting details: We labelled the shelves, grouped similar books and made a borrowing list. Closing sentence: Now readers find and return books quickly."
        guided = ["Identify the topic sentence in the model paragraph.", "Add one relevant supporting detail."]
        independent = [f"Plan a paragraph about improving {context}.", "Write a title, opening, ordered middle and closing; then revise one vague word."]
        answers = ["The first sentence", "For example: We placed damaged books in a repair box.", "Plan should stay on one central idea.", "Writing should match the selected form and maintain logical order."]
    elif "spelling" in lower or "syllables" in lower or "prefix" in lower or "suffix" in lower or "dictionary order" in lower or "word formation" in lower or "handwriting" in lower or "word families" in lower:
        if primary_class == 1:
            concept = "Words in a family share a spelling pattern and often rhyme. Clear handwriting forms each letter in the expected direction and leaves a space between words."
            model = "The words cat, mat and sat share the ending -at. Say each word slowly, listen for the first sound, then write the beginning letter and the shared ending."
            guided = ["Complete the family: pin, tin, __.", "Say and spell a word that rhymes with sun."]
            independent = ["Write three -og family words.", "Copy one short sentence with clear letter shapes and spaces."]
            answers = ["For example fin or win", "For example fun or run", "For example dog, log, fog", "Writing should be legible with spaces between words."]
        elif primary_class == 2:
            concept = "Spelling patterns help learners predict how related words are written. A syllable is a beat in a word, and alphabetical order compares letters from left to right."
            model = "Clap the syllables in ta-ble and mar-ket. Both have two beats. Put bag, ball and bat in alphabetical order by checking the third letter after the shared ba."
            guided = ["Divide window into syllables.", "Put sun, sit and sand in alphabetical order."]
            independent = ["Write four words in one spelling family.", "Arrange book, ball and bus in alphabetical order."]
            answers = ["win-dow", "sand, sit, sun", "Answers vary but must share a clear spelling pattern.", "ball, book, bus"]
        else:
            concept = "Spelling improves when learners hear syllables, notice word families and study meaningful word parts. A prefix comes before a base; a suffix follows it. Dictionary order compares letters from left to right."
            model = "Unhelpful = un + help + ful. The prefix un- means not; the suffix -ful means full of. In dictionary order, cart comes before cat because r comes before t at the first differing letter."
            guided = ["Divide remember into syllables.", "Add a prefix to make the opposite of possible."]
            independent = ["Put plant, plane, plain in dictionary order.", "Build two words from the base care using different affixes."]
            answers = ["re-mem-ber", "impossible", "plain, plane, plant", "For example careful and careless"]
    elif "listening" in lower or "speaking" in lower or "following short instructions" in lower:
        concept = "Good listening means attending to the whole message, remembering its order and asking politely when clarification is needed. Clear speaking uses an audible voice and complete, courteous sentences."
        model = "Instruction: Pick up the blue card, place it beside the book, then sit down. The listener identifies three actions and performs them in order without adding an unsafe or unrelated action."
        guided = ["Repeat the three model actions in order.", "Ask a polite clarification question about an unclear colour."]
        independent = ["Give a partner two safe classroom instructions.", "Retell one instruction in your own words without changing its meaning."]
        answers = ["Pick up; place; sit", "For example: Please, which blue card do you mean?", "Instructions should be safe, short and ordered.", "The paraphrase must retain the action and order."]
    else:
        concept = "Fluent reading combines accurate word recognition, suitable pace, phrasing and understanding. A reader pauses at punctuation and checks meaning instead of racing through words."
        model = f"Short passage: 'At {context}, the pupils found a labelled box. They read the label together, placed each item in the correct section and checked that nothing was missing.'"
        guided = ["Read the model aloud with pauses at punctuation.", "What did the pupils check at the end?"]
        independent = ["Give the passage a suitable title.", "Write one sentence stating its main idea."]
        answers = ["Pauses follow the full stops and comma.", "They checked that nothing was missing.", "For example: The Labelled Box", "The pupils used a label to organise and check items."]
    return concept, model, guided, independent, answers


LEARNING_VARIANTS = [
    "This lesson concentrates on {topic}. Begin with a quick, concrete prompt that reveals prior knowledge. By the end, learners should explain the key idea, complete an age-suitable example and show how they checked their response rather than merely repeat an answer.",
    "The focus is {topic}. Invite learners to share one relevant idea before any rule is given. Success means they can describe the concept in their own words, apply it independently and identify evidence that makes the result or wording reasonable.",
    "For this Primary {primary_class} session, the learning goal is {topic}. Start from a familiar example, listen for misconceptions and make the new step explicit. Learners demonstrate progress through an explanation, a correct application and a brief self-check.",
    "Use a short question about {topic} to find out what the class already understands. The intended outcome is not memorisation alone: each learner should connect the idea to a fresh task, communicate a method or reason and review the completed work.",
]
TEACHING_VARIANTS = [
    "Introduce the idea in small steps and pause for responses from different learners. Use only fictional people, amounts, dates and settings; no live school record or private detail belongs in the example. Supervise any ordinary classroom materials used.",
    "Model one manageable step, ask a learner to restate it, and then add the next step. Keep participation inclusive and correct an error without embarrassment. Every scenario is invented for teaching and makes no claim about a real pupil, family or official record.",
    "Move from a familiar situation to the formal idea, checking meaning after each move. Learners may answer orally, with a drawing or in writing where appropriate. Select low-risk materials and replace any request for personal information with a fictional alternative.",
    "Present a clear example and a contrasting non-example so that the important feature becomes visible. Encourage questions and precise language. The setting is deliberately fictional, contains no confidential school fact and can be changed by the human reviewer.",
]
MODEL_VARIANTS = [
    "After presenting the model, ask which step or language choice carries the main reasoning. Discuss one plausible mistake and let learners correct it. Understanding should be visible in the explanation, not inferred from copying the final line.",
    "Read through the model once, then cover its conclusion and reconstruct it with the class. Invite two learners to describe the route in different words. Check that both accounts preserve the same mathematical or language meaning.",
    "Pause before the model's final response and request a prediction. Compare the prediction with the demonstrated reasoning, locating any difference. If concrete materials are helpful, handle them safely and return attention to the underlying idea.",
    "Ask learners to retell the model as a sequence of decisions: what was noticed, which rule or clue was selected, and how the outcome was checked. A correct answer without a supportable reason is not yet the full lesson goal.",
]
GUIDED_VARIANTS = [
    "Give quiet thinking time before taking answers. Follow each response with a short reason question, then compare methods or wording where more than one route is valid. Correct misconceptions before moving to independent work.",
    "Work through the first prompt together and let pairs discuss the second. Ask a few pairs to report both their answer and evidence. Use disagreement to revisit the definition or rule rather than to guess by majority vote.",
    "Learners first mark what information matters, then attempt the tasks. Invite them to check a partner's reasoning courteously. The class should agree on a valid check, not simply on a shared final answer.",
    "Use a think, explain and verify routine. One learner proposes a response, another identifies the supporting clue or operation, and the group performs a check. Offer a smaller intermediate step to anyone who needs it.",
]
INDEPENDENT_VARIANTS = [
    "Learners complete these prompts individually and may use fictional details whenever a context is needed. Observe the process as well as the response, recording one idea that is secure and one point that may require reteaching.",
    "Ask each learner to attempt both items without copying. A drawing, table or short note may show thinking where suitable. Collect no private family information; an invented example is always an acceptable substitute.",
    "During individual work, prompt with questions rather than supplying an answer. Check whether the learner selected relevant information, followed a defensible method and reviewed the result. Plan a brief follow-up for any repeated misconception.",
    "These items provide the exit evidence for the lesson. Learners should work from the taught idea, make their reasoning visible and revise an answer if their check exposes a problem. Personal records and real financial details must not be used.",
]
CLOSING_VARIANTS = [
    "Close with one learner explanation and one short exit response. A qualified Nigerian primary teacher must check curriculum fit, examples and difficulty, while the safeguarding lead must check age fit and privacy. Until both named reviews pass, this remains an unapproved draft.",
    "End by asking what clue, rule or operation was most useful and why. Retain the exit work for a real teacher to assess. Separate named teacher and safeguarding decisions are still required; generating or hashing this text never grants training eligibility.",
    "Review the goal in the learners' own words and select one response that shows sound reasoning. Human reviewers may rewrite any example or instruction. Curriculum approval belongs to a qualified Nigerian primary teacher and safety approval to the designated safeguarding lead.",
    "Finish with a concise summary and ask learners to correct one sample mistake. The document now enters human review, not training. Teacher and safeguarding reviewers must be real, named and dated, and draft status must never be treated as approval.",
]


def build_content(row: dict[str, str], index: int) -> str:
    subject = row["subject"]
    primary_class = int(row["primary_class"])
    topic = row["topic"]
    if subject == "mathematics":
        concept, model, guided, independent, answers = math_material(topic, primary_class, index)
    else:
        concept, model, guided, independent, answers = english_material(topic, primary_class, index)
    digits = (index % 4, (index // 4) % 4, (index // 16) % 4, (index // 64) % 4)
    d0, d1, d2, d3 = digits
    learning_note = LEARNING_VARIANTS[d0].format(topic=topic.lower(), primary_class=primary_class)
    teaching_note = TEACHING_VARIANTS[(d0 + d1) % 4]
    model_note = MODEL_VARIANTS[(d0 + 2 * d1 + d2) % 4]
    guided_note = GUIDED_VARIANTS[(d0 + d1 + d2 + d3) % 4]
    independent_note = INDEPENDENT_VARIANTS[(d0 + 2 * d2 + d3) % 4]
    closing_note = CLOSING_VARIANTS[(d0 + d1 + 2 * d3) % 4]
    guided_text = "\n".join(f"{number}. {value}" for number, value in enumerate(guided, 1))
    independent_text = "\n".join(f"{number}. {value}" for number, value in enumerate(independent, 1))
    answer_text = "\n".join(f"{number}. {value}" for number, value in enumerate(answers, 1))
    return f"""PRIMARY {primary_class} {subject.upper()} DRAFT
Topic: {topic}
Status: AI-assisted draft for named human review; not approved for training.

LEARNING PURPOSE
{learning_note}

LESSON EXPLANATION
{concept}

{teaching_note}

MODEL OR WORKED EXAMPLE
{model}

{model_note}

GUIDED PRACTICE
{guided_text}

{guided_note}

INDEPENDENT PRACTICE
{independent_text}

{independent_note}

ANSWER AND REVIEW GUIDE
{answer_text}

CLOSING CHECK
{closing_note}
""".strip()


def main() -> None:
    with QUEUE.open(newline="", encoding="utf-8") as handle:
        briefs = list(csv.DictReader(handle))
    with PILOT.open(newline="", encoding="utf-8") as handle:
        pilot = list(csv.DictReader(handle))
        fields = list(pilot[0])
    by_brief = {row["brief_id"]: row for row in pilot}
    records = []
    for index, brief in enumerate(briefs):
        row = by_brief[brief["brief_id"]]
        content = build_content(brief, index)
        if words(content) < int(brief["target_words_per_document"]):
            raise SystemExit(f"{brief['brief_id']}: draft below target word count")
        digest = hashlib.sha256(content.encode("utf-8")).hexdigest()
        prior_hash = row.get("content_sha256", "")
        if prior_hash and prior_hash != digest:
            for prefix in ("teacher", "safeguarding"):
                row[f"{prefix}_decision"] = "PENDING"
                row[f"{prefix}_reviewer_name"] = ""
                row[f"{prefix}_reviewer_role"] = ""
                row[f"{prefix}_reviewed_at"] = ""
        row.update({
            "creator_type": "AI_ASSISTED",
            "draft_status": "DRAFTED",
            "content_sha256": digest,
            "approved_for_training": "false",
            "notes": "AI-assisted private draft generated from the owner-authorized brief; named teacher and safeguarding reviews remain PENDING.",
        })
        records.append({
            "sample_id": row["sample_id"],
            "brief_id": brief["brief_id"],
            "brief_sha256": brief["brief_sha256"],
            "subject": brief["subject"],
            "coverage_tag": brief["coverage_tag"],
            "primary_class": int(brief["primary_class"]),
            "title": f"Primary {brief['primary_class']} {brief['subject'].title()}: {brief['topic']}",
            "topic": brief["topic"],
            "language": "en-NG",
            "nigerian_context": True,
            "creator_type": "AI_ASSISTED",
            "responsible_creator": row["responsible_creator"],
            "rights_holder": row["rights_holder"],
            "rights_status": row["rights_status"],
            "created_at": "2026-09-30",
            "draft_status": "DRAFTED",
            "content": content,
            "characters": len(content),
            "words": words(content),
            "content_sha256": digest,
            "teacher_decision": row["teacher_decision"],
            "teacher_reviewer_name": row["teacher_reviewer_name"],
            "teacher_reviewer_role": row["teacher_reviewer_role"],
            "teacher_reviewed_at": row["teacher_reviewed_at"],
            "safeguarding_decision": row["safeguarding_decision"],
            "safeguarding_reviewer_name": row["safeguarding_reviewer_name"],
            "safeguarding_reviewer_role": row["safeguarding_reviewer_role"],
            "safeguarding_reviewed_at": row["safeguarding_reviewed_at"],
            "approved_for_training": row["approved_for_training"].lower() == "true",
        })
    duplicate_index = NearDuplicateIndex(threshold=0.88, min_words=30)
    near_duplicates = []
    for record in records:
        match = duplicate_index.add_or_match(record["sample_id"], record["content"])
        if match:
            near_duplicates.append({
                "duplicate_id": record["sample_id"], "kept_id": match.kept_id,
                "kind": match.kind, "similarity": match.similarity,
            })
    if near_duplicates:
        raise SystemExit(f"generated pilot contains {len(near_duplicates)} exact/near duplicate(s)")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text("".join(json.dumps(record, ensure_ascii=False) + "\n" for record in records), encoding="utf-8")
    with PILOT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(pilot)
    report = {
        "version": 1,
        "status": "AI_ASSISTED_PRIVATE_DRAFTS_NOT_TRAINING_APPROVED",
        "output": str(OUTPUT.relative_to(ROOT)),
        "output_sha256": hashlib.sha256(OUTPUT.read_bytes()).hexdigest(),
        "documents": len(records),
        "subjects": dict(Counter(record["subject"] for record in records)),
        "classes": dict(Counter(f"P{record['primary_class']}" for record in records)),
        "characters": sum(record["characters"] for record in records),
        "words": sum(record["words"] for record in records),
        "minimum_document_words": min(record["words"] for record in records),
        "maximum_document_words": max(record["words"] for record in records),
        "near_duplicate_threshold": 0.88,
        "exact_or_near_duplicate_documents": len(near_duplicates),
        "teacher_approved": sum(record["teacher_decision"] == "APPROVED" for record in records),
        "safeguarding_approved": sum(record["safeguarding_decision"] == "APPROVED" for record in records),
        "training_approved": sum(record["approved_for_training"] for record in records),
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
