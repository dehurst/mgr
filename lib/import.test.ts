import { describe, expect, it } from "vitest";
import { cleanVendor, detectColumns, parseCsv, parseStatement, parseStatementAmount, parseStatementDate, suggestImport } from "./import";

describe("parseCsv", () => {
  it("handles quotes, embedded commas/newlines, CRLF, and a BOM", () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n"multi\nline",3\n\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
      ["multi\nline", "3"],
    ]);
  });
});

describe("statement fields", () => {
  it.each([
    ["2024-03-05", "2024-03-05"],
    ["03/05/2024", "2024-03-05"],
    ["3/5/24", "2024-03-05"],
    ["12/31/2025", "2025-12-31"],
    ["01-01-2026", "2026-01-01"],
    ["02/30/2024", null],
    ["Pending", null],
  ])("date %s -> %s", (raw, out) => expect(parseStatementDate(raw)).toBe(out));

  it.each([
    ["$1,234.56", 123456],
    ["-12.00", -1200],
    ["$-12.00", -1200],
    ["-$12.00", -1200],
    ["(12.00)", -1200],
    ["12.00 CR", -1200],
    [" 7 ", 700],
    ["", null],
    ["abc", null],
  ])("amount %j -> %s", (raw, out) => expect(parseStatementAmount(raw)).toBe(out));

  it("finds columns, preferring the transaction date over the post date", () => {
    expect(detectColumns(["Transaction Date", "Post Date", "Description", "Category", "Type", "Amount", "Memo"])).toEqual({ date: 0, description: 2, amount: 5 });
    expect(detectColumns(["Posting Date", "Description", "Debit", "Credit"])).toEqual({ date: 0, description: 1, debit: 2, credit: 3 });
    expect(detectColumns(["foo", "bar"])).toBeNull();
  });
});

describe("parseStatement", () => {
  it("card export with charges positive (Amex style): spending stays positive, credits negative", () => {
    const p = parseStatement("Date,Description,Amount\n01/05/2026,ADOBE *CREATIVE CLD,59.99\n01/09/2026,AMAZON.COM,23.10\n01/20/2026,ONLINE PAYMENT - THANK YOU,-83.09\n");
    expect(p.chargeSign).toBe("positive");
    expect(p.lines.map((l) => l.amountCents)).toEqual([5999, 2310, -8309]);
  });

  it("bank/card export with charges negative (Chase style) is flipped; account info above the header is skipped", () => {
    const csv = "Account: ****1234\n\nTransaction Date,Post Date,Description,Category,Type,Amount,Memo\n01/05/2026,01/06/2026,VERIZON WIRELESS,Bills,Sale,-120.00,\n01/07/2026,01/07/2026,STAPLES 0123,Shopping,Sale,-15.00,\n01/08/2026,01/09/2026,STAPLES 0123,Shopping,Return,15.00,\n";
    const p = parseStatement(csv);
    expect(p.chargeSign).toBe("negative");
    expect(p.lines.map((l) => [l.date, l.amountCents])).toEqual([
      ["2026-01-05", 12000],
      ["2026-01-07", 1500],
      ["2026-01-08", -1500],
    ]);
    expect(parseStatement(csv, "positive").lines[0].amountCents).toBe(-12000); // the user can flip it
  });

  it("debit/credit columns; reports unreadable lines instead of guessing", () => {
    const p = parseStatement("Date,Description,Debit,Credit\n2026-02-01,COFFEE,4.50,\n2026-02-02,DEPOSIT,,1000.00\nbad,THING,1.00,\n");
    expect(p.lines.map((l) => l.amountCents)).toEqual([450, -100000]);
    expect(p.errors).toEqual([{ line: 4, message: 'Unreadable date "bad".' }]);
  });
});

describe("cleanVendor", () => {
  it.each([
    ["SQ *BLUE BOTTLE COFFEE 0123 OAKLAND CA", "Blue Bottle Coffee"],
    ["ADOBE *CREATIVE CLD", "Adobe"],
    ["STAPLES 00123", "Staples"],
    ["GitHub", "GitHub"],
    ["TST* JOE'S DINER #42", "Joe's Diner"],
  ])("%s -> %s", (raw, out) => expect(cleanVendor(raw)).toBe(out));
});

describe("suggestImport", () => {
  const history = [
    { vendor: "Verizon", categoryId: 7, businessPct: 40 },
    { vendor: "Adobe", categoryId: 3, businessPct: 100 },
  ];
  const line = (date: string, description: string, amountCents: number, n = 1) => ({ line: n, date, description, amountCents });

  it("uses the category and business % of the matching past vendor", () => {
    const [s] = suggestImport([line("2026-01-05", "VERIZON WIRELESS PAYMENTS", 120_00)], history, []);
    expect(s).toMatchObject({ vendor: "Verizon", categoryId: 7, businessPct: 40, include: true });
    const [unknown] = suggestImport([line("2026-01-05", "NEW PLACE", 5_00)], history, []);
    expect(unknown).toMatchObject({ vendor: "New Place", categoryId: null, businessPct: 100, include: true });
  });

  it("unchecks card payments, transfers, money in, and likely duplicates", () => {
    const existing = [{ paidOn: "2026-01-04", amountCents: 59_99, vendor: "Adobe" }];
    const out = suggestImport(
      [
        line("2026-01-20", "PAYMENT THANK YOU-MOBILE", -500_00),
        line("2026-01-21", "ONLINE BANKING TRANSFER TO SAV", 200_00),
        line("2026-01-08", "STAPLES 0123", -15_00),
        line("2026-01-06", "ADOBE *CREATIVE CLD", 59_99), // 2 days after the one already entered
        line("2026-03-06", "ADOBE *CREATIVE CLD", 59_99), // a month later: a new charge
      ],
      history,
      existing,
    );
    expect(out.map((s) => s.include)).toEqual([false, false, false, false, true]);
    expect(out[0].note).toMatch(/Card payment/);
    expect(out[2].note).toMatch(/refund/);
    expect(out[3].note).toMatch(/duplicate of Adobe on 2026-01-04/);
  });

  it("a very short or empty vendor never matches everything", () => {
    const [s] = suggestImport([line("2026-01-05", "##", 10_00)], [{ vendor: "X", categoryId: 1, businessPct: 100 }], [{ paidOn: "2026-01-05", amountCents: 99, vendor: "" }]);
    expect(s.include).toBe(true);
    expect(s.categoryId).toBeNull();
  });
});
