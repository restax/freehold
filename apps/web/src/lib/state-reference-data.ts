import type { StateClosingModel } from "@freehold/db";

/**
 * Baseline data for StateReference, seeded once per state (never overwrites
 * a row that already exists — see seedStateReferences in
 * lib/actions/state-reference.ts). Supplied by Paul 2026-07-31 as a
 * best-effort baseline, not confirmed accurate state by state — that's what
 * StateReference.verified tracks as each one gets checked in /admin/states.
 */
export interface StateReferenceSeed {
  code: string;
  name: string;
  closingModel: StateClosingModel;
  closingModelDetail: string;
  dominantMls: string;
  licenseSummary: string;
  jargon: string;
}

export const TC_LICENSE_GENERAL_RULE =
  "Unlicensed TCs: allowed in most states only as administrative/secretarial support under the direct supervision of a licensed broker — they cannot negotiate terms, draft legal clauses, give real estate advice, or solicit clients. Independent / 1099 TCs: in several states (California, Colorado, Texas, Florida, and others), offering independent contract TC services directly to multiple agents without working under a licensed brokerage structure often requires an active real estate license to avoid unauthorized-practice or unlicensed-activity penalties.";

export const STATE_REFERENCE_SEED: StateReferenceSeed[] = [
  {
    code: "AL",
    name: "Alabama",
    closingModel: "PARTIAL_ATTORNEY",
    closingModelDetail:
      "Partial Attorney State — attorney handles deed/legal doc prep; title handles escrow/closing.",
    dominantMls: "Greater Alabama MLS (GALMLS / Birmingham), Mobile MLS, Valley MLS (Huntsville).",
    licenseSummary:
      "Unlicensed allowed for standard admin under broker supervision. Independent 1099 TCs handling client interaction need a license.",
    jargon:
      "Alabama Real Estate Commission (AREC) forms, Right of Redemption (statutory post-foreclosure right unique to AL).",
  },
  {
    code: "AK",
    name: "Alaska",
    closingModel: "TITLE_ESCROW",
    closingModelDetail: "Title / Escrow State.",
    dominantMls: "Alaska Multiple Listing Service (AKMLS).",
    licenseSummary: "Unlicensed administrative TCs permitted under broker oversight.",
    jargon:
      "Resale Certificate (common for condos/HOAs), Public Land Order, Fuel/Heating Oil Tank Addendums.",
  },
  {
    code: "AZ",
    name: "Arizona",
    closingModel: "TITLE_ESCROW",
    closingModelDetail: "Title / Escrow State.",
    dominantMls: "Arizona Regional MLS (ARMLS).",
    licenseSummary:
      "Unlicensed administrative staff allowed under broker; independent TCs engaging in licensed duties require an active license.",
    jargon:
      "BINSR (Buyer's Inspection Notice and Seller's Response), SPDS (Seller's Property Disclosure Statement), CURE Period Notice (3-day notice to cure contract performance breaches).",
  },
  {
    code: "AR",
    name: "Arkansas",
    closingModel: "TITLE_ESCROW",
    closingModelDetail: "Title / Escrow State.",
    dominantMls: "Cooperative Arkansas Realtors MLS (CARMLS).",
    licenseSummary: "Unlicensed admin allowed under broker supervision.",
    jargon: "AREC Standard Form, Bill of Sale (for personal property in rural transactions).",
  },
  {
    code: "CA",
    name: "California",
    closingModel: "TITLE_ESCROW",
    closingModelDetail: "Title / Escrow State — separate title and escrow companies commonly used.",
    dominantMls:
      "California Regional MLS (CRMLS), MLSListings, San Francisco Association of Realtors MLS (SFARMLS), SDMLS.",
    licenseSummary:
      "Strict. Independent TCs operating as third-party businesses or contract service providers generally require an active California real estate license. Unlicensed TCs must be strictly employed in-house under direct broker control.",
    jargon:
      "TDS (Transfer Disclosure Statement), SPQ (Seller Property Questionnaire), AVID (Agent Visual Inspection Disclosure), CR (Contingency Removal form — California uses explicit active contingency removal rather than passive expiration), NVR (Notice to Perform).",
  },
  {
    code: "CO",
    name: "Colorado",
    closingModel: "TITLE_ESCROW",
    closingModelDetail: "Title / Escrow State.",
    dominantMls: "REcolorado, IRES MLS, Pikes Peak MLS (PPAR).",
    licenseSummary:
      "Unlicensed admin allowed for clerical work under broker. Independent TCs managing files for outside agents should hold a license if interpreting or handling contract execution.",
    jargon:
      "CTM eContracts (dominant contract platform), MEC (Mutual Execution of Contract — triggers all contract deadlines), Green Disclosure / Source of Water Addendum.",
  },
  {
    code: "CT",
    name: "Connecticut",
    closingModel: "ATTORNEY",
    closingModelDetail: "Attorney State — attorneys conduct closing and title representation.",
    dominantMls: "SmartMLS.",
    licenseSummary:
      "Unlicensed administrative support permitted under broker supervision; legal documents prepared by closing attorney.",
    jargon:
      "Property Condition Disclosure Report, K-12/Well & Septic Addenda, Attorney Review Period.",
  },
  {
    code: "DE",
    name: "Delaware",
    closingModel: "ATTORNEY",
    closingModelDetail: "Attorney State — closing must be conducted by a licensed DE attorney.",
    dominantMls: "Bright MLS.",
    licenseSummary: "Unlicensed admin permitted for routine tasks under broker supervision.",
    jargon:
      "Delaware Agreement for Sale, Transfer Tax Splits (50/50 standard split between buyer/seller).",
  },
  {
    code: "FL",
    name: "Florida",
    closingModel: "TITLE_ESCROW",
    closingModelDetail:
      "Title / Escrow State — attorneys common in South FL, title companies dominant elsewhere.",
    dominantMls: "Stellar MLS, BeachesMLS, MIAMI REALTORS MLS.",
    licenseSummary:
      "Unlicensed administrative TCs permitted under broker supervision. Independent TCs doing substantive client work or negotiations require a Florida real estate license.",
    jargon:
      "FAR/BAR Contract (Florida Realtors/Florida Bar standard forms: AS-IS vs. Standard), Estoppel Certificate (HOA/Condo verification), CDD (Community Development District fee).",
  },
  {
    code: "GA",
    name: "Georgia",
    closingModel: "ATTORNEY",
    closingModelDetail:
      "Strict Attorney State — attorney acts as closing agent from start to finish.",
    dominantMls: "First Multiple Listing Service (FMLS), Georgia MLS (GAMLS).",
    licenseSummary:
      "Unlicensed TCs allowed for administrative duties only. Cannot draft clauses or communicate terms to clients.",
    jargon:
      "GAR Forms (Georgia Association of Realtors) vs. RE Forms, BAD (Binding Agreement Date — crucial baseline for all contingency calculations), Due Diligence Period.",
  },
  {
    code: "HI",
    name: "Hawaii",
    closingModel: "TITLE_ESCROW",
    closingModelDetail: "Title / Escrow State.",
    dominantMls: "Hawaii Information Service (HIS), Honolulu Board of Realtors MLS (HICentral).",
    licenseSummary:
      "Unlicensed admin allowed under broker; active license required for independent contract management.",
    jargon:
      "TMK (Tax Map Key — property identification standard), Fee Simple (FS) vs. Leasehold (LH), HARP (Hawaii Association of Realtors Purchase Contract).",
  },
  {
    code: "ID",
    name: "Idaho",
    closingModel: "TITLE_ESCROW",
    closingModelDetail: "Title / Escrow State.",
    dominantMls: "Intermountain MLS (IMLS).",
    licenseSummary: "Unlicensed admin permitted under broker supervision.",
    jargon:
      "RE-21 (Real Estate Purchase and Sale Agreement form), Seller's Property Disclosure Form.",
  },
  {
    code: "IL",
    name: "Illinois",
    closingModel: "TITLE_ESCROW",
    closingModelDetail:
      "Title / Escrow State — customary attorney involvement; Chicago area heavily utilizes attorney review.",
    dominantMls: "Midwest Real Estate Data (MRED).",
    licenseSummary: "Unlicensed admin allowed under broker supervision.",
    jargon:
      "Attorney Modification Period (typically 5 business days post-signing to request contract modifications), Radon Disclosure, City Transfer Stamps (municipal taxes, e.g. Chicago transfer stamps).",
  },
  {
    code: "IN",
    name: "Indiana",
    closingModel: "TITLE_ESCROW",
    closingModelDetail: "Title / Escrow State.",
    dominantMls: "MIBOR REALTOR Association, Indiana Regional MLS (IRMLS).",
    licenseSummary: "Unlicensed admin permitted under broker supervision.",
    jargon:
      "Sales Disclosure Form (SDF), Property Exemption Forms (Homestead/Mortgage exemptions filed post-closing).",
  },
  {
    code: "IA",
    name: "Iowa",
    closingModel: "TITLE_ESCROW",
    closingModelDetail:
      "Title / Escrow State — utilizes the Iowa Title Guaranty system instead of private title insurance.",
    dominantMls: "Iowa Association of Realtors MLS (IAR MLS), RAEAC MLS.",
    licenseSummary: "Unlicensed admin allowed under broker supervision.",
    jargon:
      "Abstract of Title (Iowa requires physical title abstract updates by an abstractor before attorney title opinion).",
  },
  {
    code: "KS",
    name: "Kansas",
    closingModel: "TITLE_ESCROW",
    closingModelDetail: "Title / Escrow State.",
    dominantMls: "Heartland MLS (Kansas City metro), Wichita Area Association of Realtors MLS.",
    licenseSummary: "Unlicensed admin allowed under broker supervision.",
    jargon: "KREC Forms, Radon Disclosure, Heartland Contract.",
  },
  {
    code: "KY",
    name: "Kentucky",
    closingModel: "ATTORNEY",
    closingModelDetail: "Attorney State — attorney conducts title examination and closing.",
    dominantMls: "LGLR MLS (Louisville), Bluegrass Realtors MLS (Lexington).",
    licenseSummary: "Unlicensed admin permitted under broker supervision.",
    jargon: "KREC Form 401 (Seller Disclosure), Title Opinion Letter.",
  },
  {
    code: "LA",
    name: "Louisiana",
    closingModel: "PARTIAL_ATTORNEY",
    closingModelDetail:
      "Partial Attorney / Notarial State — title/closing handled under the Civil Law system by licensed attorneys or notaries public.",
    dominantMls:
      "Greater Baton Rouge Association of Realtors (GBRAR), Gulf South Real Estate Information Network (GSREIN / New Orleans).",
    licenseSummary: "Unlicensed admin permitted under broker supervision.",
    jargon:
      "Agreement to Buy or Sell (LREC mandatory form), Act of Cash Sale (closing conveyance deed), Bond for Deed, Servitudes (easements).",
  },
  {
    code: "ME",
    name: "Maine",
    closingModel: "PARTIAL_ATTORNEY",
    closingModelDetail:
      "Partial Attorney State — attorney required if lender mandates title search/opinion.",
    dominantMls: "Maine Real Estate Information System (MREIS / Maine Listings).",
    licenseSummary: "Unlicensed admin allowed under broker.",
    jargon:
      "Maine Association of Realtors Purchase & Sale Agreement, Heating Systems / Solar Disclosure.",
  },
  {
    code: "MD",
    name: "Maryland",
    closingModel: "TITLE_ESCROW",
    closingModelDetail:
      "Title / Escrow State — attorneys often affiliated with title companies; title attorneys prevalent.",
    dominantMls: "Bright MLS.",
    licenseSummary:
      "Unlicensed admin permitted under broker supervision. Independent TCs handling regulated tasks need a license.",
    jargon:
      "MAR Forms (Maryland Realtors), GCAAR Forms (Greater Capital Area Association of Realtors — Montgomery County/DC area), Agricultural Transfer Tax, Ground Rent (specific to Baltimore City/County).",
  },
  {
    code: "MA",
    name: "Massachusetts",
    closingModel: "ATTORNEY",
    closingModelDetail:
      "Attorney State — lender attorney conducts closing; buyers/sellers usually retain separate counsel.",
    dominantMls: "MLS Property Information Network (MLS PIN).",
    licenseSummary: "Unlicensed admin permitted under broker supervision.",
    jargon:
      "Offer to Purchase (OTP) — short binding initial contract — followed by the Purchase & Sale Agreement (P&S), a formal detailed contract drafted by attorneys ~10-14 days later; Title 5 (septic inspection requirement).",
  },
  {
    code: "MI",
    name: "Michigan",
    closingModel: "TITLE_ESCROW",
    closingModelDetail: "Title / Escrow State.",
    dominantMls: "Realcomp MLS, MiRealSource, Great Lakes Repository.",
    licenseSummary: "Unlicensed admin permitted under broker supervision.",
    jargon:
      "Seller's Disclosure Statement (SDS), Lead-Based Paint / Mineral Rights Disclosures, Land Contracts (popular seller-financing mechanism in MI).",
  },
  {
    code: "MN",
    name: "Minnesota",
    closingModel: "TITLE_ESCROW",
    closingModelDetail: "Title / Escrow State.",
    dominantMls: "NorthstarMLS.",
    licenseSummary: "Unlicensed admin allowed under broker supervision.",
    jargon:
      "TICO (Truth in Sale of Housing / TOSH inspection required in Minneapolis/St. Paul), Abstract vs. Torrens (two parallel land registration systems in MN).",
  },
  {
    code: "MS",
    name: "Mississippi",
    closingModel: "PARTIAL_ATTORNEY",
    closingModelDetail: "Partial Attorney State — attorney certifies title/opinion.",
    dominantMls: "MLS United, Central Mississippi MLS.",
    licenseSummary: "Unlicensed admin allowed under broker.",
    jargon: "PUD Addendum, Working Agricultural Land Disclosures.",
  },
  {
    code: "MO",
    name: "Missouri",
    closingModel: "TITLE_ESCROW",
    closingModelDetail: "Title / Escrow State.",
    dominantMls: "MARIS MLS (St. Louis), Heartland MLS (Kansas City).",
    licenseSummary: "Unlicensed admin allowed under broker supervision.",
    jargon:
      "Special Sale Contract (AS-IS form), Rider Section (common for municipal occupancy inspections).",
  },
  {
    code: "MT",
    name: "Montana",
    closingModel: "TITLE_ESCROW",
    closingModelDetail: "Title / Escrow State.",
    dominantMls: "Montana Regional MLS, Billings Association of Realtors MLS.",
    licenseSummary: "Unlicensed admin allowed under broker.",
    jargon: "Water Rights Disclosure, Mold Disclosure, Noxious Weed Disclosure.",
  },
  {
    code: "NE",
    name: "Nebraska",
    closingModel: "TITLE_ESCROW",
    closingModelDetail: "Title / Escrow State.",
    dominantMls: "Great Plains Regional MLS.",
    licenseSummary: "Unlicensed admin allowed under broker.",
    jargon: "Sanitary and Improvement District (SID) disclosures (vital for new subdivisions).",
  },
  {
    code: "NV",
    name: "Nevada",
    closingModel: "TITLE_ESCROW",
    closingModelDetail: "Title / Escrow State.",
    dominantMls: "LVR MLS (Las Vegas), Northern Nevada Regional MLS (NNRMLS / Reno).",
    licenseSummary:
      "Unlicensed admin allowed under broker; independent contractor TCs handling client-facing management require a Nevada real estate license.",
    jargon:
      "SRPD (Seller's Real Property Disclosure), CIC (Common-Interest Community / HOA documents), E-Sign Authorization Form.",
  },
  {
    code: "NH",
    name: "New Hampshire",
    closingModel: "ATTORNEY",
    closingModelDetail: "Attorney State.",
    dominantMls: "PrimeMLS (formerly NNEREN).",
    licenseSummary: "Unlicensed admin allowed under broker supervision.",
    jargon: "Water Supply & Waterfront Site Assessment, P&S Agreement.",
  },
  {
    code: "NJ",
    name: "New Jersey",
    closingModel: "TITLE_ESCROW",
    closingModelDetail: "Title / Escrow State — attorney-driven customary closing process.",
    dominantMls: "NJMLS, GSMLS (Garden State), Bright MLS, CJMLS.",
    licenseSummary: "Unlicensed admin permitted under broker.",
    jargon:
      "3-Day Attorney Review Period (either party's attorney can disapprove/cancel the contract within 3 business days of execution), Municipal Smoke/CO/Sump Certificate, Bulk Sales Tax (if applicable).",
  },
  {
    code: "NM",
    name: "New Mexico",
    closingModel: "TITLE_ESCROW",
    closingModelDetail: "Title / Escrow State.",
    dominantMls: "Southwest MLS (SWMLS / Albuquerque), Santa Fe Association of Realtors MLS.",
    licenseSummary: "Unlicensed admin permitted under broker.",
    jargon:
      "NMAR Forms (New Mexico Association of Realtors), PID (Public Improvement District Disclosure), Septic/Liquid Waste Certificate.",
  },
  {
    code: "NY",
    name: "New York",
    closingModel: "ATTORNEY",
    closingModelDetail:
      "Strict Attorney State — attorneys manage all contract drafting, negotiations, and the closing process.",
    dominantMls: "OneKey MLS, REBNY Portal (RLS — NYC), NYSAMLS / Matrix (Upstate NY).",
    licenseSummary:
      "Unlicensed admin allowed for clerical coordination. TCs strictly cannot draft or alter terms (attorneys handle contracts).",
    jargon:
      "Binder / Deal Sheet (non-binding preliminary agreement prepared by agent), Board Package (extensive application for NYC co-ops/condos), TOE (Time of the Essence Letter), PCDA (Property Condition Disclosure Act — $500 credit alternative largely phased out by statutory mandatory disclosure updates).",
  },
  {
    code: "NC",
    name: "North Carolina",
    closingModel: "ATTORNEY",
    closingModelDetail:
      "Strict Attorney State — attorney conducts closing, handles escrow, and performs the title search.",
    dominantMls: "Canopy MLS (Charlotte region), Doorify MLS (TMLS / Triangle area).",
    licenseSummary: "Unlicensed admin permitted under broker supervision.",
    jargon:
      "Due Diligence Fee (non-refundable check paid directly to seller upon contract acceptance) & Due Diligence Period (buyers can walk for any reason or no reason before expiration), NCAR Form 2-T, MOG (Mineral, Oil, and Gas Rights Disclosure).",
  },
  {
    code: "ND",
    name: "North Dakota",
    closingModel: "PARTIAL_ATTORNEY",
    closingModelDetail: "Partial Attorney State — attorney title examination required.",
    dominantMls: "Bismarck-Mandan MLS, Fargo-Moorhead MLS.",
    licenseSummary: "Unlicensed admin permitted under broker.",
    jargon: "Title Opinion, Abstract Examination.",
  },
  {
    code: "OH",
    name: "Ohio",
    closingModel: "TITLE_ESCROW",
    closingModelDetail: "Title / Escrow State.",
    dominantMls:
      "MLS Now (Northeast OH), Columbus REALTORS Multiple Listing Service, DABR MLS (Dayton/Cincinnati).",
    licenseSummary: "Unlicensed admin permitted under broker.",
    jargon:
      "Residential Property Disclosure Form (RPDF), Cuyahoga/Franklin County Point of Sale (POS) Inspections.",
  },
  {
    code: "OK",
    name: "Oklahoma",
    closingModel: "PARTIAL_ATTORNEY",
    closingModelDetail: "Partial Attorney State — attorney title examination required.",
    dominantMls: "MLSOK (Oklahoma City), GTAR MLS (Tulsa).",
    licenseSummary: "Unlicensed admin permitted under broker.",
    jargon:
      "OREC Forms (Oklahoma Real Estate Commission mandatory contract forms), Abstract of Title.",
  },
  {
    code: "OR",
    name: "Oregon",
    closingModel: "TITLE_ESCROW",
    closingModelDetail: "Title / Escrow State.",
    dominantMls: "RMLS (Regional Multiple Listing Service), WVMLS.",
    licenseSummary:
      "Unlicensed admin allowed under broker; independent TCs executing contracts/client communication require an active Oregon real estate license.",
    jargon:
      "OREF Forms (Oregon Real Estate Forms), Professional Land Survey, On-Site Sewage Disposal System (OSSE) Addendum.",
  },
  {
    code: "PA",
    name: "Pennsylvania",
    closingModel: "TITLE_ESCROW",
    closingModelDetail: "Title / Escrow State.",
    dominantMls: "Bright MLS, West Penn MLS (Pittsburgh).",
    licenseSummary: "Unlicensed admin permitted under broker supervision.",
    jargon:
      "PAR Forms (Pennsylvania Association of Realtors standard forms), Reply to Inspections (BRI), Municipal Certificate of Occupancy / Resale Certificate.",
  },
  {
    code: "RI",
    name: "Rhode Island",
    closingModel: "PARTIAL_ATTORNEY",
    closingModelDetail: "Partial Attorney State — attorney examination/prep required.",
    dominantMls: "State-Wide MLS (RI).",
    licenseSummary: "Unlicensed admin permitted under broker.",
    jargon: "RI Association of Realtors Purchase & Sales Agreement, Cesspool Act Disclosures.",
  },
  {
    code: "SC",
    name: "South Carolina",
    closingModel: "ATTORNEY",
    closingModelDetail: "Strict Attorney State — attorney must oversee closing and title work.",
    dominantMls: "Consolidated MLS (Columbia), Charleston Trident MLS, GGAR MLS (Greenville).",
    licenseSummary: "Unlicensed admin permitted under broker.",
    jargon:
      "CL-100 Report (Wood Infestation/Termite Report — mandatory standard in SC transactions), SCR Forms, Due Diligence Addendum.",
  },
  {
    code: "SD",
    name: "South Dakota",
    closingModel: "TITLE_ESCROW",
    closingModelDetail: "Title / Escrow State.",
    dominantMls: "Black Hills MLS, RASE MLS (Sioux Falls).",
    licenseSummary: "Unlicensed admin permitted under broker.",
    jargon: "SDREC Disclosure Statement, Title Commitment.",
  },
  {
    code: "TN",
    name: "Tennessee",
    closingModel: "TITLE_ESCROW",
    closingModelDetail: "Title / Escrow State.",
    dominantMls: "RealTracs (Middle TN / Nashville), KAAR MLS (Knoxville), MAAR MLS (Memphis).",
    licenseSummary: "Unlicensed admin permitted under broker.",
    jargon:
      "RF Forms (TAR / Tennessee Realtors standard forms, e.g. RF 401 Purchase Agreement), Get-Out Contingency / First Right of Refusal.",
  },
  {
    code: "TX",
    name: "Texas",
    closingModel: "TITLE_ESCROW",
    closingModelDetail:
      "Title / Escrow State — title companies issue policies and close deals; earnest money held by title.",
    dominantMls:
      "HAR MLS (Houston), NTREIS (Dallas/Fort Worth), ACTRIS (Austin), SABOR (San Antonio).",
    licenseSummary:
      "Unlicensed admin permitted under direct broker supervision for administrative/back-office duties. Independent TCs doing direct client management or form execution often require an active Texas real estate license.",
    jargon:
      "TREC 1-4 Family Resale Contract, Option Period & Option Fee (unrestricted right to terminate contract paid to seller within specified days), T-47 Residential Real Property Affidavit (used alongside existing survey), Title Commitment.",
  },
  {
    code: "UT",
    name: "Utah",
    closingModel: "TITLE_ESCROW",
    closingModelDetail: "Title / Escrow State.",
    dominantMls: "UtahRealEstate.com (WFRMLS).",
    licenseSummary: "Unlicensed admin permitted under broker supervision.",
    jargon:
      "REPC (Real Estate Purchase Contract — state mandatory standard), Buyer's Due Diligence Checklist, Seller Disclosures (Form SD).",
  },
  {
    code: "VT",
    name: "Vermont",
    closingModel: "ATTORNEY",
    closingModelDetail: "Attorney State.",
    dominantMls: "PrimeMLS.",
    licenseSummary: "Unlicensed admin permitted under broker.",
    jargon:
      "Act 250 Disclosure (land use/environmental state regulation), VT Property Transfer Tax.",
  },
  {
    code: "VA",
    name: "Virginia",
    closingModel: "PARTIAL_ATTORNEY",
    closingModelDetail:
      "Partial Attorney / Settlement Agent State — title companies, attorneys, or licensed CRETS settlement agents can handle closing under RESA.",
    dominantMls: "Bright MLS, CVR MLS (Richmond).",
    licenseSummary: "Unlicensed admin permitted under broker supervision.",
    jargon:
      "NVAR Forms (Northern Virginia) / VAR Forms (Virginia Realtors), POA / Condominium Act Resale Certificate (buyers have statutory right to cancel upon receipt of HOA docs), Post-Occupancy Agreement.",
  },
  {
    code: "WA",
    name: "Washington",
    closingModel: "TITLE_ESCROW",
    closingModelDetail:
      "Title / Escrow State — LPO (Limited Practice Officers) handle closing documentation.",
    dominantMls: "Northwest MLS (NWMLS), Spokane MLS.",
    licenseSummary:
      "Unlicensed admin permitted under broker. Independent contract TCs interfacing with clients need a license.",
    jargon:
      "Form 21 (NWMLS Residential Purchase & Sale Agreement), Form 35 (Inspection Addendum), Form 17 (Seller Disclosure Statement), Feasibility Contingency.",
  },
  {
    code: "WV",
    name: "West Virginia",
    closingModel: "ATTORNEY",
    closingModelDetail: "Attorney State.",
    dominantMls: "Bright MLS, Kanawha Valley MLS.",
    licenseSummary: "Unlicensed admin permitted under broker.",
    jargon: "WV Real Estate Commission Disclosure, Title Opinion Report.",
  },
  {
    code: "WI",
    name: "Wisconsin",
    closingModel: "TITLE_ESCROW",
    closingModelDetail: "Title / Escrow State.",
    dominantMls: "Metro MLS (Milwaukee), SCWMLS (Madison).",
    licenseSummary: "Unlicensed admin permitted under broker supervision.",
    jargon:
      "WB Forms (state-approved mandatory forms, e.g. WB-11 Residential Offer to Purchase), Real Estate Condition Report (RECR).",
  },
  {
    code: "WY",
    name: "Wyoming",
    closingModel: "TITLE_ESCROW",
    closingModelDetail: "Title / Escrow State.",
    dominantMls: "Teton Board of Realtors MLS, Wyoming MLS.",
    licenseSummary: "Unlicensed admin permitted under broker.",
    jargon: "Wyoming Contract to Buy and Sell Real Estate, Water Right Transfers.",
  },
];
