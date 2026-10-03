// IRS Schedule C (Form 1040) Part II expense lines that apply to a one-person business with
// no employees. "27a" (Other expenses) is itemized by category name in Part V.

export const SCHEDULE_C_LINES = [
  { line: "8", label: "Advertising" },
  { line: "9", label: "Car and truck expenses" },
  { line: "10", label: "Commissions and fees" },
  { line: "11", label: "Contract labor" },
  { line: "13", label: "Depreciation and section 179" },
  { line: "15", label: "Insurance (other than health)" },
  { line: "16b", label: "Interest: other" },
  { line: "17", label: "Legal and professional services" },
  { line: "18", label: "Office expense" },
  { line: "20a", label: "Rent or lease: vehicles, machinery, equipment" },
  { line: "20b", label: "Rent or lease: other business property" },
  { line: "21", label: "Repairs and maintenance" },
  { line: "22", label: "Supplies" },
  { line: "23", label: "Taxes and licenses" },
  { line: "24a", label: "Travel" },
  { line: "24b", label: "Deductible meals" },
  { line: "25", label: "Utilities" },
  { line: "27a", label: "Other expenses" },
] as const;

export type ScheduleCLine = (typeof SCHEDULE_C_LINES)[number]["line"];

export function isScheduleCLine(s: string): s is ScheduleCLine {
  return SCHEDULE_C_LINES.some((l) => l.line === s);
}

export function scheduleCLabel(line: string): string {
  const found = SCHEDULE_C_LINES.find((l) => l.line === line);
  return found ? `Line ${found.line}: ${found.label}` : `Line ${line}`;
}

/** Seeded on first run. Users can rename, remap, archive, or add more. */
export const DEFAULT_CATEGORIES: { name: string; scheduleCLine: ScheduleCLine }[] = [
  { name: "Advertising & marketing", scheduleCLine: "8" },
  { name: "Car & truck", scheduleCLine: "9" },
  { name: "Commissions & fees", scheduleCLine: "10" },
  { name: "Contract labor", scheduleCLine: "11" },
  { name: "Computer & equipment", scheduleCLine: "13" },
  { name: "Insurance", scheduleCLine: "15" },
  { name: "Interest (business)", scheduleCLine: "16b" },
  { name: "Legal & professional", scheduleCLine: "17" },
  { name: "Office expense", scheduleCLine: "18" },
  { name: "Rent / coworking", scheduleCLine: "20b" },
  { name: "Repairs & maintenance", scheduleCLine: "21" },
  { name: "Supplies", scheduleCLine: "22" },
  { name: "Taxes & licenses", scheduleCLine: "23" },
  { name: "Travel", scheduleCLine: "24a" },
  { name: "Meals (50% deductible)", scheduleCLine: "24b" },
  { name: "Phone & internet", scheduleCLine: "25" },
  { name: "Software & subscriptions", scheduleCLine: "27a" },
  { name: "Hosting & domains", scheduleCLine: "27a" },
  { name: "Bank & payment fees", scheduleCLine: "27a" },
  { name: "Education & training", scheduleCLine: "27a" },
  { name: "Dues & memberships", scheduleCLine: "27a" },
];
