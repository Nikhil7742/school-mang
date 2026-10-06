// Subject configuration for each class.
// Classes 11 & 12 depend on "stream" (Science / Commerce / Arts)

const SUBJECTS = {
  "1": ["Hindi", "English", "Mathematics", "EVS", "Drawing", "GK"],
  "2": ["Hindi", "English", "Mathematics", "EVS", "Drawing", "GK"],
  "3": ["Hindi", "English", "Mathematics", "EVS", "Computer", "Drawing"],
  "4": ["Hindi", "English", "Mathematics", "EVS", "Computer", "Drawing"],
  "5": ["Hindi", "English", "Mathematics", "Science", "Social Science", "Computer"],
  "6": ["Hindi", "English", "Mathematics", "Science", "Social Science", "Sanskrit", "Computer"],
  "7": ["Hindi", "English", "Mathematics", "Science", "Social Science", "Sanskrit", "Computer"],
  "8": ["Hindi", "English", "Mathematics", "Science", "Social Science", "Sanskrit", "Computer"],
  "9": ["Hindi", "English", "Mathematics", "Science", "Social Science", "Computer"],
  "10": ["Hindi", "English", "Mathematics", "Science", "Social Science", "Computer"],
  "11": {
    Science: ["English", "Physics", "Chemistry", "Mathematics", "Biology", "Computer Science"],
    Commerce: ["English", "Accountancy", "Business Studies", "Economics", "Mathematics"],
    Arts: ["English", "History", "Political Science", "Geography", "Economics"]
  },
  "12": {
    Science: ["English", "Physics", "Chemistry", "Mathematics", "Biology", "Computer Science"],
    Commerce: ["English", "Accountancy", "Business Studies", "Economics", "Mathematics"],
    Arts: ["English", "History", "Political Science", "Geography", "Economics"]
  }
};

const EXAM_TYPES = [
  { key: "ut1", label: "Unit Test 1", max: 25 },
  { key: "ut2", label: "Unit Test 2", max: 25 },
  { key: "ut3", label: "Unit Test 3", max: 25 },
  { key: "halfYearly", label: "Half Yearly", max: 100 },
  { key: "final", label: "Final / Annual", max: 100 }
];

function getSubjectsForClass(className, stream) {
  const entry = SUBJECTS[String(className)];
  if (!entry) return [];
  if (Array.isArray(entry)) return entry;
  // class 11/12 -> depends on stream
  return entry[stream] || entry["Science"];
}

function needsStream(className) {
  return ["11", "12"].includes(String(className));
}

module.exports = { SUBJECTS, EXAM_TYPES, getSubjectsForClass, needsStream };
