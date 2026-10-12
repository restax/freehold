/**
 * State-by-state rules on paying unlicensed transaction coordinators per
 * closing. Pure data, no UI. Update `TC_PAY_RULES_EFFECTIVE` whenever any row
 * is re-checked, since the page shows it as the "effective as of" date.
 */

export const TC_PAY_RULES_EFFECTIVE = "October 12, 2026";

export type PayCategory = "red" | "amber" | "orange" | "green" | "gray";

export const PAY_CATEGORIES: Record<PayCategory, { name: string; desc: string }> = {
  red: {
    name: "Barred or needs a license",
    desc: "Contingent pay to an unlicensed person is not allowed, or requires a license.",
  },
  amber: {
    name: "No pay based on sales",
    desc: "Bars percentage or sales-based pay. A flat per-closing fee is a gray area.",
  },
  orange: {
    name: "Regulator flags it",
    desc: "Not barred outright, but the commission warns closing-contingent pay may violate RESPA.",
  },
  green: {
    name: "Per-transaction allowed",
    desc: "State guidance expressly permits flat per-file pay to unlicensed assistants.",
  },
  gray: {
    name: "No specific pay rule",
    desc: "Rules cover activities only. General ban on paying unlicensed people for licensed work.",
  },
};

export type PaySource = { url: string; label: string; date: string };

export type StateRule = {
  abbr: string;
  name: string;
  category: PayCategory;
  rule: string;
  source: PaySource;
  /** Column, row on the 12-column tile map. Zero-based. */
  tile: [number, number];
};

const NAR: PaySource = {
  url: "https://www.nar.realtor/being-a-realtor/personal-assistants/state-statutes-and-regulations-for-unlicensed-assistants",
  label: "NAR state table",
  date: "Apr 2020",
};

const AMBER_RULE =
  "may not be paid on the basis of real estate activity, such as a percentage of commission or any amount based on listings, sales, etc.";

export const STATE_RULES: StateRule[] = [
  {
    abbr: "AL",
    name: "Alabama",
    category: "gray",
    rule: "Clerical and administrative duties only. No pay-structure rule found.",
    source: NAR,
    tile: [7, 6],
  },
  {
    abbr: "AK",
    name: "Alaska",
    category: "gray",
    rule: "Detailed list of permitted admin tasks. No pay-structure rule found.",
    source: NAR,
    tile: [0, 0],
  },
  {
    abbr: "AZ",
    name: "Arizona",
    category: "red",
    rule: "Unlicensed assistants are paid for their work, unrelated to the transaction. If paid on any basis that relies on the sale, they must be licensed. A 2021 bill to formally allow unlicensed TCs did not pass.",
    source: {
      url: "https://azre.gov/node/587",
      label: "AZ Dept. of Real Estate FAQ",
      date: "current",
    },
    tile: [2, 5],
  },
  {
    abbr: "AR",
    name: "Arkansas",
    category: "red",
    rule: "Unlicensed assistants may be employed only at a salaried or hourly rate (A.C.A. 17-42-104).",
    source: NAR,
    tile: [5, 5],
  },
  {
    abbr: "CA",
    name: "California",
    category: "gray",
    rule: "DRE allows unlicensed TCs to do admin and file review. B&P 10137 bars paying unlicensed people for licensed acts. No rule against per-file pay found.",
    source: {
      url: "https://dre.ca.gov/files/pdf/faqs/guide_unlic_asst.pdf",
      label: "CA DRE guide",
      date: "current",
    },
    tile: [1, 4],
  },
  {
    abbr: "CO",
    name: "Colorado",
    category: "orange",
    rule: "Position 20 names TCs and lists 14 permitted tasks. It says payments to an unlicensed REAP contingent on closing may violate RESPA. Position statement, not a rule.",
    source: {
      url: "https://tcbulletin.com/desk/colorado-position-20-reaps-revised-august-2026",
      label: "CO Position 20 (via TC Bulletin)",
      date: "Aug 2026",
    },
    tile: [3, 4],
  },
  {
    abbr: "CT",
    name: "Connecticut",
    category: "amber",
    rule: "Commission policy: unlicensed assistants may not be paid on the basis of commission, or any amount based on listings, sales, etc.",
    source: NAR,
    tile: [10, 3],
  },
  {
    abbr: "DE",
    name: "Delaware",
    category: "gray",
    rule: "Only licensees may host open houses or show. No pay-structure rule found.",
    source: NAR,
    tile: [10, 4],
  },
  {
    abbr: "FL",
    name: "Florida",
    category: "gray",
    rule: "FREC lists permitted tasks. Licensees may not share compensation with unlicensed persons for licensed work (475.25(1)(h), 475.42). No per-file rule found.",
    source: {
      url: "https://www.floridarealtors.org/law-ethics/library/florida-real-estate-licensing-law",
      label: "Florida Realtors legal library",
      date: "current",
    },
    tile: [9, 7],
  },
  {
    abbr: "GA",
    name: "Georgia",
    category: "gray",
    rule: "Rule 520-1-.07 lists permitted and barred tasks. No pay-structure rule found.",
    source: NAR,
    tile: [8, 6],
  },
  {
    abbr: "HI",
    name: "Hawaii",
    category: "gray",
    rule: "Commission guidance on barred activities. No pay-structure rule found.",
    source: NAR,
    tile: [0, 7],
  },
  {
    abbr: "ID",
    name: "Idaho",
    category: "green",
    rule: "Guideline 17: unlicensed assistants may be paid on a flat fee transaction basis or salary/hourly. Licensees should not share commissions with them.",
    source: {
      url: "https://dopl.idaho.gov/wp-content/uploads/2023/11/REC-Guideline-17-rev-5.23.pdf",
      label: "Idaho REC Guideline 17",
      date: "May 2023",
    },
    tile: [2, 2],
  },
  {
    abbr: "IL",
    name: "Illinois",
    category: "gray",
    rule: "68 Ill. Adm. Code 1450.740 lists barred tasks. No pay-structure rule found.",
    source: NAR,
    tile: [6, 2],
  },
  {
    abbr: "IN",
    name: "Indiana",
    category: "gray",
    rule: "876 IAC 8-1-7 lists barred tasks. No pay-structure rule found.",
    source: NAR,
    tile: [6, 3],
  },
  {
    abbr: "IA",
    name: "Iowa",
    category: "gray",
    rule: "Rule 193E-7.13 (now renumbered under 481) is activity-based only. Broker needs a written policy on support staff.",
    source: {
      url: "https://regulations.justia.com/states/iowa/agency-193e/chapter-7/rule-193e-7-13",
      label: "Iowa Admin. Code 193E-7.13",
      date: "2025",
    },
    tile: [5, 3],
  },
  {
    abbr: "KS",
    name: "Kansas",
    category: "gray",
    rule: "Newsletter guidance on barred tasks. No pay-structure rule found.",
    source: NAR,
    tile: [4, 5],
  },
  {
    abbr: "KY",
    name: "Kentucky",
    category: "gray",
    rule: "201 KAR 11:440 bars unlicensed staff from attending closings. No pay-structure rule found.",
    source: NAR,
    tile: [6, 4],
  },
  {
    abbr: "LA",
    name: "Louisiana",
    category: "amber",
    rule: "Commission guidance: may not be paid on the basis of real estate activity, such as a percentage of commission or any amount based on listings, sales, etc.",
    source: NAR,
    tile: [5, 6],
  },
  {
    abbr: "ME",
    name: "Maine",
    category: "gray",
    rule: "No published guidance found.",
    source: NAR,
    tile: [11, 0],
  },
  {
    abbr: "MD",
    name: "Maryland",
    category: "amber",
    rule: "MREC guidelines: may not be paid on the basis of real estate activity, such as a percentage of commission or any amount based on listings, sales, etc.",
    source: NAR,
    tile: [9, 4],
  },
  {
    abbr: "MA",
    name: "Massachusetts",
    category: "gray",
    rule: "Division guidance: avoid direct client contact, no attending closings or walk-throughs, no follow-up contact with buyers and sellers. No pay-structure rule found.",
    source: {
      url: "https://berkshirerealtors.net/real-estate-work-that-cant-be-performed-by-an-unlicensed-individual",
      label: "Berkshire REALTORS summary",
      date: "2017 guidance",
    },
    tile: [11, 2],
  },
  {
    abbr: "MI",
    name: "Michigan",
    category: "gray",
    rule: "License law bars sharing a fee or commission with an unlicensed person. No specific per-file rule found.",
    source: NAR,
    tile: [8, 2],
  },
  {
    abbr: "MN",
    name: "Minnesota",
    category: "gray",
    rule: "Unlicensed cold-callers must be paid hourly, flat fee or salary. No rule on TC pay found.",
    source: NAR,
    tile: [5, 2],
  },
  {
    abbr: "MS",
    name: "Mississippi",
    category: "gray",
    rule: "Unlicensed staff may not attend closings or walk-throughs without a licensee. No pay-structure rule found.",
    source: NAR,
    tile: [6, 6],
  },
  {
    abbr: "MO",
    name: "Missouri",
    category: "amber",
    rule: `20 CSR 2250-8.010: ${AMBER_RULE}`,
    source: NAR,
    tile: [5, 4],
  },
  {
    abbr: "MT",
    name: "Montana",
    category: "gray",
    rule: "Board guidelines on barred tasks. No pay-structure rule found.",
    source: NAR,
    tile: [3, 2],
  },
  {
    abbr: "NE",
    name: "Nebraska",
    category: "amber",
    rule: `Commission policy: ${AMBER_RULE}`,
    source: NAR,
    tile: [4, 4],
  },
  {
    abbr: "NV",
    name: "Nevada",
    category: "gray",
    rule: "Informational bulletin on barred tasks. No pay-structure rule found.",
    source: NAR,
    tile: [2, 3],
  },
  {
    abbr: "NH",
    name: "New Hampshire",
    category: "gray",
    rule: "Commission list of approved tasks. No pay-structure rule found.",
    source: NAR,
    tile: [11, 1],
  },
  {
    abbr: "NJ",
    name: "New Jersey",
    category: "gray",
    rule: "Commission guidance on barred tasks. No pay-structure rule found.",
    source: NAR,
    tile: [9, 3],
  },
  {
    abbr: "NM",
    name: "New Mexico",
    category: "gray",
    rule: "Rule 16.61.21.8 allows an unlicensed coordinator to follow up after contract. No pay-structure rule found.",
    source: NAR,
    tile: [3, 5],
  },
  {
    abbr: "NY",
    name: "New York",
    category: "red",
    rule: "If paid per completed transaction, the assistant must be licensed and paid directly by the broker. Hourly, per activity, or salary is fine.",
    source: {
      url: "https://dos.ny.gov/unlicensed-real-estate-assistants",
      label: "NY Dept. of State",
      date: "current",
    },
    tile: [9, 2],
  },
  {
    abbr: "NC",
    name: "North Carolina",
    category: "red",
    rule: "Unlicensed assistants may be paid salary or hourly, but not per transaction, including closing bonuses.",
    source: {
      url: "https://www.ncrealtors.org/?p=26241",
      label: "NC REALTORS legal Q&A",
      date: "current",
    },
    tile: [7, 5],
  },
  {
    abbr: "ND",
    name: "North Dakota",
    category: "amber",
    rule: `Commission article: ${AMBER_RULE}`,
    source: NAR,
    tile: [4, 2],
  },
  {
    abbr: "OH",
    name: "Ohio",
    category: "gray",
    rule: "Division pronouncement on barred tasks. No pay-structure rule found.",
    source: NAR,
    tile: [7, 3],
  },
  {
    abbr: "OK",
    name: "Oklahoma",
    category: "gray",
    rule: "No published guidance found.",
    source: NAR,
    tile: [4, 6],
  },
  {
    abbr: "OR",
    name: "Oregon",
    category: "gray",
    rule: "Guideline bars giving instructions to inspectors or appraisers. Regulator is considering a formal TC rule (2026). No pay rule found.",
    source: {
      url: "https://tcbulletin.com/desk/oregon-weighs-formal-rule-for-transaction-coordinators",
      label: "TC Bulletin on Oregon",
      date: "Aug 2026",
    },
    tile: [1, 3],
  },
  {
    abbr: "PA",
    name: "Pennsylvania",
    category: "gray",
    rule: "Commission guideline on barred tasks. No pay-structure rule found.",
    source: NAR,
    tile: [8, 3],
  },
  {
    abbr: "RI",
    name: "Rhode Island",
    category: "amber",
    rule: "Policy L-97-1: may not receive pay computed on the basis of sales activity, listings, sales or rentals.",
    source: NAR,
    tile: [10, 2],
  },
  {
    abbr: "SC",
    name: "South Carolina",
    category: "amber",
    rule: "40-57-135(K)(8): may not be paid solely on a percentage of commission or an amount based on listing or sales compensation.",
    source: {
      url: "https://www.blaircato.com/paying-your-unlicensed-assistant-is-it-legal/",
      label: "Blair Cato on SC Practice Act",
      date: "2017 law",
    },
    tile: [8, 5],
  },
  {
    abbr: "SD",
    name: "South Dakota",
    category: "amber",
    rule: `Commission guidelines: ${AMBER_RULE}`,
    source: NAR,
    tile: [4, 3],
  },
  {
    abbr: "TN",
    name: "Tennessee",
    category: "amber",
    rule: `Commission policy: ${AMBER_RULE}`,
    source: NAR,
    tile: [6, 5],
  },
  {
    abbr: "TX",
    name: "Texas",
    category: "gray",
    rule: "TCs are not defined in TREC rules. Unlicensed staff cannot show, open doors, or host open houses. No per-file pay rule found.",
    source: {
      url: "https://www.trec.texas.gov/article/working-multiple-brokerages-what-transaction-coordinators-and-showing-agents-are-allowed-do",
      label: "TREC article",
      date: "2024",
    },
    tile: [4, 7],
  },
  {
    abbr: "UT",
    name: "Utah",
    category: "red",
    rule: "May be paid at a predetermined rate not contingent on real estate transactions. No commission sharing with unlicensed assistants.",
    source: NAR,
    tile: [2, 4],
  },
  {
    abbr: "VT",
    name: "Vermont",
    category: "gray",
    rule: "No published guidance found.",
    source: NAR,
    tile: [10, 1],
  },
  {
    abbr: "VA",
    name: "Virginia",
    category: "green",
    rule: "April 2026 rewrite removed the non-contingent pay requirement. Virginia REALTORS says per-transaction pay is now permitted. Activity limits in 18VAC135-20-335.",
    source: {
      url: "https://virginiarealtors.org/2026/06/30/what-the-new-regulations-say-paying-unlicensed-assistants/",
      label: "Virginia REALTORS",
      date: "Jun 2026",
    },
    tile: [8, 4],
  },
  {
    abbr: "WA",
    name: "Washington",
    category: "gray",
    rule: "Unlicensed TCs may be paid directly by the broker for non-brokerage work. No per-file rule found. Unlicensed staff may not hold trust funds.",
    source: {
      url: "https://warealtor.org/about-us/contact-us/news-media/blogdetails/articles/2022/01/26/team-mayhem",
      label: "Washington REALTORS",
      date: "2022",
    },
    tile: [1, 2],
  },
  {
    abbr: "WV",
    name: "West Virginia",
    category: "gray",
    rule: "WV Code 30-40-5 limits unlicensed tasks. No pay-structure rule found.",
    source: NAR,
    tile: [7, 4],
  },
  {
    abbr: "WI",
    name: "Wisconsin",
    category: "gray",
    rule: "Wis. Admin. Code RL 17.12 lists barred tasks. No pay-structure rule found.",
    source: NAR,
    tile: [7, 2],
  },
  {
    abbr: "WY",
    name: "Wyoming",
    category: "gray",
    rule: "No published guidance found.",
    source: { url: "", label: "Not covered by NAR table", date: "" },
    tile: [3, 3],
  },
];
