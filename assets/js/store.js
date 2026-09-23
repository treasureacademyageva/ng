/* ============================================================
   TREASURE ACADEMY, AGEVA — data engine (demo backend)
   Uses localStorage so the whole portal works without a server.
   ============================================================ */
const DB_KEY = "treasure_db_v5";
const OLD_DB_KEYS = ["treasure_db_v4","treasure_db_v3","sunnydays_db_v2","sunnydays_db_v1"];
const SESSION_KEY = "treasure_session_v1";
const REMEMBER_KEY = "treasure_remember_v1";

const SCHOOL_DEFAULTS = {
  name: "Treasure Academy, Ageva",
  levels: "Creche • Pre-Nursery • Nursery • Primary",
  motto: "Our God is able",
  address: "Opposite Morak Pure-Water Factory, Ageva, Kogi State",
  phone: "+234 814 194 378",
  email: "treasuregroupofschool@gmail.com",
  hours: "Mon – Fri • 7:30am – 3:00pm",
  term: "First Term",
  session: "2026/2027 Session",
  headName: "Mrs. Salihu Nanahawa",
  headTitle: "Headmistress",
  founder: "Shaibu Sidikat Ruth",
  founded: 2015,
  bank: {name:"", number:"", holder:""},
  moniepoint: {account:"", bank:"Moniepoint MFB", pos:true, monnifyKey:""},
  videoUrl: "",
  headDob: "",
  gradDate: "2027-07-23",
  formFee: 5000,
  emergency: {on:false, text:"", start:"", end:""},
  photoWeek: {src:"", cap:""},
  fees: {Creche:30000,"Pre-Nursery":25000,"Nursery 1":25000,"Nursery 2":25000,"Primary 1":30000,"Primary 2":30000,"Primary 3":30000,"Primary 4":35000,"Primary 5":35000,"Primary 6":35000}
};

const CLASSES = ["Creche","Pre-Nursery","Nursery 1","Nursery 2","Primary 1","Primary 2","Primary 3","Primary 4","Primary 5","Primary 6"];
const EARLY_CLASSES = ["Creche","Pre-Nursery","Nursery 1","Nursery 2"];
const SUBJECTS_EARLY = ["Literacy","Numeracy","Phonics","Rhymes & Songs","Social Habits","Health Habits","C.R.S","Computer"];
const SUBJECTS_PRIMARY = ["English Language","Mathematics","Basic Science","Social Studies","C.R.S","Nigerian Language","Computer Studies","Creative Arts","P.H.E"];
const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday"];
const FORMER_SEED = []; /* batch41: demo names retired - real former staff come from the Headmistress (chat) */
const STAFF_WALL_SEED = [
      {id:"W01", name:"Mr Idris Ibrahim", class:"Primary 3", position:"Mathematics Teacher", quals:"HND Computer Science (2017)", started:null, subjects:["Computer Science","Mathematics"], about:"The maths desk of the school - every Common Entrance drill on numbers passes his table."},
      {id:"W02", name:"Mrs Zeenatudeen Uthman", class:"Primary 6", position:"Class Teacher", quals:"B.Agric Crop Science (2020)", started:null, subjects:["English Language","Mathematics","Basic Science"], about:"Guides our oldest pupils through the Common Entrance season with steady, quiet confidence."},
      {id:"W03", name:"Jimoh Mariam", class:"Primary 2", position:"Class Teacher", quals:"ND Chemistry (2020)", started:null, subjects:["Mathematics","Basic Science"], about:"Brings the eye of a young chemist to Primary 2 - plenty of small experiments and neat jotters."},
      {id:"W04", name:"Nasirun Yahaya", class:"Nursery 1", position:"Class Teacher", quals:"B.Sc Local Govt & Dev. Studies (2014)", started:null, subjects:["Literacy","Numeracy","Phonics"], about:"Warm and organised - her Nursery 1 pupils learn order and letters without ever being rushed."},
      {id:"W05", name:"Tahab Oyiza Zainab", class:"Primary 4", position:"Class Teacher", quals:"NCE Business Education (2010)", started:null, subjects:["Business Studies","Basic Science"], about:"Our most senior certificate on the wall - Primary 4 keeps tidy records and busy hands."},
      {id:"W06", name:"Salihu Oyiza Nanahawa", class:"Creche", position:"Class Teacher", quals:"NCE Home Economics (2014)", started:null, subjects:["Rhymes & Songs","Social Habits"], about:"Home-economist running the calmest creche room in town - meals, naps and rhymes on time."},
      {id:"W07", name:"Rebeca Omeiza", class:"Primary 5", position:"Class Teacher", quals:"Social Studies (2012)", started:null, subjects:["Social Studies","English Language"], about:"Maps, flags and our town story - Primary 5 narrates Kogi to you by heart."},
      {id:"W08", name:"Siyaka Bose", class:"Nursery 2", position:"Class Teacher", quals:"Secondary, Sciences (2012)", started:null, subjects:["Literacy","Numeracy","Phonics"], about:"A science hand in Nursery 2 - little nature walks turn into big discoveries."},
      {id:"W09", name:"David O Esther", class:"Pre-Nursery", position:"Class Teacher", quals:"ND Art (2012)", started:null, subjects:["Creative Arts","Rhymes & Songs"], about:"Every pre-nursery wall bears his African Art strokes - painting days are the loudest."},
      {id:"W10", name:"Bose Momoh", class:"", position:"School Administrator", quals:"ND Business Administration (2007)", started:null, subjects:[], about:"Keeps the diary, the visitors book and every registration neatly in place."}
];
const GRADS_SEED = [
      {id:"GS1", adm:"", pin:null, password:null, name:"ABDULLAHI, FARIDA AHUDOIZA", gender:"Female", class:"Graduated", dob:"2016-01-05", parent:"", phone:"08039689663", gradYear:2025, examNo:"BS/OKN/141001", exam:{eng:66,mat:70,gep:80,total:216}, subjects:["ENG","MAT","GEP"]},
      {id:"GS2", adm:"", pin:null, password:null, name:"ABDULSALAMI, MUFIDAT OZAVIZE", gender:"Female", class:"Graduated", dob:"2015-01-02", parent:"", phone:"08133716280", gradYear:2025, examNo:"BS/OKN/141002", exam:{eng:66,mat:66,gep:78,total:210}, subjects:["ENG","MAT","GEP"]},
      {id:"GS3", adm:"", pin:null, password:null, name:"ADAMS, ABDULKHALIQ OGIRIMA", gender:"Male", class:"Graduated", dob:"2015-01-19", parent:"", phone:"08032711175", gradYear:2025, examNo:"BS/OKN/141003", exam:{eng:62,mat:76,gep:78,total:216}, subjects:["ENG","MAT","GEP"]},
      {id:"GS4", adm:"", pin:null, password:null, name:"ADINOYI, FAUZIYAT ONONO", gender:"Female", class:"Graduated", dob:"2014-10-14", parent:"", phone:"08100808775", gradYear:2025, examNo:"BS/OKN/141004", exam:{eng:46,mat:72,gep:82,total:200}, subjects:["ENG","MAT","GEP"]},
      {id:"GS5", adm:"", pin:null, password:null, name:"ALIYU, ABDULHAKEEM ADEIZA", gender:"Male", class:"Graduated", dob:"2013-02-28", parent:"", phone:"07068251396", gradYear:2025, examNo:"BS/OKN/141005", exam:{eng:38,mat:64,gep:80,total:182}, subjects:["ENG","MAT","GEP"]},
      {id:"GS6", adm:"", pin:null, password:null, name:"ALIYU, ABDULMUTALIB ADEIZA", gender:"Male", class:"Graduated", dob:"2014-01-05", parent:"", phone:"07068251396", gradYear:2025, examNo:"BS/OKN/141006", exam:{eng:62,mat:60,gep:68,total:190}, subjects:["ENG","MAT","GEP"]},
      {id:"GS7", adm:"", pin:null, password:null, name:"ALIYU, ABDULQUDUS OGIRIMA", gender:"Male", class:"Graduated", dob:"2015-02-18", parent:"", phone:"08039688812", gradYear:2025, examNo:"BS/OKN/141007", exam:{eng:64,mat:74,gep:66,total:204}, subjects:["ENG","MAT","GEP"]},
      {id:"GS8", adm:"", pin:null, password:null, name:"ALIYU, AWWAL ADAVIZE", gender:"Male", class:"Graduated", dob:"2014-05-07", parent:"", phone:"08039688812", gradYear:2025, examNo:"BS/OKN/141008", exam:{eng:62,mat:66,gep:72,total:200}, subjects:["ENG","MAT","GEP"]},
      {id:"GS9", adm:"", pin:null, password:null, name:"AROKE, ZULFADR ONYISA", gender:"Female", class:"Graduated", dob:"2014-01-05", parent:"", phone:"08039689663", gradYear:2025, examNo:"BS/OKN/141009", exam:{eng:60,mat:70,gep:74,total:204}, subjects:["ENG","MAT","GEP"]},
      {id:"GS10", adm:"", pin:null, password:null, name:"ILYAS, HIKMAH ONONO", gender:"Female", class:"Graduated", dob:"2014-07-12", parent:"", phone:"08077033916", gradYear:2025, examNo:"BS/OKN/141010", exam:{eng:60,mat:50,gep:74,total:184}, subjects:["ENG","MAT","GEP"]},
      {id:"GS11", adm:"", pin:null, password:null, name:"ISAH, MUHIB ADINOYI", gender:"Male", class:"Graduated", dob:"2013-12-16", parent:"", phone:"08065239116", gradYear:2025, examNo:"BS/OKN/141011", exam:{eng:44,mat:66,gep:72,total:182}, subjects:["ENG","MAT","GEP"]},
      {id:"GS12", adm:"", pin:null, password:null, name:"ISMAILA, NAIMA IZE", gender:"Female", class:"Graduated", dob:"2014-04-13", parent:"", phone:"07052298989", gradYear:2025, examNo:"BS/OKN/141012", exam:{eng:50,mat:72,gep:86,total:208}, subjects:["ENG","MAT","GEP"]},
      {id:"GS13", adm:"", pin:null, password:null, name:"ITOFA, SULEIMAN ADAVIZE", gender:"Male", class:"Graduated", dob:"2013-04-25", parent:"", phone:"09165848004", gradYear:2025, examNo:"BS/OKN/141013", exam:{eng:45,mat:55,gep:72,total:172}, subjects:["ENG","MAT","GEP"]},
      {id:"GS14", adm:"", pin:null, password:null, name:"JIMOH, ABDULHAFIS ADAVIZE", gender:"Male", class:"Graduated", dob:"2012-10-17", parent:"", phone:"07036127073", gradYear:2025, examNo:"BS/OKN/141014", exam:{eng:60,mat:72,gep:86,total:218}, subjects:["ENG","MAT","GEP"]},
      {id:"GS15", adm:"", pin:null, password:null, name:"KABIRU, MARIAM OYIZA", gender:"Female", class:"Graduated", dob:"2014-05-02", parent:"", phone:"07038438945", gradYear:2025, examNo:"BS/OKN/141015", exam:{eng:58,mat:74,gep:82,total:214}, subjects:["ENG","MAT","GEP"]},
      {id:"GS16", adm:"", pin:null, password:null, name:"MICHAEL, ESTHER OMOKUWA", gender:"Female", class:"Graduated", dob:"2014-04-25", parent:"", phone:"08169058864", gradYear:2025, examNo:"BS/OKN/141016", exam:{eng:56,mat:72,gep:78,total:206}, subjects:["ENG","MAT","GEP"]},
      {id:"GS17", adm:"", pin:null, password:null, name:"MOMOHJIMOH, NAFISAT OPEMI", gender:"Female", class:"Graduated", dob:"2015-02-02", parent:"", phone:"07035097281", gradYear:2025, examNo:"BS/OKN/141017", exam:{eng:60,mat:70,gep:82,total:212}, subjects:["ENG","MAT","GEP"]},
      {id:"GS18", adm:"", pin:null, password:null, name:"MUHAMMED, KAUSARA OYIZA", gender:"Female", class:"Graduated", dob:"2013-11-07", parent:"", phone:"07048479426", gradYear:2025, examNo:"BS/OKN/141018", exam:{eng:62,mat:56,gep:68,total:186}, subjects:["ENG","MAT","GEP"]},
      {id:"GS19", adm:"", pin:null, password:null, name:"ONIMISI, MUHAMMEDMUSTAPHA ONORUOYIZA", gender:"Male", class:"Graduated", dob:"2012-11-27", parent:"", phone:"09164418447", gradYear:2025, examNo:"BS/OKN/141019", exam:{eng:62,mat:66,gep:58,total:186}, subjects:["ENG","MAT","GEP"]},
      {id:"GS20", adm:"", pin:null, password:null, name:"TIJANI, HANIFAT ENEHEZAI", gender:"Female", class:"Graduated", dob:"2014-10-16", parent:"", phone:"08131136716", gradYear:2025, examNo:"BS/OKN/141020", exam:{eng:46,mat:62,gep:88,total:196}, subjects:["ENG","MAT","GEP"]},
      {id:"GS21", adm:"", pin:null, password:null, name:"YUSUF, ZULKANENE ASUKU", gender:"Male", class:"Graduated", dob:"2013-11-06", parent:"", phone:"08068421538", gradYear:2025, examNo:"BS/OKN/141021", exam:{eng:58,mat:68,gep:80,total:206}, subjects:["ENG","MAT","GEP"]},
      {id:"G001", adm:"", pin:null, password:null, name:"NASIRU, JUMAI OYAMINE", gender:"Female", class:"Graduated", dob:"2012-09-14", parent:"", phone:"09034513026", gradYear:2023, subjects:["ENG","MAT","GEP"]},
      {id:"G002", adm:"", pin:null, password:null, name:"ADAMS, MUHAMMED HAYYAN ATABA", gender:"Male", class:"Graduated", dob:"2012-12-04", parent:"", phone:"08061793469", gradYear:2023, subjects:["ENG","MAT","GEP"]},
      {id:"G003", adm:"", pin:null, password:null, name:"IDRIS, NANA AYISHA OZAVIZE", gender:"Female", class:"Graduated", dob:"2013-01-20", parent:"", phone:"08131386410", gradYear:2023, subjects:["ENG","MAT","GEP"]},
      {id:"G004", adm:"", pin:null, password:null, name:"YAKUBU, ABDULWAHEED ADEIZA", gender:"Male", class:"Graduated", dob:"2010-05-16", parent:"", phone:"07030487130", gradYear:2023, subjects:["ENG","MAT","GEP"]},
      {id:"G005", adm:"", pin:null, password:null, name:"MAJEBI, TREASURE ONONO", gender:"Female", class:"Graduated", dob:"2013-05-05", parent:"", phone:"08141943478", gradYear:2023, subjects:["ENG","MAT","GEP"]},
      {id:"G006", adm:"", pin:null, password:null, name:"HADI, ROFIYAT OMENEKE", gender:"Female", class:"Graduated", dob:"2012-10-28", parent:"", phone:"09104383331", gradYear:2023, subjects:["ENG","MAT","GEP"]},
      {id:"G007", adm:"", pin:null, password:null, name:"IBRAHIM, NANAHAISHAT ENEYIAMIRE", gender:"Female", class:"Graduated", dob:"2011-06-28", parent:"", phone:"08066877646", gradYear:2023, subjects:["ENG","MAT","GEP"]},
      {id:"G008", adm:"", pin:null, password:null, name:"SALIHU, FARIDAT OZOHU", gender:"Female", class:"Graduated", dob:"2012-06-28", parent:"", phone:"08037527952", gradYear:2023, subjects:["ENG","MAT","GEP"]},
      {id:"G009", adm:"", pin:null, password:null, name:"ABDULRAZAQ, FARID ONIMISI", gender:"Male", class:"Graduated", dob:"2012-03-25", parent:"", phone:"08144400443", gradYear:2023, subjects:["ENG","MAT","GEP"]},
      {id:"G010", adm:"", pin:null, password:null, name:"AKANDE, HUSSEIN ADEIZA", gender:"Female", class:"Graduated", dob:"2012-07-20", parent:"", phone:"08065036158", gradYear:2023, subjects:["ENG","MAT","GEP"]},
      {id:"G011", adm:"", pin:null, password:null, name:"AKANDE, HASSAN ADAVIZE", gender:"Male", class:"Graduated", dob:"2012-07-30", parent:"", phone:"08066076460", gradYear:2023, subjects:["ENG","MAT","GEP"]},
      {id:"G012", adm:"", pin:null, password:null, name:"IBRAHIM, UMIHANI IZE", gender:"Female", class:"Graduated", dob:"2013-02-27", parent:"", phone:"08036354298", gradYear:2023, subjects:["ENG","MAT","GEP"]},
      {id:"G013", adm:"", pin:null, password:null, name:"ITOPA, RAZAK ADAVIZE", gender:"Male", class:"Graduated", dob:"2010-01-10", parent:"", phone:"07026998170", gradYear:2023, subjects:["ENG","MAT","GEP"]},
      {id:"G014", adm:"", pin:null, password:null, name:"ATTAHIRU, JEREMIAH ADEIZA", gender:"Male", class:"Graduated", dob:"2011-11-14", parent:"", phone:"08166262948", gradYear:2023, subjects:["ENG","MAT","GEP"]},
      {id:"G015", adm:"", pin:null, password:null, name:"WAHEED, JOSHUA EIZOHE", gender:"Male", class:"Graduated", dob:"2011-06-06", parent:"", phone:"07033879508", gradYear:2023, subjects:["ENG","MAT","GEP"]},
      {id:"G016", adm:"", pin:null, password:null, name:"LAMIDI, MULIKAT AHUOYIZA", gender:"Female", class:"Graduated", dob:"2010-07-23", parent:"", phone:"08070780491", gradYear:2023, subjects:["ENG","MAT","GEP"]},
      {id:"G017", adm:"", pin:null, password:null, name:"AGEDOH, MUDASHIRU ITOPA", gender:"Male", class:"Graduated", dob:"2010-05-16", parent:"", phone:"08191971745", gradYear:2023, subjects:["ENG","MAT","GEP"]},
      {id:"G018", adm:"", pin:null, password:null, name:"MUHAMMED, JAMIU NEZIF ONORUOYIZA", gender:"Male", class:"Graduated", dob:"2011-11-14", parent:"", phone:"08067079283", gradYear:2023, subjects:["ENG","MAT","GEP"]}
];

function subjectsFor(cls){ return EARLY_CLASSES.includes(cls) ? SUBJECTS_EARLY : SUBJECTS_PRIMARY; }

/* ---------------- Seed data ---------------- */
function seedDB(){
  const school = {...SCHOOL_DEFAULTS};
  const db = {
    school,
    admins: [{id:"HEAD001", pin:"1234", name:"Mrs. Salihu Nanahawa", title:"Headmistress"}],
    teachers: [
      {id:"T001", pin:"1234", name:"Uncle Ebenezer", phone:"0803 100 0001", class:"Primary 3", subjects:["English Language","Mathematics"],dob:"1988-02-14",started:"2015-09-14",position:"Class Teacher",quals:"NCE (English)",about:"The friendly voice of Primary 3. Uncle Ebenezer loves turning stories into lessons, and has taught at Treasure since our very first year."},
      {id:"T002", pin:"1234", name:"Aunty Rafatu",   phone:"0803 100 0002", class:"Primary 1", subjects:["Mathematics","Basic Science"],dob:"1992-06-21",started:"2017-01-09",position:"Class Teacher",quals:"NCE (Primary Education)",about:"Patient and playful - she gives our Primary 1 pupils the strongest possible start in reading and numbers."},
      {id:"T003", pin:"1234", name:"Aunty Rachel",   phone:"0803 100 0003", class:"Nursery 2", subjects:["Literacy","Numeracy","Phonics"],dob:"1990-11-03",started:"2016-09-12",position:"Class Teacher",quals:"NCE (Early Childhood)",about:"Our phonics champion - Nursery 2 pupils leave her class sounding out new words all by themselves."},
      {id:"T004", pin:"1234", name:"Aunty Nanahawa", phone:"0803 100 0004", class:"Pre-Nursery", subjects:["Literacy","Numeracy","Rhymes & Songs"],dob:"1995-08-30",started:"2018-09-10",position:"Class Teacher",quals:"NCE (Early Childhood)",about:"Gentle hands and a warm heart - she cares for our youngest Treasures in Pre-Nursery."},
      {id:"T005", pin:"1234", name:"Mr. Tunde Bakare (demo)", phone:"0803 999 0000", class:"Primary 4", subjects:["English Language","Social Studies"],dob:"1985-09-16",started:"2019-09-16",position:"Class Teacher",quals:"B.Ed (Social Studies)",about:"Brings history and maps alive for Primary 4 with debates and little field trips."},
      {id:"T006", pin:"1234", name:"Mrs. Ngozi Obi (demo)",   phone:"0803 222 3333", class:"Creche",    subjects:["Rhymes & Songs","Social Habits"],dob:"1993-12-09",started:"2020-01-13",position:"Class Teacher",quals:"NCE",about:"Known for the calmest creche corner in Kogi State - songs, naps and happy babies."},
      {id:"T007", pin:"1234", name:"Mrs Salihu Nanahawa", phone:"0803 100 0007", class:"Nursery 1", subjects:["Literacy","Numeracy","Phonics"],dob:"1991-05-22",started:"2015-09-14",position:"Class Teacher",quals:"NCE (Early Childhood)",about:"With Treasure from day one - her Nursery 1 classroom is where the music never stops."}
    ],
    formerTeachers: FORMER_SEED,
    staffWall: STAFF_WALL_SEED,
    graduates: GRADS_SEED,
    pupils: [
      {id:"P001", adm:"TA/2023/001", pin:"1234", password:"1234", name:"Adaeze Okafor",   gender:"Female", class:"Primary 1", dob:"2019-03-12", parent:"Mrs. Okafor",  phone:"0805 111 2222"},
      {id:"P002", adm:"TA/2023/002", pin:"1234", password:"1234", name:"Emeka Nwosu",    gender:"Male",   class:"Primary 1", dob:"2019-07-08", parent:"Mr. Nwosu",    phone:"0805 333 4444"},
      {id:"P003", adm:"TA/2023/003", pin:"1234", password:null, name:"Fatima Bello",       gender:"Female", class:"Primary 1", dob:"2018-11-20", parent:"Alh. Bello",   phone:"0805 555 6666"},
      {id:"P004", adm:"TA/2024/004", pin:"1234", password:null, name:"David Adeyemi",   gender:"Male",   class:"Primary 1", dob:"2019-01-30", parent:"Mrs. Adeyemi", phone:"0805 777 8888"},
      {id:"P005", adm:"TA/2023/005", pin:"1234", password:null, name:"Grace Eze",      gender:"Female", class:"Primary 2", dob:"2018-05-14", parent:"Mrs. Eze",     phone:"0805 999 0000"},
      {id:"P006", adm:"TA/2024/006", pin:"1234", password:null, name:"Ibrahim Musa",     gender:"Male",   class:"Primary 2", dob:"2018-09-02", parent:"Mr. Musa",     phone:"0805 222 3333"},
      {id:"P007", adm:"TA/2024/007", pin:"1234", password:null, name:"Hannah Peters",   gender:"Female", class:"Primary 2", dob:"2018-02-25", parent:"Mrs. Peters",  phone:"0805 444 5555"},
      {id:"P008", adm:"TA/2024/008", pin:"1234", password:"1234", name:"Daniel Okoro",   gender:"Male",   class:"Nursery 2", dob:"2021-06-11", parent:"Mrs. Okoro",   phone:"0805 666 7777"},
      {id:"P009", adm:"TA/2024/009", pin:"1234", password:null, name:"Esther Balogun",  gender:"Female", class:"Nursery 2", dob:"2021-04-19", parent:"Mr. Balogun",  phone:"0805 888 9999"},
      {id:"P010", adm:"TA/2025/010", pin:"1234", password:null, name:"Femi Adebayo",      gender:"Male",   class:"Nursery 2", dob:"2021-10-05", parent:"Mrs. Adebayo", phone:"0805 000 1111"},
      {id:"P011", adm:"TA/2025/011", pin:"1234", password:null, name:"Aisha Sule",   gender:"Female", class:"Pre-Nursery", dob:"2022-08-17", parent:"Mrs. Sule",    phone:"0805 123 1234"},
      {id:"P012", adm:"TA/2025/012", pin:"1234", password:null, name:"Joshua Tari",      gender:"Male",   class:"Pre-Nursery", dob:"2022-12-01", parent:"Mr. Tari",     phone:"0805 456 4566"},
      {id:"P013", adm:"TA/2025/013", pin:"1234", password:null, name:"Kemi Ogunleye",    gender:"Female", class:"Primary 4", dob:"2016-03-22", parent:"Mrs. Ogunleye",phone:"0805 789 7890"},
      {id:"P014", adm:"TA/2025/014", pin:"1234", password:null, name:"Peter Udo",      gender:"Male",   class:"Primary 4", dob:"2016-07-09", parent:"Mr. Udo",      phone:"0805 321 3210"},
      {id:"P015", adm:"TA/2026/015", pin:"1234", password:null, name:"Zara Ali",   gender:"Female", class:"Creche",    dob:"2024-05-20", parent:"Mrs. Ali",     phone:"0805 654 6543"},
      {id:"P016", adm:"TA/2026/016", pin:"1234", password:null, name:"Tobi Alabi",      gender:"Male",   class:"Creche",    dob:"2024-09-11", parent:"Mr. Alabi",    phone:"0805 987 9876"},
      {id:"P017", adm:"TA/2026/017", pin:"1234", password:null, name:"Majebi Benita", gender:"Female", class:"Primary 3", dob:"", parent:"Mrs. Benita", phone:"0805 100 0017"}
    ],
    duty: [
      {day:"Monday",    teachers:["T001","T003"]},
      {day:"Tuesday",   teachers:["T002","T004"]},
      {day:"Wednesday", teachers:["T005","T006"]},
      {day:"Thursday",  teachers:["T001","T005"]},
      {day:"Friday",    teachers:["T003","T002"]}
    ],
    results: [],
    attendance: [],
    applications: [
      {id:"AP1", pupilName:"Olivia Eze", dob:"2020-02-14", gender:"Female", classApply:"Nursery 1", parent:"Mrs. Eze", phone:"0807 111 0000", date:"2026-09-10", status:"Pending"},
      {id:"AP2", pupilName:"Samuel Danjuma", dob:"2017-12-03", gender:"Male", classApply:"Primary 3", parent:"Mr. Danjuma", phone:"0807 222 0000", date:"2026-09-12", status:"Pending"}
    ],
    promotions: [
      {id:"PR1", badge:"Admissions Open", title:"2026/2027 Admission Is On", text:"Creche, Pre-Nursery, Nursery and Primary forms are out. Give your child the Treasure Academy advantage — limited seats per class.", cta:"Apply Now", link:"portal/login.html?mode=register", color:"sun"},
      {id:"PR2", badge:"Parent Portal", title:"Check Results From Your Phone", text:"No more waiting. Report cards, attendance and school notices are now online for all parents.", cta:"Login to Portal", link:"portal/login.html", color:"sky"},
      {id:"PR3", badge:"E-Learning", title:"Common Entrance Practice Online", text:"Primary 6 pupils can now practise Common Entrance questions online in the portal.", cta:"Open Portal", link:"portal/login.html", color:"sky"}
    ],
    newsEvents: [
      {id:"NE1", type:"news", title:"Resumption and Welcome Party", date:"2026-09-08", image:"assets/img/hero-kids.png", videoUrl:"", views:0, likes:0, images:["assets/img/classroom.png","assets/img/library.png"], text:"We welcomed all our pupils back for First Term 2026/2027 with music, games and lots of smiles.", story:"The school compound came alive on Monday as pupils returned for the First Term of the 2026/2027 session.\n\nThere was music, dancing and plenty of food to eat. Our new Creche babies settled in beautifully with the help of our loving nannies.\n\nThe headmistress, Mrs. Salihu Nanahawa, welcomed everyone and promised a term full of learning, fun and excellence. We say a big welcome to all new parents who joined the Treasure family this term!"},
      {id:"NE2", type:"event", title:"Inter-House Sports Trials", date:"2026-09-20", image:"assets/img/sports.png", videoUrl:"", views:0, likes:0, images:["assets/img/hero-kids.png","assets/img/culture.png"], text:"Trials for our annual Inter-House Sports begin next week. Pupils should come in sportswear on Friday.", story:"Get ready, champions! Trials for this year's Inter-House Sports competition will hold next week on the school field.\n\nEvents include: 50m and 100m races, sack race, egg-and-spoon, filling-the-basket, football and the teachers vs parents novelty match!\n\nWhich house will lift the trophy this year — Ruby, Sapphire, Emerald or Topaz? Come and cheer your house to victory!"},
      {id:"NE3", type:"event", title:"Independence Day Celebration", date:"2026-10-01", image:"assets/img/culture.png", videoUrl:"", views:0, likes:0, images:["assets/img/graduation.png","assets/img/hero-kids.png"], text:"Our pupils celebrate Nigeria with cultural dances, parades and traditional attires.", story:"Treasure Academy will join the whole nation to celebrate Nigeria's Independence Day in grand style!\n\nOur pupils will parade in beautiful traditional attires representing different tribes, perform cultural dances, recite poems and sing the national anthem with pride.\n\nParents are specially invited. Come and celebrate our heritage with our pupils!"},
      {id:"NE4", type:"news", title:"New Computer Room Commissioned", date:"2026-08-28", image:"assets/img/library.png", videoUrl:"", views:0, likes:0, images:["assets/img/classroom.png","assets/img/hero-kids.png"], text:"Our new computer room with 20 systems is ready. Coding club starts for Primary 3 to 6.", story:"We are excited to announce the opening of our new computer room, equipped with 20 modern systems and a smart board.\n\nCoding Club will now hold every Wednesday for Primary 3 to 6 pupils, where they will learn Scratch programming, typing and safe internet use.\n\nThe future is digital, and our pupils are ready for it!"},
      {id:"NE5", type:"event", title:"Graduation and Prize-Giving Day", date:"2026-07-25", image:"assets/img/graduation.png", videoUrl:"", views:0, likes:0, images:["assets/img/culture.png","assets/img/hero-kids.png"], text:"A colourful send-forth for our Primary 6 and Pre-Nursery graduates. See photos and highlights.", story:"It was a day of joy as we celebrated our Primary 6 and Pre-Nursery graduating classes!\n\nHighlights included the graduation parade, choreography display, debate, awards for best pupils in each class, and a valedictory speech.\n\nCongratulations to all our graduates — go and keep shining in your new schools!"},
      {id:"NE6", type:"news", title:"Story Time Fridays Are Back", date:"2026-09-05", image:"assets/img/classroom.png", videoUrl:"", views:0, likes:0, images:["assets/img/library.png","assets/img/hero-kids.png"], text:"Every Friday is now story time in our library. Pupils borrow a book home weekly.", story:"Our library just got better! Every Friday, each class enjoys story time with their teacher, and every pupil borrows one storybook home for the weekend.\n\nReading builds vocabulary, imagination and confidence. Parents, please read with your child at home and return books every Monday."},
      {id:"NE7", type:"event", title:"Mid-Term Excursion", date:"2026-10-15", image:"assets/img/hero-kids.png", videoUrl:"", views:0, likes:0, images:["assets/img/excursion-railway.jpg","assets/img/excursion-shop.jpg","assets/img/excursion-girls.jpg"], text:"Nursery and Primary pupils visit the amusement park. Permission slips go home Monday.", story:"Learning goes beyond the classroom! Our mid-term excursion takes Nursery and Primary pupils to the amusement park for a day of fun and discovery.\n\nActivities: rides, games, picnic lunch and a guided nature walk. Pupils will travel together with their teachers and minders.\n\nParents should kindly sign and return permission slips by Monday."},
      {id:"NE8", type:"news", title:"100% Pass in Common Entrance", date:"2026-08-15", image:"assets/img/graduation.png", videoUrl:"", views:0, likes:0, images:["assets/img/library.png","assets/img/classroom.png"], text:"All our Primary 6 pupils passed into top secondary schools. We are so proud.", story:"History made again! Every single one of our Primary 6 pupils passed the Common Entrance Examination into prestigious secondary schools.\n\nSpecial congratulations to our overall best! This achievement reflects the hard work of our pupils, teachers and supportive parents.\n\nAdmissions into Creche to Primary 6 for next session are now open. Come and join a winning school!"}
    ],
    practiceQuestions: [
      {id:"PQ001", subject:"Mathematics", q:"What is 144 ÷ 12?", options:["10","11","12","14"], answer:1},
      {id:"PQ002", subject:"English Language", q:"Choose the correctly spelt word.", options:["Neccessary","Necessary","Necesary","Neccesary"], answer:1},
      {id:"PQ003", subject:"Basic Science", q:"Which gas do plants use to make food?", options:["Oxygen","Hydrogen","Carbon dioxide","Nitrogen"], answer:2}
    ],
    practiceAttempts: [],
    calendar: [
      {id:"C1", date:"2026-09-22", title:"Resumption — First Term 2026/2027", desc:"All pupils resume. New admissions close two weeks after resumption."},
      {id:"C2", date:"2026-10-01", title:"Independence Day Holiday", desc:"No school — public holiday."},
      {id:"C3", date:"2026-10-29", title:"Mid-Term Break", desc:"Half-term break begins."},
      {id:"C4", date:"2026-12-10", title:"First Term Examinations", desc:"Examinations begin for all classes."},
      {id:"C5", date:"2026-12-18", title:"Closing & Carol Service", desc:"End of first term. Merry Christmas!"}
    ],
    testimonials: [
      {id:"TM1", name:"Mrs. Okafor", role:"Parent (Primary 1)", text:"My daughter runs to school every morning with joy. Her reading improved so much in one term, and I can even check her results on my phone.", status:"Approved", date:"2026-09-10"},
      {id:"TM2", name:"Mr. Nwosu", role:"Parent (Primary 2)", text:"The teachers truly love the children. My son was shy before; now he anchors the school assembly. Best decision we made.", status:"Approved", date:"2026-09-11"},
      {id:"TM3", name:"Alhaja Bello", role:"Parent (Primary 1)", text:"Clean environment, healthy meals, caring teachers, and they update me on everything. Treasure Academy is worth every naira.", status:"Approved", date:"2026-09-12"}
    ],
    registrations: [],
    messages: [
      {id:"M1", name:"Mrs. Eze", email:"eze.mama@example.com", subject:"School fees (Nursery 1)", message:"Good day, please how much is the school fees for Nursery 1? My daughter wants to join next term.", date:"2026-09-12", read:false}
    ],
    whatsapp: [
      {id:"W1", name:"School WhatsApp", role:"Chat with us anytime", phone:"2349063932487", active:true, always:true, hours:"always"}
    ],
    news: [],
    starsOfWeek: {staff:{name:"Mr Idris Ibrahim",role:"Primary 3 Mathematics Teacher",week:"Week of Sept 15, 2026"},pupil:{name:"Adaeze Okonkwo",class:"Primary 4",week:"Week of Sept 15, 2026"}},
    ticker: {on:true,text:"2026/2027 ADMISSION IN PROGRESS - Creche to Primary 6. Visit the school office in Ageva, Okene or call us today!"},
    homework: [
      {id:"HW1",class:"Primary 4",subject:"Mathematics",note:"Page 42, exercise 3 (numbers 1 to 10). Show all workings.",date:"2026-09-15"},
      {id:"HW2",class:"Primary 6",subject:"English Language",note:"Write a 10-line composition: My Favourite Teacher.",date:"2026-09-15"},
      {id:"HW3",class:"Nursery 2",subject:"Phonics",note:"Practise sounds a to f with the picture cards sent home.",date:"2026-09-14"}
    ],
    lostfound: [
      {id:"LF1",item:"Blue cardigan (age 5-6)",desc:"Found on the assembly ground after closing.",date:"2026-09-12",claimed:false},
      {id:"LF2",item:"Green lunch box",desc:"Name sticker peeled off. Found in Primary 1 classroom.",date:"2026-09-10",claimed:false}
    ],
    claims: [],
    photoSlots: [
      {id:"PS1",day:"Saturday, Sept 20",time:"9:00 AM",taken:null},
      {id:"PS2",day:"Saturday, Sept 20",time:"9:20 AM",taken:null},
      {id:"PS3",day:"Saturday, Sept 20",time:"9:40 AM",taken:null},
      {id:"PS4",day:"Saturday, Sept 20",time:"10:00 AM",taken:null},
      {id:"PS5",day:"Saturday, Sept 20",time:"10:20 AM",taken:null},
      {id:"PS6",day:"Saturday, Sept 20",time:"10:40 AM",taken:null},
      {id:"PS7",day:"Saturday, Sept 20",time:"11:00 AM",taken:null},
      {id:"PS8",day:"Saturday, Sept 20",time:"11:20 AM",taken:null}
    ],
    suggestions: [],
    exams: [
      {id:"EX1",day:"Monday",date:"2026-11-30",time:"8:00 AM",subject:"Mathematics",classes:"Primary 1-6"},
      {id:"EX2",day:"Monday",date:"2026-11-30",time:"10:30 AM",subject:"English Language",classes:"Primary 1-6"},
      {id:"EX3",day:"Tuesday",date:"2026-12-01",time:"8:00 AM",subject:"Basic Science",classes:"Primary 1-6"},
      {id:"EX4",day:"Tuesday",date:"2026-12-01",time:"10:30 AM",subject:"Social Studies",classes:"Primary 1-6"},
      {id:"EX5",day:"Wednesday",date:"2026-12-02",time:"8:00 AM",subject:"C.R.S",classes:"Primary 1-6"},
      {id:"EX6",day:"Wednesday",date:"2026-12-02",time:"10:30 AM",subject:"Creative Arts",classes:"Primary 1-6"}
    ],
    holiday: [
      {id:"HD1",class:"Primary 6",subject:"Mathematics",note:"Revise multiplication tables up to 12x12. First 20 questions of the Common Entrance practice booklet.",date:"2026-09-16"},
      {id:"HD2",class:"Primary 4",subject:"English Language",note:"Read one storybook and write 8 new words with their meanings.",date:"2026-09-16"}
    ],
    teacherVotes: {},
    teacherOfTerm: {teacherId:"",name:"",term:"",session:"",votes:0,date:""},
    photoHistory: [],
    commentBank: [
      "An excellent result. Keep shining!",
      "A very good performance. Well done!",
      "Good work. There is room to do even better.",
      "Fair performance. More effort needed next term.",
      "Weak result. Extra lessons advised.",
      "Poor performance. Must work much harder next term."
    ],
    sickbay: [],
    transportRoutes: [
      {id:"TR1",route:"Route A - Adavi",pickup:"Adavi Junction bus stop",fee:5000},
      {id:"TR2",route:"Route B - Okene Town",pickup:"Okene Central Mosque",fee:6000},
      {id:"TR3",route:"Route C - Ageva",pickup:"School gate, Ageva",fee:3000}
    ],
    transport: [],
    volunteers: [],
    pta: [],
    ptaLevy: {amount:0,note:""},
    ptaAttend: {},
    weekStrip: {on:true,note:""},
    bdayThanks: [],
    bdayWishes: {},
    ptaMeetings: [
      {id:"PM1",date:"2026-10-04",title:"First Term General Meeting",venue:"School Hall, 10:00 AM"}
    ],
    uniform: [
      {id:"UN1",name:"School Shirt (white)",price:4500,note:"Ages 2-12, all classes"},
      {id:"UN2",name:"Shorts / Skirt (green)",price:4000,note:"Boys shorts, girls skirt"},
      {id:"UN3",name:"School Cardigan",price:6000,note:"Green with crest"},
      {id:"UN4",name:"Sportswear Set",price:7500,note:"For Fridays and sports days"},
      {id:"UN5",name:"School Sandals",price:5000,note:"Black, all sizes"},
      {id:"UN6",name:"Socks (pair)",price:1200,note:"White with green stripes"},
      {id:"UN7",name:"School Beret",price:2500,note:"Girls, all classes"},
      {id:"UN8",name:"School Bag",price:8000,note:"With Treasure Academy crest"}
    ],
    openday: {date:"2026-10-03",time:"9:00 AM - 12 noon",theme:"Come and See Your Child's Future School",venue:"School compound, beside Morak Pure-Water Factory, Ageva"},
    rsvps: [],
    reading: {book:{title:"The Clever Tortoise",author:"Tales by Moonlight Series",why:"A funny folktale that teaches wisdom and thinking before you act. Ask your teacher for the class copy!"},
      story:{title:"Adaeze and the Lost Pencil",text:"Adaeze loved her new pencil. One morning, she could not find it anywhere. She searched her bag, her desk and the playground. Then she remembered: she had lent it to Musa yesterday! Musa returned it with a big smile and said thank you. From that day, Adaeze always kept her things in one place. Moral: lending is good, but keeping your things tidy is better."}},
    meetings: [
      {id:"MT1",title:"Welcome Back Staff Meeting",notes:"Resumption review, duty roster, and first-term targets. All class teachers should submit weekly plans every Monday.",date:"2026-09-12",ack:["T001"]}
    ],
    alumni: [
      {id:"AL1",status:"Approved",name:"Blessing O.",year:"2023",school:"Government Science Secondary School, Okene",note:"Best graduating pupil 2023. Now topping her class in JSS 2!"},
      {id:"AL2",status:"Approved",name:"Ibrahim D.",year:"2022",school:"St. Peters College, Idah",note:"Won a scholarship into St. Peters after scoring highest in Common Entrance."}
    ],
    notices: [
      {id:"NT1", to:"teachers", title:"Staff meeting Friday 2pm", text:"All teachers should attend the general staff meeting in the headmistress office after closing on Friday.", date:"2026-09-13", readBy:[]},
      {id:"NT2", to:"parents", title:"Mid-term break is coming up", text:"Dear parents, mid-term break starts Oct 23rd. Pupils resume Oct 27th. Thank you!", date:"2026-09-12", readBy:[]},
      {id:"NT3", to:"all", title:"Admissions still open for 2026/2027", text:"Tell a friend! Creche to Primary 6 admission is still open. Forms available at the school office.", date:"2026-09-05", readBy:[]}
    ],
    classPages: [
      {class:"Creche", tagline:"Gentle care for our littlest treasures.", about:"Our Creche gives babies a safe, clean and loving second home. Trained nannies care for each child with patience while building early speech, movement and social smiles.", activities:["Rhymes & cuddles","Tummy time & play","Early speech sounds","Nap & meal routine"], image:"assets/img/hero-kids.png", visible:true},
      {class:"Pre-Nursery", tagline:"First steps into happy learning.", about:"Pre-Nursery blends play with early learning. Children sing, paint, build and begin to recognise letters, numbers and colours in a warm classroom.", activities:["Letter & number play","Painting & building","Rhymes & stories","Table manners"], image:"assets/img/classroom.png", visible:true},
      {class:"Nursery 1", tagline:"Sounds, letters and numbers come alive.", about:"In Nursery 1 we build strong reading and writing foundations with phonics, handwriting practice and simple numeracy, all through joyful daily activities.", activities:["Phonics & reading","Handwriting","Simple counting","Colouring & craft"], image:"assets/img/library.png", visible:true},
      {class:"Nursery 2", tagline:"Confident readers, ready for Primary.", about:"Nursery 2 polishes reading fluency, spelling and number work so every child steps into Primary 1 with confidence and excellent habits.", activities:["Fluent reading","Spelling & dictation","Addition & subtraction","Show & tell"], image:"assets/img/library.png", visible:true},
      {class:"Primary 1", tagline:"Strong start, bright future.", about:"Primary 1 lays the blocks for all future learning: English, Mathematics, handwriting and good study habits, with caring guidance every step.", activities:["English & comprehension","Mental maths","Handwriting mastery","Computer time"], image:"assets/img/classroom.png", visible:true},
      {class:"Primary 2", tagline:"Growing minds, deeper skills.", about:"Primary 2 stretches vocabulary, multiplication tables and writing skills while growing confidence through class presentations and teamwork.", activities:["Grammar & writing","Times tables","Reading club","Team projects"], image:"assets/img/classroom.png", visible:true},
      {class:"Primary 3", tagline:"Thinking, reasoning, excelling.", about:"Primary 3 introduces deeper reasoning, science discovery and computer skills. Pupils take pride in neat work and strong continuous assessment.", activities:["Reasoning skills","Science discovery","Coding club","Debate & quiz"], image:"assets/img/sports.png", visible:true},
      {class:"Primary 4", tagline:"Independent learners emerge.", about:"Primary 4 pupils read widely, solve tougher maths and express ideas clearly in writing. Leadership roles like class captain build responsibility.", activities:["Essay writing","Problem solving","Library research","Leadership roles"], image:"assets/img/sports.png", visible:true},
      {class:"Primary 5", tagline:"Almost there: excellence in sight.", about:"Primary 5 prepares pupils for the final lap with advanced topics, exam technique and Common Entrance awareness woven into daily lessons.", activities:["Exam technique","Advanced maths","Moral leadership","Excursions"], image:"assets/img/graduation.png", visible:true},
      {class:"Primary 6", tagline:"Finish strong, soar higher.", about:"Primary 6 is our graduation class — intensive Common Entrance preparation, interviews and secondary-school readiness, crowned with our prize-giving celebration.", activities:["Entrance practice","Interview skills","Valedictory prep","Legacy project"], image:"assets/img/graduation.png", visible:true}
    ],
    shopItems: [
      {id:"S01", name:"Mathematics Textbook", classes:["Primary 1","Primary 2","Primary 3","Primary 4","Primary 5","Primary 6"], price:4500, icon:"book", qty:40},
      {id:"S02", name:"English Language Textbook", classes:["Primary 1","Primary 2","Primary 3","Primary 4","Primary 5","Primary 6"], price:4500, icon:"book", qty:40},
      {id:"S03", name:"Verbal Reasoning", classes:["Primary 1","Primary 2","Primary 3","Primary 4","Primary 5","Primary 6"], price:3500, icon:"book", qty:35},
      {id:"S04", name:"Quantitative Reasoning", classes:["Primary 1","Primary 2","Primary 3","Primary 4","Primary 5","Primary 6"], price:3500, icon:"book", qty:35},
      {id:"S05", name:"Basic Science Textbook", classes:["Primary 1","Primary 2","Primary 3","Primary 4","Primary 5","Primary 6"], price:4000, icon:"book", qty:30},
      {id:"S06", name:"Sound Foundation (Phonics)", classes:["Primary 1","Primary 2","Primary 3"], price:3000, icon:"book", qty:25},
      {id:"S07", name:"Queen Primer", classes:["Nursery 2","Primary 1"], price:3200, icon:"star", qty:25},
      {id:"S08", name:"Story Novel", classes:["Primary 1","Primary 2","Primary 3","Primary 4","Primary 5","Primary 6"], price:2500, icon:"news", qty:30},
      {id:"S09", name:"Notebook — 60 Leaves", classes:["Primary 1","Primary 2","Primary 3","Primary 4","Primary 5","Primary 6"], price:900, icon:"filetext", qty:60},
      {id:"S10", name:"Pen (Pack of 5)", classes:["Primary 1","Primary 2","Primary 3","Primary 4","Primary 5","Primary 6"], price:1200, icon:"edit", qty:50},
      {id:"S11", name:"Eraser", classes:["Pre-Nursery","Nursery 1","Nursery 2","Primary 1","Primary 2","Primary 3","Primary 4","Primary 5","Primary 6"], price:200, icon:"x", qty:70},
      {id:"S12", name:"Ruler Set", classes:["Primary 1","Primary 2","Primary 3","Primary 4","Primary 5","Primary 6"], price:800, icon:"chart", qty:45},
      {id:"S13", name:"Crayons (Pack of 12)", classes:["Pre-Nursery","Nursery 1","Nursery 2","Primary 1","Primary 2"], price:1500, icon:"star", qty:30},
      {id:"S14", name:"Writing Book", classes:["Pre-Nursery","Nursery 1","Nursery 2"], price:700, icon:"filetext", qty:50},
      {id:"S15", name:"Drawing Book", classes:["Pre-Nursery","Nursery 1","Nursery 2"], price:700, icon:"edit", qty:50},
      {id:"S16", name:"Colouring Textbook", classes:["Pre-Nursery","Nursery 1","Nursery 2"], price:2200, icon:"book", qty:20},
      {id:"S17", name:"Nursery Mathematics", classes:["Nursery 1","Nursery 2"], price:2800, icon:"book", qty:25},
      {id:"S18", name:"Creche Care Pack", classes:["Creche"], price:5000, icon:"bag", qty:0},
      {id:"S19", name:"Feeding Bib Set", classes:["Creche"], price:1800, icon:"shirt", qty:15},
      {id:"S20", name:"Soft Towel", classes:["Creche"], price:1500, icon:"shirt", qty:15},
      {id:"S21", name:"Full Uniform Set", classes:["Creche","Pre-Nursery","Nursery 1","Nursery 2","Primary 1","Primary 2","Primary 3","Primary 4","Primary 5","Primary 6"], price:8500, icon:"shirt", qty:25},
      {id:"S22", name:"Sportswear", classes:["Creche","Pre-Nursery","Nursery 1","Nursery 2","Primary 1","Primary 2","Primary 3","Primary 4","Primary 5","Primary 6"], price:6500, icon:"shirt", qty:0},
      {id:"S23", name:"School Cardigan", classes:["Creche","Pre-Nursery","Nursery 1","Nursery 2","Primary 1","Primary 2","Primary 3","Primary 4","Primary 5","Primary 6"], price:6000, icon:"shirt", qty:20},
      {id:"S24", name:"School Bag", classes:["Pre-Nursery","Nursery 1","Nursery 2","Primary 1","Primary 2","Primary 3","Primary 4","Primary 5","Primary 6"], price:7500, icon:"bag", qty:18},
      {id:"S25", name:"Socks & Beret", classes:["Pre-Nursery","Nursery 1","Nursery 2","Primary 1","Primary 2","Primary 3","Primary 4","Primary 5","Primary 6"], price:2500, icon:"star", qty:30}
    ],
    timetable: null,
    readTop: [],
    readLog: [],
    resultViews: [],
    bestStudent: {name:"",class:"",score:0,parts:{},term:"",session:"",published:false,date:""},
    comments: {NE1:[{name:"Mrs. Okafor",text:"Beautiful! My daughter came home so happy that day.",date:"2026-09-09"},{name:"Mr. Nwosu",text:"Well done Treasure Academy. Keep it up!",date:"2026-09-10"}]},
    orders: [],
    seq: {pupil:18, teacher:7, app:3, notice:4, result:1, promo:4, ne:9, reg:1, msg:2, wa:3, tm:4, order:1, rcpt:0}
  };
  const mk = (pupilId, cls, tweak, status) => {
    const scores = {};
    subjectsFor(cls).forEach((s,i)=>{
      const base = 62 + ((pupilId.charCodeAt(3) + i*7 + tweak) % 30);
      const ca1 = Math.min(20, Math.round(base*0.2));
      const ca2 = Math.min(20, Math.round(base*0.2));
      const exam = Math.min(60, base - ca1 - ca2);
      scores[s] = {ca1, ca2, exam};
    });
    return {id:"R"+(db.seq.result++), pupilId, class:cls, term:db.school.term, session:db.school.session, scores, status, updatedAt:new Date().toISOString()};
  };
  ["P001","P002","P003","P004"].forEach((pid,i)=> db.results.push(mk(pid,"Primary 1", i*3, "Published")));
  ["P008","P009"].forEach((pid,i)=> db.results.push(mk(pid,"Nursery 2", i*5+2, "Submitted")));
  const d = new Date();
  for(let k=5;k>=1;k--){
    const dt = new Date(d); dt.setDate(d.getDate()-k);
    if([0,6].includes(dt.getDay())) continue;
    const recs = {};
    ["P001","P002","P003","P004"].forEach(pid=>{ recs[pid] = Math.random()>0.12 ? "P" : "A"; });
    db.attendance.push({date: dt.toISOString().slice(0,10), class:"Primary 1", records:recs});
  }
  return db;
}

/* ---------------- DB helpers ---------------- */
const DB = {
  load(){
    try{
      const raw = localStorage.getItem(DB_KEY);
      if(raw){ const db = JSON.parse(raw); DB.ensure(db); DB.expireRegs(db); try{ localStorage.setItem(DB_KEY, JSON.stringify(db)); }catch(e){} return db; }
    }catch(e){}
    let fresh = seedDB();
    let old = null;
    for(const k of OLD_DB_KEYS){ try{ old = JSON.parse(localStorage.getItem(k) || "null"); if(old) break; }catch(e){} }
    if(old){
      ["admins","teachers","pupils","duty","results","attendance","applications","promotions","newsEvents","registrations","messages","whatsapp","news","notices","testimonials","comments","timetables","calendar"].forEach(k=>{ if(old[k] !== undefined) fresh[k] = old[k]; });
      const fixCls = c => (c === "KG 1" || c === "KG 2") ? "Pre-Nursery" : c;
      (fresh.registrations || []).forEach(r=>{ if(r.ward) r.ward.classApply = fixCls(r.ward.classApply); });
      (fresh.applications || []).forEach(a=>{ a.classApply = fixCls(a.classApply); });
      (fresh.pupils || []).forEach(p=>{ p.class = fixCls(p.class); });
      (fresh.teachers || []).forEach(t=>{ t.class = fixCls(t.class); });
      if(old.seq) Object.keys(fresh.seq).forEach(k=>{ if(old.seq[k]) fresh.seq[k] = Math.max(fresh.seq[k], old.seq[k]); });
      DB.ensure(fresh);
    }
    DB.ensure(fresh);
    localStorage.setItem(DB_KEY, JSON.stringify(fresh));
    return fresh;
  },
  /* fill in any keys missing from older saves */
  nextReceipt(){
    const db = DB.load();
    db.seq.rcpt = (db.seq.rcpt||0)+1;
    const n = "TA/"+new Date().getFullYear()+"/"+String(db.seq.rcpt).padStart(4,"0");
    DB.save(db);
    return n;
  },
  ensure(db){

    if(!db.testimonials) db.testimonials = seedDB().testimonials;
    if(!db.seq.tm) db.seq.tm = (db.testimonials?db.testimonials.length:0)+1;
    ["promotions","newsEvents","registrations","messages","whatsapp","notices","orders","formClaims"].forEach(k=>{ if(!db[k]) db[k]=[]; });
    if(Array.isArray(db.whatsapp)&&db.whatsapp.length>1&&db.whatsapp.every(w=>["W1","W2","W3"].includes(w.id)&&["234814194378","2349063932487"].includes(String(w.phone)))) db.whatsapp=seedDB().whatsapp;
    if(!db.weekStrip) db.weekStrip = {on:true,note:""};
    if(!db.bdayThanks) db.bdayThanks = [];
    if(!db.comments) db.comments = {};
    if(!db.starsOfWeek) db.starsOfWeek = seedDB().starsOfWeek;
    if(!db.ticker) db.ticker = seedDB().ticker;
    if(!db.homework) db.homework = seedDB().homework;
    if(!db.claims) db.claims = [];
    if(!db.photoSlots) db.photoSlots = seedDB().photoSlots;
    if(!db.suggestions) db.suggestions = [];
    if(!db.uniform) db.uniform = seedDB().uniform;
    if(!db.openday) db.openday = seedDB().openday;
    if(!db.rsvps) db.rsvps = [];
    if(!db.reading) db.reading = seedDB().reading;
    if(!db.meetings) db.meetings = seedDB().meetings;
    if(!db.visitors) db.visitors = [];
    if(!db.formerTeachers) db.formerTeachers = FORMER_SEED;
    if(!db.staffWall) db.staffWall = STAFF_WALL_SEED;
    if(!db.graduates) db.graduates = GRADS_SEED;
    if(Array.isArray(db.pupils)){
      const stray = db.pupils.filter(p=>p.class==="Graduated");
      if(stray.length){ db.graduates=(db.graduates||[]).concat(stray.filter(x=>!(db.graduates||[]).some(g=>g.id===x.id))); db.pupils=db.pupils.filter(p=>p.class!=="Graduated"); }
    }
    if(!db.jobApps) db.jobApps = [];
    if(!db.supportPledges) db.supportPledges = [
      {id:"SP1",name:"Blessing O.",amount:20000,msg:"For the library books. Once a Treasure pupil, always Treasure!",date:"2026-09-18",status:"Approved"},
      {id:"SP2",name:"Anonymous well-wisher",amount:5000,msg:"For classroom fans. God bless the children.",date:"2026-09-19",status:"Approved"}
    ];
    if(!db.alumni) db.alumni = seedDB().alumni;
    if(!db.exams) db.exams = seedDB().exams;
    if(!db.holiday) db.holiday = seedDB().holiday;
    if(!db.teacherVotes) db.teacherVotes = {};
    if(!db.teacherOfTerm) db.teacherOfTerm = {teacherId:"",name:"",term:"",session:"",votes:0,date:""};
    if(!db.photoHistory) db.photoHistory = [];
    if(!db.commentBank) db.commentBank = seedDB().commentBank;
    if(!db.sickbay) db.sickbay = [];
    if(!db.readTop) db.readTop = [];
    if(!db.readLog) db.readLog = [];
    if(!db.resultViews) db.resultViews = [];
    if(!db.bestStudent) db.bestStudent = {name:"",class:"",score:0,parts:{},term:"",session:"",published:false,date:""};
    if(!("timetable" in db)) db.timetable = null;
    (db.alumni||[]).forEach(a=>{ if(!a.status) a.status="Approved"; });
    (db.suggestions||[]).forEach(g=>{ if(typeof g.votes!=="number") g.votes=0; });
    (db.homework||[]).forEach(h=>{ if(!Array.isArray(h.photos)) h.photos=[]; });
    if(!db.transportRoutes) db.transportRoutes = seedDB().transportRoutes;
    if(!db.transport) db.transport = [];
    if(!db.volunteers) db.volunteers = [];
    if(!db.pta) db.pta = [];
    if(!db.ptaLevy) db.ptaLevy = {amount:0,note:""};
    if(!db.ptaMeetings) db.ptaMeetings = seedDB().ptaMeetings;
    if(!db.ptaAttend||Array.isArray(db.ptaAttend)) db.ptaAttend = {};
    if(!db.bdayWishes) db.bdayWishes = {};
    if(!db.school.gradDate) db.school.gradDate = "2027-07-23";
    if(!(db.teachers||[]).some(t=>t.class==="Nursery 1")) db.teachers.push({id:"T007",pin:"1234",name:"Mrs Salihu Nanahawa",phone:"-",class:"Nursery 1",subjects:["Literacy","Numeracy","Phonics"],dob:"1991-05-22"});
    if(db.seq.rcpt==null) db.seq.rcpt = 0;
    (db.registrations||[]).forEach(r=>{ if(r.payment&&r.payment.status==="Paid"&&!r.payment.receipt){ db.seq.rcpt++; r.payment.receipt="TA/"+new Date().getFullYear()+"/"+String(db.seq.rcpt).padStart(4,"0"); } });
    /* retire school-bus content (no buses anymore) + backfill story extras */
    if(db.promotions) db.promotions = db.promotions.filter(p=>!/bus/i.test((p.badge||"")+" "+(p.title||"")+" "+(p.text||"")));
    (db.notices||[]).forEach(n=>{ if(!n.readBy) n.readBy=[]; });
    (db.newsEvents||[]).forEach((n,i)=>{
      if(n.likes==null) n.likes = 0;
      if(n.views==null) n.views = 0;
      if(!n.images) n.images = [];
      if(n.story && /school buses/.test(n.story)) n.story = n.story.replace("Transport is in our school buses with teachers and minders.", "Pupils will travel together with their teachers and minders.");
    });
    if(!db.classPages) db.classPages = seedDB().classPages;
    if(!db.shopItems) db.shopItems = seedDB().shopItems;
    if(!db.school.emergency) db.school.emergency = {on:false,text:""};
    if(db.school.emergency.start===undefined) db.school.emergency.start="";
    if(db.school.emergency.end===undefined) db.school.emergency.end="";
    if(!db.timetables) db.timetables = {};
    if(!db.calendar) db.calendar = seedDB().calendar;
    /* Prune only genuinely stale events. This used to delete everything before
       today on every load, so the term calendar shrank as the term progressed
       and the printed calendar lost its earlier entries. Keep the current
       session (365 days) so past-but-relevant dates still show (dimmed by
       calendar.html), and drop leftovers from previous years. */
    db.calendar=(db.calendar||[]).filter(c=>c.date>=U.staleBefore());
    if(!db.school.fees) db.school.fees = seedDB().school.fees;
    if(!db.restock) db.restock = [];
    if(!db.teacherVotes) db.teacherVotes = {};
    if(!db.lostfound) db.lostfound = [];
    if(!db.school.photoWeek) db.school.photoWeek = {src:"",cap:""};
    (db.shopItems||[]).forEach(it=>{ if(!it.img) it.img = U.shopImg(it.id)||""; });
    (db.registrations||[]).forEach(r=>{ r.payment=r.payment||{status:"Unpaid",method:""}; if(!Array.isArray(r.payment.history))r.payment.history=[]; });
    (db.shopItems||[]).forEach(it=>{ if(it.qty==null) it.qty=20; });
    if(!db.school.moniepoint) db.school.moniepoint = {account:"", bank:"Moniepoint MFB", pos:true, monnifyKey:""};
    if(!db.seq.order) db.seq.order = 1;
    return db;
  },
  /* Saving must never fail silently. Browser storage is finite (photos are
     stored as base64) and once it fills, setItem throws - previously that
     exception escaped and the staff member's attendance or results were lost
     with no message at all. Report it instead, and tell them what to do. */
  save(db){
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch (err) {
      const full = err && (err.name === "QuotaExceededError" ||
                           err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
                           err.code === 22);
      const msg = full
        ? "This device's storage is full, so your last change was NOT saved. " +
          "Remove some uploaded photos, then try again."
        : "Your last change could not be saved on this device.";
      try { console.error("DB.save failed:", err); } catch (e) {}
      /* Most call sites do `DB.save(db); U.toast("Saved!")` without checking
         the result, which would tell staff their work was stored when it was
         not. Flag the failure so U.toast can veto the success message that is
         about to fire. */
      try { DB._saveFailedAt = Date.now(); } catch (e) {}
      try {
        if (window.U && U.toast) U.toast(msg);
        else if (typeof alert === "function") alert(msg);
      } catch (e) {}
      return false;
    }
    try { if (window.Sync) Sync.pushSoon(); } catch (e) {}
    return true;
  },
  reset(){ localStorage.removeItem(DB_KEY); OLD_DB_KEYS.forEach(k=>localStorage.removeItem(k)); return DB.load(); },
  expireRegs(db){
    let changed=false; const now=Date.now();
    (db.lostfound||[]).forEach(l=>{
      if(!l.claimed&&!l.archived&&l.date&&U.daysUntil(l.date)<-60){ l.archived=true; changed=true; }
    });
    (db.registrations||[]).forEach(r=>{
      if(r.status==="Pending" && new Date(r.expiry).getTime() < now){ r.status="Expired"; changed=true; }
    });
    if(changed){ try{localStorage.setItem(DB_KEY,JSON.stringify(db));}catch(e){} }
  }
};

/* ---------------- Auth (remember-device sessions) ---------------- */
const Auth = {
  staffLogin(role, id, pin){
    const db = DB.load();
    id = (id||"").trim().toUpperCase(); pin = (pin||"").trim();
    if(role==="admin"){
      const a = db.admins.find(x=>x.id.toUpperCase()===id && x.pin===pin);
      if(a) return {role, refId:a.id, name:a.name, label:"Headmistress / Admin"};
    }
    if(role==="teacher"){
      const key = U.phoneKey(id);
      const t = db.teachers.find(x=>((x.id||"").toUpperCase()===id||(key&&U.phoneKey(x.phone)===key)) && x.pin===pin);
      if(t) return {role, refId:t.id, name:t.name, label:"Teacher • "+t.class};
    }
    return null;
  },
  pupilFind(adm){
    const db = DB.load(), q=(adm||"").trim().toUpperCase(), key=U.phoneKey(adm);
    return db.pupils.find(x=>((x.adm||"").toUpperCase()===q||(x.id||"").toUpperCase()===q||(key&&U.phoneKey(x.phone)===key)))||null;
  },
  pupilLogin(adm, password){
    const db = DB.load(), q=(adm||"").trim().toUpperCase(), key=U.phoneKey(adm), pw=password||"";
    const cands = db.pupils.filter(x=>((x.adm||"").toUpperCase()===q||(x.id||"").toUpperCase()===q||(key&&U.phoneKey(x.phone)===key)));
    if(!cands.length) return {ok:false, reason:"notfound"};
    const exact = cands.find(x=>((x.adm||"").toUpperCase()===q||(x.id||"").toUpperCase()===q));
    if(exact){
      if(!exact.password) return {ok:false, reason:"nopassword", pupil:exact};
      if(exact.password!==pw) return {ok:false, reason:"wrongpass", pupil:exact};
      return {ok:true, session:{role:"pupil", refId:exact.id, name:exact.name, label:"Pupil • "+exact.class}};
    }
    const withPw = cands.filter(p=>p.password);
    if(!withPw.length) return {ok:false, reason:"nopassword", pupil:cands[0]};
    const hit = withPw.find(p=>p.password===pw);
    if(!hit) return {ok:false, reason:"wrongpass", pupil:withPw[0]};
    return {ok:true, session:{role:"pupil", refId:hit.id, name:hit.name, label:"Pupil • "+hit.class}};
  },
  setPassword(adm, password){
    const db = DB.load(), q=(adm||"").trim().toUpperCase(), key=U.phoneKey(adm);
    const cands = db.pupils.filter(x=>((x.adm||"").toUpperCase()===q||(x.id||"").toUpperCase()===q||(key&&U.phoneKey(x.phone)===key)));
    if(!cands.length) return false;
    cands.forEach(p=>{ p.password=password; }); DB.save(db); return true;
  },
  /* persistent=true → remembered on this device until logout */
  set(s, persistent){
    try{
      if(persistent === false){ sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); localStorage.removeItem(SESSION_KEY); }
      else { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); sessionStorage.removeItem(SESSION_KEY); }
    }catch(e){ try{localStorage.setItem(SESSION_KEY, JSON.stringify(s));}catch(e2){} }
  },
  get(){ try{ return JSON.parse(localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY)); }catch(e){ return null; } },
  logout(){ try{localStorage.removeItem(SESSION_KEY);sessionStorage.removeItem(SESSION_KEY);}catch(e){} location.href = "login.html"; },
  guard(role){
    const s = Auth.get();
    if(!s || s.role!==role) location.href = "login.html";
    return s;
  },
  rememberGet(){ try{return localStorage.getItem(REMEMBER_KEY)||"";}catch(e){return "";} },
  rememberSet(v){ try{ v?localStorage.setItem(REMEMBER_KEY,v):localStorage.removeItem(REMEMBER_KEY);}catch(e){} }
};

/* ---------------- Idle auto-logout (shared phones) ---------------- */
const IdleLogout={
  t:null,warnAt:0,outAt:0,shown:false,cfg:{warnMs:58*60e3,outMs:60*60e3},
  init(cfg){
    if(this.t||!document.getElementById("sideNav"))return;
    Object.assign(this.cfg,cfg||{});
    this.reset();
    ["click","keydown","touchstart","mousemove"].forEach(e=>document.addEventListener(e,()=>this.reset(),{passive:true}));
    this.t=setInterval(()=>this.check(Date.now()),1000);
  },
  reset(){
    const n=Date.now(); this.warnAt=n+this.cfg.warnMs; this.outAt=n+this.cfg.outMs;
    if(this.shown){ this.shown=false; const o=document.getElementById("idleVeil"); if(o)o.remove(); }
  },
  check(n){
    if(n>=this.outAt){ if(this.t)clearInterval(this.t); this.t=null; try{Auth.logout();}catch(e){ try{location.href="login.html";}catch(e2){} } return "out"; }
    if(n>=this.warnAt&&!this.shown){ this.shown=true; this.show(); return "warn"; }
    if(this.shown){ const s=Math.max(0,Math.ceil((this.outAt-n)/1000)); const el=document.getElementById("idleCount"); if(el)el.textContent=Math.floor(s/60)+":"+String(s%60).padStart(2,"0"); }
    return this.shown?"warn":"ok";
  },
  show(){
    if(document.getElementById("idleVeil"))return;
    const v=document.createElement("div"); v.id="idleVeil"; v.className="idle-veil";
    v.innerHTML='<div class="idle-box"><h2>Still there?</h2><p>You will be logged out in <b id="idleCount">--:--</b> for safety on shared phones.</p><button class="btn btn-mint" id="idleStay">Stay Logged In</button></div>';
    document.body.appendChild(v);
    document.getElementById("idleStay").onclick=()=>this.reset();
  }
};

/* ---------------- Testimonials ---------------- */
const Testimonials = {
  open(prefillName, prefillRole){
    const old=document.getElementById("tmModal"); if(old) old.remove();
    const m=document.createElement("div");
    m.className="modal-bg show"; m.id="tmModal";
    m.innerHTML=`<div class="modal" style="max-width:480px">
      <h2>Share Your Testimonial</h2>
      <p style="color:var(--muted);font-size:.87rem;margin-bottom:14px">Thank you! The headmistress will review it before it appears on the website.</p>
      <div class="form-grid" style="grid-template-columns:1fr">
        <div class="field"><label>Your Name</label><input id="tmName" value="${U.esc(prefillName||"")}"></div>
        <div class="field"><label>You are a...</label><input id="tmRole" value="${U.esc(prefillRole||"")}" placeholder="e.g. Parent (Primary 1), Teacher, Pupil"></div>
        <div class="field"><label>Your Rating</label><select id="tmStars"><option value="5">★★★★★ (5)</option><option value="4">★★★★ (4)</option><option value="3">★★★ (3)</option><option value="2">★★ (2)</option><option value="1">★ (1)</option></select></div>
        <div class="field"><label>Your Testimonial</label><textarea id="tmText" rows="4" placeholder="What do you love about Treasure Academy?"></textarea></div>
      </div>
      <div style="display:flex;gap:10px;margin-top:16px"><button class="btn btn-mint btn-sm" onclick="Testimonials.submit()">Submit</button><button class="btn btn-white btn-sm" onclick="document.getElementById('tmModal').remove()">Cancel</button></div>
    </div>`;
    document.body.appendChild(m);
    m.addEventListener("click",e=>{ if(e.target.id==="tmModal") m.remove(); });
  },
  submit(){
    const n=document.getElementById("tmName").value.trim(), r=document.getElementById("tmRole").value.trim(), t=document.getElementById("tmText").value.trim();
    if(!n||!t){ U.toast("Please enter your name and testimonial."); return; }
    const db=DB.load();
    db.testimonials.unshift({id:"TM"+(db.seq.tm++), name:n, role:r||"Friend of the school", text:t, stars:+document.getElementById("tmStars").value||5, status:"Pending", date:U.todayStr()});
    DB.save(db); document.getElementById("tmModal").remove();
    U.toast("Thank you! Sent to the headmistress for approval.");
  },
  approve(id){ const db=DB.load(); const t=db.testimonials.find(x=>x.id===id); if(t){t.status="Approved";DB.save(db);} Testimonials.adminList("tmList"); U.toast("Testimonial approved — now on the website."); },
  del(id){ if(!confirm("Delete this testimonial?"))return; const db=DB.load(); db.testimonials=db.testimonials.filter(x=>x.id!==id); DB.save(db); Testimonials.adminList("tmList"); },
  adminList(elId){
    const box=document.getElementById(elId); if(!box) return;
    const db=DB.load();
    box.innerHTML=(db.testimonials||[]).map(t=>`<div class="notice ${t.status==="Approved"?"read":""}"><span class="dot"></span>
      <div style="flex:1"><b>${U.esc(t.name)}</b> <span style="color:#C9A227">${"★".repeat(t.stars||5)}</span> <small style="color:var(--muted)">(${U.esc(t.role)} • ${t.date})</small> <span class="badge ${t.status==="Approved"?"b-green":"b-sun"}">${t.status}</span><br>${U.esc(t.text)}</div>
      <div class="row-actions">${t.status!=="Approved"?`<button class="icon-btn ok" onclick="Testimonials.approve('${t.id}')">Approve</button>`:""}<button class="icon-btn del" onclick="Testimonials.del('${t.id}')">Delete</button></div>
    </div>`).join("")||'<div class="empty">No testimonials yet.</div>';
  }
};

/* ---------------- Utils ---------------- */
const U = {
  /* modern SVG icon set — usage: U.icon("home",18) */
  icon(n,s){ s=s||18;
    const P={
      home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
      clipboard:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4a2 2 0 0 1 6 0"/><path d="M9 13l2 2 4-4"/>',
      filetext:'<path d="M6 2h8l4 4v16H6z"/><path d="M14 2v4h4"/><path d="M9 12h6M9 16h6"/>',
      users:'<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5c2.8.4 5 2.6 5 5.5"/>',
      user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
      calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
      calcheck:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M9 15l2 2 4-4"/>',
      award:'<circle cx="12" cy="9" r="5"/><path d="M8.5 13.5L7 22l5-2.5L17 22l-1.5-8.5"/>',
      chart:'<path d="M5 20v-6M11 20V6M17 20v-9"/><path d="M3 20h18"/>',
      mega:'<path d="M4 10v5h3l7 5V5L7 10H4z"/><path d="M17 8a4 4 0 0 1 0 8"/>',
      news:'<path d="M4 5h13v14H6a2 2 0 0 1-2-2z"/><path d="M17 8h2a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2"/><path d="M7 9h7M7 13h7"/>',
      message:'<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12.5h5"/>',
      chat:'<path d="M21 12a8 8 0 0 1-8 8H4l2.3-2.9A8 8 0 1 1 21 12z"/>',
      star:'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
      book:'<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
      bell:'<path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/>',
      gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>',
      wallet:'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="17" cy="15" r="1.2"/>',
      logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
      menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
      search:'<circle cx="11" cy="11" r="6"/><path d="M16 16l5 5"/>',
      plus:'<path d="M12 5v14M5 12h14"/>',
      edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
      trash:'<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>',
      check:'<path d="M5 13l4 4L19 7"/>',
      x:'<path d="M6 6l12 12M18 6L6 18"/>',
      eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
      download:'<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/>',
      print:'<path d="M7 8V3h10v5"/><rect x="4" y="8" width="16" height="8" rx="2"/><rect x="7" y="14" width="10" height="7"/>',
      clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
      grad:'<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5"/><path d="M22 9v5"/>',
      shield:'<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9.5 12l2 2 3.5-4"/>',
      phone:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
      mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
      pin:'<path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
      card:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="11" r="2"/><path d="M5 16c.8-1.5 2-2 3.5-2s2.7.5 3.5 2M14 10h5M14 14h5"/>',
      chev:'<path d="M9 6l6 6-6 6"/>',
      bag:'<path d="M6 8h15l-1.5 12.5a1 1 0 0 1-1 .5H8.5a1 1 0 0 1-1-.5z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/>',
      shirt:'<path d="M9 4L4 7l2 4 2-1v10h8V10l2 1 2-4-5-3a3 3 0 0 1-6 0z"/>',
      gift:'<rect x="4" y="9" width="16" height="4" rx="1"/><path d="M6 13v7h12v-7M12 9v11M12 9S8 9 7 7.5 8.5 4.5 10 6s2 3 2 3zm0 0s4 0 5-1.5S15.5 4.5 14 6s-2 3-2 3z"/>',
      thumb:'<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>'
    };
    return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]||P.chev}</svg>`;
  },
  /* pick a shop icon from the item name */
  autoIcon(name){
    const n=String(name||"");
    if(/uniform|shirt|sport|wear|cardigan|beret|sock|bib|towel/i.test(n)) return "shirt";
    if(/bag|pack/i.test(n)) return "bag";
    if(/pen|pencil|crayon|ruler|eraser|draw|writ/i.test(n)) return "edit";
    if(/note|primer|phonic/i.test(n)) return "filetext";
    if(/novel|story/i.test(n)) return "news";
    if(/book|math|english|reason|science|text/i.test(n)) return "book";
    return "star";
  },
  shopImg(id){ const M={textbooks:["S01","S02","S03","S04","S05","S06","S08"],workbooks:["S07","S16","S17"],notebooks:["S09","S14","S15"],pens:["S10"],stationery:["S11","S12"],crayons:["S13"],creche:["S18","S19","S20"],uniform:["S21","S25"],sportswear:["S22","S23"],bag:["S24"]};
    for(const k in M){ if(M[k].includes(id)) return "assets/img/shop-"+k+".jpg"; } return ""; },
  shopCat(id){ const M={Textbooks:["S01","S02","S03","S04","S05","S06","S08"],Workbooks:["S07","S16","S17"],Notebooks:["S09","S14","S15"],Pens:["S10"],Stationery:["S11","S12"],"Crayons & Art":["S13"],Creche:["S18","S19","S20"],Uniform:["S21","S25"],Sportswear:["S22","S23"],Bags:["S24"]};
    for(const k in M){ if(M[k].includes(id)) return k; } return "Others"; },
  noticeActive(n){ return !n||!n.expiry||n.expiry>=new Date().toISOString().slice(0,10); },
  isNew(dateStr){ const t=new Date((dateStr||"")+"T12:00:00").getTime(); if(!t) return false; const d=(Date.now()-t)/86400000; return d>=-7&&d<=7; },
  bdayNext(dob){ const p=String(dob||"").split("-"); const m=+p[1],dd=+p[2]; if(p.length<3||!(m>=1&&m<=12)||!(dd>=1&&dd<=31))return null; const t=new Date(); t.setHours(0,0,0,0); let n=new Date(t.getFullYear(),m-1,dd); if(n<t)n=new Date(t.getFullYear()+1,m-1,dd); return n; },
  bdayList(db){ const out=[]; const hd=((db.school||{}).headDob)||"";
    if(hd){const d=U.bdayNext(hd); if(d)out.push({name:(db.school||{}).headName||"Headmistress",role:"Headmistress",d,photo:(db.school||{}).headPhoto||""});}
    (db.teachers||[]).filter(t=>t.dob).forEach(t=>{const d=U.bdayNext(t.dob); if(d)out.push({name:t.name,role:(t.class||"Staff")+" Class Teacher",d,photo:t.photo||""});});
    return out.sort((a,b)=>a.d-b.d); },
  /* default weekly timetable (headmistress can override per class) */
  timetable(cls){
    const subs=subjectsFor(cls), days=["Monday","Tuesday","Wednesday","Thursday","Friday"], t={};
    days.forEach((d,di)=>{ const rot=subs.slice(di).concat(subs.slice(0,di)), row=["Assembly"];
      for(let p=0;p<6;p++){ row.push(rot[(p+di)%rot.length]); if(p===2)row.push("Break"); }
      row.push("Closing"); t[d]=row; });
    return t;
  },
  getTimetable(db,cls){ return db.timetable||((db.timetables||{})[cls])||U.timetable(cls); },
  ttSlots(){ return ["Assembly","1st Period","2nd Period","3rd Period","Break","4th Period","5th Period","6th Period","Closing"]; },
  todayStr(){ return new Date().toISOString().slice(0,10); },
  /* Oldest calendar date worth keeping: one session back from today. */
  staleBefore(){ const d=new Date(); d.setDate(d.getDate()-365); return d.toISOString().slice(0,10); },
  phoneKey(ph){ const d=String(ph||"").replace(/\D/g,""); return d.length>=7?d.slice(-10):""; },
  compressPhotos(input,max,cb){
    const files=[...(input&&input.files||[])].slice(0,max||3);
    if(!files.length){ cb([]); return; }
    const out=[];
    const next=i=>{
      if(i>=files.length){ cb(out); return; }
      const rd=new FileReader();
      rd.onload=()=>{ const img=new Image();
        img.onload=()=>{ try{
          const sc=Math.min(1,900/Math.max(img.width||1,img.height||1));
          const c=document.createElement("canvas"); c.width=Math.max(1,Math.round(img.width*sc)); c.height=Math.max(1,Math.round(img.height*sc));
          c.getContext("2d").drawImage(img,0,0,c.width,c.height);
          out.push(c.toDataURL("image/jpeg",0.72));
        }catch(e){} next(i+1); };
        img.onerror=()=>next(i+1); img.src=rd.result; };
      rd.onerror=()=>next(i+1); rd.readAsDataURL(files[i]);
    };
    next(0);
  },
  speak(text){
    text=String(text||"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
    if(!text) return;
    try{
      if(!("speechSynthesis" in window)){ U.toast("Voice not supported on this device."); return; }
      speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance(text.slice(0,600));
      u.rate=0.95; u.lang="en-NG";
      speechSynthesis.speak(u);
    }catch(e){ U.toast("Voice not available."); }
  },
  streak(db,pupilId){
    const recs=(db.attendance||[]).filter(a=>a.records&&a.records[pupilId]).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    let n=0;
    for(const a of recs){ const m=a.records[pupilId]; if(m==="P"||m==="L") n++; else break; }
    const stars=n>=30?3:n>=15?2:n>=5?1:0;
    return {days:n,stars};
  },
  midterm(r){
    const subs=Object.keys(r.scores||{});
    const rows=subs.map(su=>{ const sc=r.scores[su]||{}; const ca=(+sc.ca1||0)+(+sc.ca2||0); return {sub:su,ca1:+sc.ca1||0,ca2:+sc.ca2||0,ca}; });
    const avg=rows.length?Math.round(rows.reduce((a,x)=>a+x.ca,0)/rows.length):0;
    return {rows,avg,total:rows.reduce((a,x)=>a+x.ca,0),max:rows.length*40};
  },
  bestRank(db,term,session){
    const pubs=(db.pupils||[]).filter(p=>(db.results||[]).some(r=>r.pupilId===p.id&&r.term===term&&r.session===session&&r.status==="Published"));
    const revs=(db.testimonials||[]).filter(t=>t.status==="Approved");
    return pubs.map(p=>{
      const r=db.results.find(x=>x.pupilId===p.id&&x.term===term&&x.session===session&&x.status==="Published");
      const sm=U.reportSummary(db,p.id,r.class,term,session);
      const att=U.attendancePct(db,p.id);
      const reg=(db.registrations||[]).find(x=>(x.ward.first+" "+x.ward.surname).toLowerCase()===String(p.name||"").toLowerCase());
      const paid=reg&&reg.payment?reg.payment.status==="Paid":false;
      const partial=reg&&reg.payment?((reg.payment.parts||[]).length>0||!!reg.payment.claim):false;
      const sur=String(p.parent||"").toLowerCase().split(/\s+/).filter(w=>w.length>2).slice(-1)[0]||"";
      const reviewed=sur?revs.some(t=>String(t.name||"").toLowerCase().includes(sur)):false;
      const books=(db.orders||[]).some(o=>["Collected","Confirmed"].includes(o.status)&&String(o.pupil||"").toLowerCase()===String(p.name||"").toLowerCase()&&(o.items||[]).some(i=>/book|text|novel|read/i.test(i.name||"")));
      const parts={att:att==null?0:Math.round(att/100*20),fees:paid?20:partial?10:0,review:reviewed?10:0,books:books?10:0,res:Math.round((sm.avg||0)/100*40)};
      return {p,avg:sm.avg||0,att,parts,score:parts.att+parts.fees+parts.review+parts.books+parts.res};
    }).sort((a,b)=>b.score-a.score||b.avg-a.avg);
  },
  weekdayName(dateStr){
    const d = dateStr ? new Date(dateStr+"T12:00:00") : new Date();
    return d.toLocaleDateString("en-NG",{weekday:"long"});
  },
  prettyDate(dateStr){
    const d = new Date((dateStr||U.todayStr())+"T12:00:00");
    return d.toLocaleDateString("en-NG",{weekday:"long", day:"numeric", month:"long", year:"numeric"});
  },
  shortDate(dateStr){
    const d = new Date((dateStr||U.todayStr())+"T12:00:00");
    return d.toLocaleDateString("en-NG",{day:"numeric", month:"short", year:"numeric"});
  },
  daysUntil(dateStr){
    const ms = new Date(dateStr+"T23:59:59").getTime() - Date.now();
    return Math.ceil(ms/86400000);
  },
  esc(s){ return String(s??"").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); },
  initials(name){ return String(name||"?").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase(); },
  avatarColor(name){ const cols=["#B78A12","#C0392B","#2471B8","#0F6B3A","#5A3396","#B25A12"]; let h=0; for(const c of String(name)) h+=c.charCodeAt(0); return cols[h%cols.length]; },
  total(sc){ return (+sc.ca1||0)+(+sc.ca2||0)+(+sc.exam||0); },
  grade(t){ if(t>=70) return "A"; if(t>=60) return "B"; if(t>=55) return "C"; if(t>=50) return "D"; if(t>=40) return "E"; return "F"; },
  remark(t){ if(t>=70) return "Excellent"; if(t>=60) return "Very Good"; if(t>=55) return "Good"; if(t>=50) return "Fair"; if(t>=40) return "Weak"; return "Fail"; },
  payAccountsHTML(db){
    const bk=((db.school||{}).bank||{}), mp=((db.school||{}).moniepoint||{});
    let h = bk.number
      ? `<div class="notice"><span class="dot" style="background:var(--sun)"></span><div style="font-size:.85rem">Pay by transfer to:<br><b>${U.esc(bk.name)}</b> • <b>${U.esc(bk.number)}</b><br>${U.esc(bk.holder||"")}</div></div>`
      : `<div class="notice"><span class="dot" style="background:var(--sun)"></span><div style="font-size:.85rem">Ask the school office for the <b>account details</b>, then pay by bank transfer.</div></div>`;
    if(mp.account) h += `<div class="notice"><span class="dot" style="background:var(--sky)"></span><div style="font-size:.85rem">Or pay to our Moniepoint account:<br><b>${U.esc(mp.bank||"Moniepoint MFB")}</b> • <b>${U.esc(mp.account)}</b></div></div>`;
    if(mp.pos) h += `<div class="notice"><span class="dot" style="background:var(--mint)"></span><div style="font-size:.85rem">You can also pay with your card on our <b>POS machine</b> at the school office.</div></div>`;
    return h;
  },
  naira(n){ return "\u20A6" + Number(n||0).toLocaleString("en-NG"); },
  toast(msg){
    /* A save that just failed must not be followed by "Saved!". DB.save marks
       the failure; anything reassuring fired in the next moment is replaced by
       the truth, so staff never think their work was stored when it was lost. */
    try {
      if (typeof DB !== "undefined" && DB._saveFailedAt &&
          (Date.now() - DB._saveFailedAt) < 1500 &&
          /saved|success|updated|added|posted|sent|recorded|published/i.test(String(msg))) {
        msg = "NOT saved — this device's storage is full. Remove some uploaded photos and try again.";
      }
    } catch (e) {}
    let t=document.getElementById("toast"); if(!t){ t=document.createElement("div"); t.id="toast"; document.body.appendChild(t);} t.textContent=msg; t.classList.add("show"); clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove("show"),3000); },
  teacherName(db, tid){ const t=db.teachers.find(x=>x.id===tid); return t?t.name:"—"; },
  pupil(db, pid){ return db.pupils.find(x=>x.id===pid); },
  dutyToday(db){
    const day = U.weekdayName();
    if(!["Monday","Tuesday","Wednesday","Thursday","Friday"].includes(day)) return {day, teachers:[]};
    const row = db.duty.find(r=>r.day===day);
    return {day, teachers: row?row.teachers:[]};
  },
  myDutyDays(db, tid){ return db.duty.filter(r=>r.teachers.includes(tid)).map(r=>r.day); },
  reportSummary(db, pupilId, cls, term, session){
    const r = db.results.find(x=>x.pupilId===pupilId && x.class===cls && x.term===term && x.session===session);
    if(!r) return null;
    const subs = subjectsFor(cls);
    let sum=0, n=0;
    subs.forEach(s=>{ if(r.scores[s]){ sum+=U.total(r.scores[s]); n++; } });
    const avg = n? sum/n : 0;
    const mates = db.pupils.filter(p=>p.class===cls);
    const avgs = mates.map(m=>{
      const rr = db.results.find(x=>x.pupilId===m.id && x.class===cls && x.term===term && x.session===session);
      if(!rr) return {id:m.id, avg:-1};
      let s2=0,n2=0; subs.forEach(su=>{ if(rr.scores[su]){ s2+=U.total(rr.scores[su]); n2++; } });
      return {id:m.id, avg: n2? s2/n2 : -1};
    }).filter(x=>x.avg>=0).sort((a,b)=>b.avg-a.avg);
    const pos = avgs.findIndex(x=>x.id===pupilId)+1;
    return {result:r, avg, position: pos||"—", outOf: avgs.length||mates.length};
  },
  ordinal(n){ if(n==="—") return "—"; const s=["th","st","nd","rd"], v=n%100; return n+(s[(v-20)%10]||s[v]||s[0]); },
  attendancePct(db, pupilId){
    const recs = db.attendance.filter(a=>a.records[pupilId]);
    if(!recs.length) return null;
    const present = recs.filter(a=>a.records[pupilId]==="P"||a.records[pupilId]==="L").length;
    return Math.round(present/recs.length*100);
  },
  genPassword(name){
    const clean = String(name||"Treasure").replace(/[^a-zA-Z]/g,"");
    const part = (clean.slice(0,3)||"Tre").toLowerCase();
    const cap = part.charAt(0).toUpperCase()+part.slice(1);
    return cap + Math.floor(100+Math.random()*900) + "!TA";
  },
  youtubeEmbed(url){
    if(!url) return "";
    const m = String(url).match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
    return m ? "https://www.youtube.com/embed/"+m[1] : "";
  },
  isMp4(url){ return /\.(mp4|webm|ogg)(\?|$)/i.test(String(url||"")); },
  /* download any file (same-origin) */
  downloadFile(url, filename){
    U.toast("Download starting...");
    fetch(url).then(r=>{ if(!r.ok) throw 0; return r.blob(); }).then(b=>{
      const a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download=filename||url.split("/").pop().split("?")[0]||"download";
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),4000);
    }).catch(()=>{ window.open(url,"_blank"); });
  },
  photoFile(inp,targetId,prevId){
    const f=inp.files&&inp.files[0]; if(!f)return;
    if(f.size>800*1024){ U.toast("Photo too big — use an image under 800KB."); inp.value=""; return; }
    const r=new FileReader();
    r.onload=()=>{ document.getElementById(targetId).value=r.result; const pv=document.getElementById(prevId); if(pv){ pv.src=r.result; pv.style.display=""; } };
    r.readAsDataURL(f);
  },
  admFormHTML(c,s){
    c=c||{}; s=s||{}; const f=(c.form||{});
    const v=k=>U.esc(f[k]||"");
    const row=(label,val,full)=>`<div class="adm-f${full?" full":""}"><b>${label}</b><br>${val||"&nbsp;"}</div>`;
    const paid=c.status==="Confirmed";
    const initials=String(s.name||"TA").split(/\s+/).map(w=>w[0]).join("").slice(0,3);
    return `<div class="adm-replica">
      <div class="adm-head"><div class="adm-crest">${U.esc(initials)}<br>★</div>
      <div class="adm-title"><h2>${U.esc((s.name||"").toUpperCase())}</h2>
      <p>${U.esc(s.address||"")}</p><p>MOTTO: ${U.esc((s.motto||"").toUpperCase())}</p>
      <p>TELL: ${U.esc(s.phone||"")} &nbsp; EMAIL: ${U.esc(s.email||"")}</p></div></div>
      <div class="adm-formname">ENTRANCE APPLICATION FORM</div>
      <div class="adm-pass">${f.photo?`<img src="${U.esc(f.photo)}" alt="passport">`:"Passport"}</div>
      <div class="adm-instr"><b>Instruction:</b> Fill this form carefully IN CAPITAL LETTERS and return it to the school office with your payment receipt <b>within two weeks</b>. Form Code: <b>${U.esc(c.code||"")}</b></div>
      <div style="clear:both"></div>
      <div class="adm-grid">
        ${row("Surname",v("surname"))}${row("Middle Name",v("middle"))}${row("First Name",v("first"))}
        ${row("Date of Birth",v("dob"))}${row("Sex",v("sex"))}${row("Age",v("age"))}
        ${row("Place of Birth",v("pob"))}${row("L.G.A",v("lga"))}${row("State of Origin",v("state"))}
        ${row("Home Town",v("town"))}${row("Tribe",v("tribe"))}${row("Nationality",v("nation"))}
        ${row("Religion",v("religion"))}${row("Height",v("height"))}${row("Candidate Address",v("address"),1)}
        ${row("Schools Attended (with dates)",v("schools"),1)}
        ${row("Class Last Attended",v("lastclass"))}${row("Present Class Requested",v("reqclass"))}
        ${row("Father/Guardian Name",v("father"))}${row("Occupation",v("fatherocc"))}${row("GSM No",v("fathergsm"))}
        ${row("Mother/Guardian Name",v("mother"))}${row("Occupation",v("motherocc"))}${row("GSM No",v("mothergsm"))}
        ${row("Any health problems?",v("health"))}${row("If yes, state details",v("healthdet"))}
      </div>
      <div class="adm-sec">UNDERTAKING</div>
      <p style="font-size:.85rem">I <b>${v("first")} ${v("surname")}</b> hereby undertake that I will be of good behaviour within and without being in school. I shall keep the rules and regulations of the school, society at large. So help me God.</p>
      <div class="adm-sig"><div>Parent's Signature/Date: ....................</div><div>Candidate Signature/Date: ....................</div></div>
      <div class="adm-sec">FOR OFFICE USE</div>
      <p style="font-size:.85rem">Principal Recommendation: ....................................................................................</p>
      <p style="font-size:.85rem">Authority Signature/Date: .................... &nbsp; Form Fee: <b>${U.naira(+c.amount||0)}</b> • Ref: ${U.esc(c.ref||"")} • Receipt: <b>${U.esc(c.receipt||"To be issued")}</b></p>
      <div style="text-align:center"><span class="adm-stamp${paid?"":" unpaid"}">${paid?"PAID":"PAYMENT UNCONFIRMED"}</span></div>
    </div>`;
  },
  /* download a report card as a standalone file */
  downloadReport(resultId){
    const db=DB.load(); const r=db.results.find(x=>x.id===resultId); if(!r) return;
    const p=U.pupil(db,r.pupilId); const sm=U.reportSummary(db,r.pupilId,r.class,r.term,r.session);
    const subs=subjectsFor(r.class); const s=db.school;
    const teacher=(db.teachers.find(t=>t.class===r.class)||{}).name||"—";
    const total=subs.reduce((a,su)=>a+(r.scores[su]?U.total(r.scores[su]):0),0);
    const rows=subs.map(su=>{ const sc=r.scores[su]||{ca1:0,ca2:0,exam:0}; const t=U.total(sc);
      return `<tr><td>${U.esc(su)}</td><td>${sc.ca1}</td><td>${sc.ca2}</td><td>${sc.exam}</td><td><b>${t}</b></td><td><b>${U.grade(t)}</b></td><td>${U.remark(t)}</td></tr>`; }).join("");
    const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Report Card - ${U.esc(p?p.name:"")}</title>
<style>body{font-family:Arial,sans-serif;max-width:760px;margin:30px auto;color:#203040;padding:0 16px}h1,h2{text-align:center;margin:4px 0}p{text-align:center;color:#5D6B7D}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#103B26;color:#fff;padding:10px}td{border:1px solid #D9E0E8;padding:8px;text-align:center}td:first-child{text-align:left}.info{display:flex;justify-content:space-between;margin-top:14px}.box{background:#F1F4F8;border-radius:10px;padding:12px 16px;margin-top:14px}</style></head><body>
<h1>${U.esc(s.name)}</h1><p>${U.esc(s.address)} • ${U.esc(s.phone)}<br><b>${U.esc(s.motto)}</b></p>
<h2>Terminal Report Card — ${U.esc(r.term)}, ${U.esc(s.session)}</h2>
<div class="info"><div><b>Name:</b> ${U.esc(p?p.name:"")}<br><b>Admission No:</b> ${p?p.adm:""}<br><b>Gender:</b> ${p?p.gender:""}</div><div><b>Class:</b> ${U.esc(r.class)}<br><b>Class Teacher:</b> ${U.esc(teacher)}</div></div>
<table><tr><th>Subject</th><th>CA1 (20)</th><th>CA2 (20)</th><th>Exam (60)</th><th>Total</th><th>Grade</th><th>Remark</th></tr>${rows}</table>
<div class="box"><b>Total:</b> ${total} &nbsp; • &nbsp; <b>Average:</b> ${sm.avg.toFixed(1)}% &nbsp; • &nbsp; <b>Position:</b> ${U.ordinal(sm.position)} of ${sm.outOf}</div>
<div class="box"><b>Headmistress's Remark:</b> ${sm.avg>=60?"An excellent performance. Keep it up!":sm.avg>=50?"A good result. You can do even better.":"More effort is needed next term."}<br><b>— ${U.esc(s.headName)}, ${U.esc(s.headTitle)}</b></div>
${r.tremark?`<div class="box"><b>Class Teacher's Remark:</b> ${U.esc(r.tremark)}<br><b>— ${U.esc(teacher)}</b></div>`:""}
</body></html>`;
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([html],{type:"text/html"}));
    a.download=`ReportCard_${p?p.adm.replace(/\//g,"-"):""}_${r.term.replace(/ /g,"")}.html`;
    document.body.appendChild(a); a.click(); a.remove();
    U.toast("Report card downloaded.");
  }
};
