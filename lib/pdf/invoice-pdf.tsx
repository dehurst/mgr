import fs from "node:fs";
import { Document, Image, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { BusinessSettings } from "@/db/schema";
import { formatDate } from "@/lib/dates";
import type { InvoiceDetail } from "@/lib/invoices";
import { formatCents, formatQuantity } from "@/lib/money";

const C = { text: "#171717", muted: "#6b6b6b", rule: "#e5e5e5", band: "#f5f5f5" };

const s = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 64, paddingHorizontal: 48, fontSize: 10, color: C.text, fontFamily: "Helvetica", lineHeight: 1.4 },
  row: { flexDirection: "row" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 32 },
  logo: { maxHeight: 48, maxWidth: 160, marginBottom: 8, objectFit: "contain" },
  bizName: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  muted: { color: C.muted },
  title: { fontSize: 22, fontFamily: "Helvetica-Bold", textAlign: "right", letterSpacing: 1 },
  metaRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 2 },
  metaLabel: { color: C.muted, width: 70, textAlign: "right", marginRight: 8 },
  metaValue: { width: 90, textAlign: "right" },
  label: { fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  billTo: { marginBottom: 24 },
  th: { flexDirection: "row", backgroundColor: C.band, paddingVertical: 6, paddingHorizontal: 8, fontFamily: "Helvetica-Bold", fontSize: 9 },
  tr: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: C.rule },
  cDesc: { flex: 1, paddingRight: 8 },
  cNum: { width: 70, textAlign: "right" },
  cAmt: { width: 80, textAlign: "right" },
  totals: { marginTop: 12, alignSelf: "flex-end", width: 220 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  balanceRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, marginTop: 4, borderTopWidth: 1, borderTopColor: C.text, fontFamily: "Helvetica-Bold", fontSize: 12 },
  box: { marginTop: 28, padding: 12, backgroundColor: C.band, borderRadius: 4 },
  notes: { marginTop: 16 },
  void: { position: "absolute", top: 300, left: 120, fontSize: 96, color: "#dc2626", opacity: 0.15, transform: "rotate(-30deg)", fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 32, left: 48, right: 48, textAlign: "center", fontSize: 8, color: C.muted },
});

function logoSource(absPath: string | null) {
  if (!absPath) return null;
  try {
    const data = fs.readFileSync(absPath);
    const format = absPath.toLowerCase().endsWith(".png") ? "png" : "jpg";
    return { data, format } as const;
  } catch {
    return null;
  }
}

export function InvoiceDocument({
  detail,
  settings,
  logoAbsPath,
}: {
  detail: InvoiceDetail;
  settings: BusinessSettings;
  logoAbsPath: string | null;
}) {
  const { invoice, client, lines, totalCents, paidCents } = detail;
  const logo = logoSource(logoAbsPath);
  const balance = Math.max(0, totalCents - paidCents);
  const billTo = [client.contactName && client.contactName !== client.name ? client.contactName : "", client.billingAddress, client.email]
    .filter(Boolean)
    .join("\n");

  return (
    <Document title={`Invoice ${invoice.number}`} author={settings.businessName} creator="Ledger">
      <Page size="LETTER" style={s.page}>
        {invoice.voidedAt && <Text style={s.void}>VOID</Text>}

        <View style={s.header}>
          <View style={{ maxWidth: 260 }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
            {logo && <Image src={logo} style={s.logo} />}
            <Text style={s.bizName}>{settings.businessName}</Text>
            {settings.address ? <Text style={s.muted}>{settings.address}</Text> : null}
            {settings.email ? <Text style={s.muted}>{settings.email}</Text> : null}
            {settings.phone ? <Text style={s.muted}>{settings.phone}</Text> : null}
          </View>
          <View>
            <Text style={s.title}>INVOICE</Text>
            <View style={[s.metaRow, { marginTop: 12 }]}>
              <Text style={s.metaLabel}>Invoice #</Text>
              <Text style={s.metaValue}>{invoice.number}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Date</Text>
              <Text style={s.metaValue}>{formatDate(invoice.issuedOn)}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Due</Text>
              <Text style={s.metaValue}>{formatDate(invoice.dueOn)}</Text>
            </View>
          </View>
        </View>

        <View style={s.billTo}>
          <Text style={s.label}>Bill to</Text>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>{client.name}</Text>
          {billTo ? <Text>{billTo}</Text> : null}
        </View>

        <View style={s.th} fixed>
          <Text style={s.cDesc}>Description</Text>
          <Text style={s.cNum}>Hours</Text>
          <Text style={s.cNum}>Rate</Text>
          <Text style={s.cAmt}>Amount</Text>
        </View>
        {lines.map((l) => (
          <View key={l.id} style={s.tr} wrap={false}>
            <Text style={s.cDesc}>{l.description}</Text>
            <Text style={s.cNum}>{formatQuantity(l.quantityMilli)}</Text>
            <Text style={s.cNum}>{formatCents(l.unitPriceCents)}</Text>
            <Text style={s.cAmt}>{formatCents(l.amountCents)}</Text>
          </View>
        ))}

        <View style={s.totals} wrap={false}>
          <View style={s.totalRow}>
            <Text>Total</Text>
            <Text>{formatCents(totalCents)}</Text>
          </View>
          {paidCents > 0 && (
            <View style={s.totalRow}>
              <Text>Payments received</Text>
              <Text>-{formatCents(paidCents)}</Text>
            </View>
          )}
          <View style={s.balanceRow}>
            <Text>Balance due</Text>
            <Text>{formatCents(balance)}</Text>
          </View>
        </View>

        {settings.paymentInstructions ? (
          <View style={s.box} wrap={false}>
            <Text style={s.label}>How to pay</Text>
            <Text>{settings.paymentInstructions}</Text>
          </View>
        ) : null}

        {invoice.notes ? (
          <View style={s.notes} wrap={false}>
            <Text style={s.label}>Notes</Text>
            <Text>{invoice.notes}</Text>
          </View>
        ) : null}

        <Text
          style={s.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `${settings.businessName} · Invoice ${invoice.number}${totalPages > 1 ? ` · Page ${pageNumber} of ${totalPages}` : ""}`
          }
        />
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(args: Parameters<typeof InvoiceDocument>[0]): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument {...args} />);
}

export function invoicePdfFilename(number: string, businessName: string): string {
  const safe = (x: string) => x.replace(/[^\w.\- ]+/g, "").trim();
  return `${safe(number)}${businessName ? ` - ${safe(businessName)}` : ""}.pdf`;
}
