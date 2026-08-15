import { stringHash } from "./indian-institutions";

export type IndianEmployeeSeed = {
  surname: string;
  firstName: string;
  middleName: string;
  displayName: string;
  dateOfBirth: string;
  gender: "Male" | "Female";
  seniorityRank: number;
  panNumber: string;
  contactNumber: string;
  customFieldValue: string;
};

const INDIAN_SURNAMES = [
  "Sharma",
  "Kulkarni",
  "Patil",
  "Deshmukh",
  "Banerjee",
  "Iyer",
  "Joshi",
  "Chatterjee",
  "Nair",
  "Verma",
  "Rathore",
  "Bhattacharya",
  "Mukherjee",
  "Gokhale",
  "Sengupta",
];

const INDIAN_MALE_FIRST_NAMES = [
  "Aarav",
  "Rohan",
  "Vikram",
  "Aditya",
  "Rahul",
  "Devendra",
  "Anand",
  "Pranav",
  "Rajesh",
  "Siddharth",
];

const INDIAN_FEMALE_FIRST_NAMES = [
  "Priya",
  "Ananya",
  "Sneha",
  "Pooja",
  "Meera",
  "Sunita",
  "Deepika",
  "Kavita",
  "Ritu",
  "Anjali",
];

const INDIAN_MIDDLE_NAMES = [
  "Kumar",
  "Prasad",
  "Laxman",
  "Chandra",
  "Nath",
  "Kishore",
  "Mohan",
  "Devi",
  "Shankar",
];

const DATES_OF_BIRTH = [
  "1985-05-15",
  "1988-08-22",
  "1990-11-10",
  "1982-03-28",
  "1987-07-19",
  "1992-01-14",
  "1984-09-03",
  "1989-12-25",
];

const PAN_LETTERS = ["ABCDE", "BCDEF", "CDEFG", "DEFGH", "EFGHI", "FGHIJ"];

export const REALISTIC_INDIAN_CUSTOM_FIELDS = [
  "Teacher ID",
  "Employee Code",
  "Staff Biometric ID",
  "Faculty Roll Number",
  "Department Code",
  "State Teacher Code",
];

export function generateRealisticCustomField(runMarker: string): string {
  const hash = stringHash(runMarker);
  const base =
    REALISTIC_INDIAN_CUSTOM_FIELDS[hash % REALISTIC_INDIAN_CUSTOM_FIELDS.length] ?? "Teacher ID";
  return `${base} [${runMarker}]`;
}

export function generateIndianEmployee(runMarker: string): IndianEmployeeSeed {
  const hash = stringHash(runMarker);
  const isFemale = (hash & 1) === 1;
  const gender: "Male" | "Female" = isFemale ? "Female" : "Male";

  const surname = INDIAN_SURNAMES[hash % INDIAN_SURNAMES.length] ?? "Sharma";
  const firstName = isFemale
    ? (INDIAN_FEMALE_FIRST_NAMES[(hash >> 1) % INDIAN_FEMALE_FIRST_NAMES.length] ?? "Priya")
    : (INDIAN_MALE_FIRST_NAMES[(hash >> 1) % INDIAN_MALE_FIRST_NAMES.length] ?? "Aarav");
  const middleName =
    isFemale && ((hash >> 2) & 1) === 1
      ? "Devi"
      : (INDIAN_MIDDLE_NAMES[(hash >> 2) % INDIAN_MIDDLE_NAMES.length] ?? "Kumar");

  const dateOfBirth = DATES_OF_BIRTH[(hash >> 3) % DATES_OF_BIRTH.length] ?? "1985-05-15";
  const seniorityRank = 1;

  const panPrefix = PAN_LETTERS[(hash >> 4) % PAN_LETTERS.length] ?? "ABCDE";
  const panDigits = String((hash % 9000) + 1000);
  const panCheck = String.fromCharCode(65 + ((hash >> 5) % 26));
  const panNumber = `${panPrefix}${panDigits}${panCheck}`;

  const contactDigits = String((hash % 90000000) + 10000000);
  const contactNumber = `98${contactDigits}`;

  const cleanMarker = runMarker.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const customFieldValue = `TCH-${cleanMarker.slice(-6) || "001"}`;

  const displayName = `${surname}, ${firstName} ${middleName}`.trim();

  return {
    surname,
    firstName,
    middleName,
    displayName,
    dateOfBirth,
    gender,
    seniorityRank,
    panNumber,
    contactNumber,
    customFieldValue,
  };
}
