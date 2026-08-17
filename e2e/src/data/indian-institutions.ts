export type IndianInstitutionSeed = {
  name: string;
  tanNumber: string;
  institutionHead: string;
  address: string;
  username: string;
  password: string;
};

const INDIAN_SCHOOL_NAMES = [
  "Saraswati Vidya Mandir",
  "Bal Vidya Mandir High School",
  "Jnana Prabodhini Prashala",
  "Navodaya English Medium School",
  "Vidya Niketan Higher Secondary School",
  "Maharashtra Rashtriya Vidyalaya",
  "Dr. Radhakrishnan Memorial Public School",
  "Sharada Gurukul Academy",
  "Shivaji Memorial High School",
  "Vivekananda Shikshan Sanstha",
];

const INDIAN_HEADS = [
  "Dr. Sunita Deshmukh",
  "Prof. Rajesh Kulkarni",
  "Dr. Madhav Joshi",
  "Anand Kumar Patil",
  "Sangeeta Ramachandran",
  "Dr. Vikramaditya Shinde",
  "Meenakshi Sundaram",
  "Prof. Arvind Gokhale",
];

const INDIAN_ADDRESSES = [
  "Plot 42, Model Colony, Shivaji Nagar, Pune, Maharashtra 411016",
  "104, SV Road, Andheri West, Mumbai, Maharashtra 400058",
  "12, Tilak Road, Sadashiv Peth, Pune, Maharashtra 411030",
  "Sector 17, Vashi, Navi Mumbai, Maharashtra 400703",
  "88, Mahatma Gandhi Road, Camp, Belagavi, Karnataka 590001",
  "24, Station Road, Dhantoli, Nagpur, Maharashtra 440012",
  "56, Karve Road, Deccan Gymkhana, Pune, Maharashtra 411004",
  "15/B, Bandra Kurla Complex, Bandra East, Mumbai, Maharashtra 400051",
];

const TAN_PREFIXES = ["PUNE", "MUMB", "NGPR", "KOLH", "THNE", "NSHK", "BLGA"];

export function stringHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function generateIndianInstitution(runMarker: string): IndianInstitutionSeed {
  const hash = stringHash(runMarker);
  const baseName =
    INDIAN_SCHOOL_NAMES[hash % INDIAN_SCHOOL_NAMES.length] ?? "Saraswati Vidya Mandir";
  const baseHead = INDIAN_HEADS[(hash >> 2) % INDIAN_HEADS.length] ?? "Dr. Sunita Deshmukh";
  const baseAddress =
    INDIAN_ADDRESSES[(hash >> 4) % INDIAN_ADDRESSES.length] ??
    "Plot 42, Model Colony, Shivaji Nagar, Pune, Maharashtra 411016";
  const tanPrefix = TAN_PREFIXES[(hash >> 6) % TAN_PREFIXES.length] ?? "PUNE";

  const tanDigits = String((hash % 90000) + 10000);
  const tanLetter = String.fromCharCode(65 + ((hash >> 8) % 26));
  const tanNumber = `${tanPrefix}${tanDigits}${tanLetter}`;

  const cleanMarker = runMarker.toLowerCase().replace(/[^a-z0-9]/g, "");
  const username = `inst_${cleanMarker.slice(0, 24)}`;
  const password = `InstPass@${cleanMarker.slice(0, 6)}!99`;

  return {
    name: `${baseName} [${runMarker}]`,
    tanNumber,
    institutionHead: baseHead,
    address: baseAddress,
    username,
    password,
  };
}

export const REALISTIC_INDIAN_DESIGNATIONS = [
  "Senior Secondary Physics Teacher",
  "Post Graduate Teacher (Mathematics)",
  "Trained Graduate Teacher (English)",
  "Head of Science Department",
  "Primary Section Supervisor",
  "Higher Secondary Biology Lecturer",
  "Assistant Professor of Chemistry",
  "Senior Administrative Officer",
  "Vice Principal (Academics)",
  "Physical Education Instructor",
];

export function generateRealisticDesignation(runMarker: string): string {
  const hash = stringHash(runMarker);
  const base =
    REALISTIC_INDIAN_DESIGNATIONS[hash % REALISTIC_INDIAN_DESIGNATIONS.length] ??
    "Senior Secondary Physics Teacher";
  return `${base} [${runMarker}]`;
}
