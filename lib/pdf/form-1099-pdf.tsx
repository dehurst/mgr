// Form 1099-NEC Copy B (For Recipient), as a substitute statement in the IRS layout. Copy A for
// the IRS is never printed here: it's filed online through IRIS (or on the official red form).
import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { BusinessSettings, Payee } from "@/db/schema";
import { formatCents } from "@/lib/money";
import { maskedTin } from "@/lib/reports/form-1099";

const RULE = "#171717";

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: "#171717", lineHeight: 1.3 },
  form: { borderWidth: 1, borderColor: RULE, flexDirection: "row" },
  colL: { width: "50%", borderRightWidth: 1, borderColor: RULE },
  colM: { width: "26%", borderRightWidth: 1, borderColor: RULE },
  colR: { width: "24%" },
  box: { borderBottomWidth: 1, borderColor: RULE, padding: 4 },
  last: { borderBottomWidth: 0 },
  label: { fontSize: 6.5, color: "#404040" },
  value: { fontSize: 10, marginTop: 2 },
  money: { fontSize: 11, marginTop: 4, fontFamily: "Helvetica-Bold" },
  half: { flexDirection: "row", borderBottomWidth: 1, borderColor: RULE },
  title: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  bold: { fontFamily: "Helvetica-Bold" },
  stateRow: { flexDirection: "row", borderWidth: 1, borderTopWidth: 0, borderColor: RULE },
  stateBox: { flex: 1, padding: 4, minHeight: 30, borderRightWidth: 1, borderColor: RULE },
  footer: { flexDirection: "row", justifyContent: "space-between", marginTop: 4, fontSize: 7.5 },
  instructions: { marginTop: 28, fontSize: 8, lineHeight: 1.4 },
  para: { marginBottom: 5 },
});

function Box({ label, children, style }: { label: string; children?: React.ReactNode; style?: React.ComponentProps<typeof View>["style"] }) {
  return (
    <View style={[s.box, ...[style ?? []].flat()]}>
      <Text style={s.label}>{label}</Text>
      {children}
    </View>
  );
}

export function Form1099Document({
  year,
  payee,
  amountCents,
  settings,
}: {
  year: number;
  payee: Payee;
  amountCents: number;
  settings: BusinessSettings;
}) {
  const payer = [settings.businessName, settings.address, settings.phone].filter(Boolean).join("\n");
  const recipientName = [payee.name, payee.businessName].filter(Boolean).join("\n");
  return (
    <Document title={`Form 1099-NEC ${year} - ${payee.name}`} author={settings.businessName} creator="Ledger">
      <Page size="LETTER" style={s.page}>
        <View style={s.form}>
          <View style={s.colL}>
            <Box label="PAYER'S name, street address, city or town, state or province, country, ZIP or foreign postal code, and telephone no." style={{ minHeight: 92 }}>
              <Text style={s.value}>{payer}</Text>
            </Box>
            <View style={s.half}>
              <View style={{ width: "50%", padding: 4, borderRightWidth: 1, borderColor: RULE, minHeight: 34 }}>
                <Text style={s.label}>PAYER&apos;S TIN</Text>
                <Text style={s.value}>{settings.taxId}</Text>
              </View>
              <View style={{ width: "50%", padding: 4 }}>
                <Text style={s.label}>RECIPIENT&apos;S TIN</Text>
                <Text style={s.value}>{maskedTin(payee)}</Text>
              </View>
            </View>
            <Box label="RECIPIENT'S name" style={{ minHeight: 40 }}>
              <Text style={s.value}>{recipientName}</Text>
            </Box>
            <Box label="Street address (including apt. no.), city or town, state or province, country, and ZIP or foreign postal code" style={{ minHeight: 56 }}>
              <Text style={s.value}>{payee.address}</Text>
            </Box>
            <Box label="Account number (see instructions)" style={[s.last, { minHeight: 28 }]} />
          </View>
          <View style={s.colM}>
            <Box label="OMB No. 1545-0116" style={{ minHeight: 92 }}>
              <Text style={[s.title, { marginTop: 8 }]}>{year}</Text>
              <Text style={{ marginTop: 6 }}>Form 1099-NEC</Text>
              <Text style={s.label}>For calendar year {year}</Text>
            </Box>
            <Box label="1 Nonemployee compensation" style={{ minHeight: 34 }}>
              <Text style={s.money}>{formatCents(amountCents)}</Text>
            </Box>
            <Box label="2 Payer made direct sales totaling $5,000 or more of consumer products to recipient for resale" style={{ minHeight: 40 }} />
            <Box label="3 Excess golden parachute payments" style={{ minHeight: 28 }} />
            <Box label="4 Federal income tax withheld" style={[s.last, { minHeight: 28 }]} />
          </View>
          <View style={s.colR}>
            <View style={[s.box, { minHeight: 92, justifyContent: "center" }]}>
              <Text style={s.title}>Nonemployee</Text>
              <Text style={s.title}>Compensation</Text>
            </View>
            <View style={{ padding: 6 }}>
              <Text style={[s.bold, { fontSize: 12 }]}>Copy B</Text>
              <Text style={[s.bold, { marginBottom: 6 }]}>For Recipient</Text>
              <Text style={{ fontSize: 7.5 }}>
                This is important tax information and is being furnished to the IRS. If you are required to file a return, a
                negligence penalty or other sanction may be imposed on you if this income is taxable and the IRS determines that it
                has not been reported.
              </Text>
            </View>
          </View>
        </View>
        <View style={s.stateRow}>
          <View style={s.stateBox}>
            <Text style={s.label}>5 State tax withheld</Text>
          </View>
          <View style={s.stateBox}>
            <Text style={s.label}>6 State/Payer&apos;s state no.</Text>
          </View>
          <View style={[s.stateBox, { borderRightWidth: 0 }]}>
            <Text style={s.label}>7 State income</Text>
          </View>
        </View>
        <View style={s.footer}>
          <Text>
            <Text style={s.bold}>Form 1099-NEC</Text> (keep for your records)
          </Text>
          <Text>www.irs.gov/Form1099NEC</Text>
          <Text>Department of the Treasury - Internal Revenue Service</Text>
        </View>

        <View style={s.instructions}>
          <Text style={[s.bold, { marginBottom: 6 }]}>Instructions for Recipient</Text>
          <Text style={s.para}>
            You received this form instead of Form W-2 because the payer did not consider you an employee and did not withhold
            income tax or social security and Medicare tax.
          </Text>
          <Text style={s.para}>
            Recipient&apos;s taxpayer identification number (TIN). For your protection, this form may show only the last four
            digits of your TIN. However, the issuer has reported your complete TIN to the IRS.
          </Text>
          <Text style={s.para}>
            Box 1. Shows nonemployee compensation. If the amount in this box is self-employment (SE) income, report it on Schedule C
            or F (Form 1040) and complete Schedule SE (Form 1040). If you believe you are an employee and cannot get the payer to
            correct this form, report the amount on the line for &quot;Wages, salaries, tips&quot; of Form 1040 and complete Form 8919.
          </Text>
          <Text style={s.para}>For full instructions, see www.irs.gov/Form1099NEC.</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function render1099Pdf(args: Parameters<typeof Form1099Document>[0]): Promise<Buffer> {
  return renderToBuffer(<Form1099Document {...args} />);
}

export function form1099Filename(year: number, payeeName: string): string {
  return `1099-NEC ${year} - ${payeeName.replace(/[^\w.\- ]+/g, "").trim()}.pdf`;
}
