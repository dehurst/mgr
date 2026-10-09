import { describe, expect, it } from "vitest";
import { receiptFilename, receiptKind } from "./receipts";

describe("receipts", () => {
  it("names downloads by date, vendor, and amount, keeping the file's extension", () => {
    expect(receiptFilename({ paidOn: "2026-03-01", vendor: "Adobe", amountCents: 5999, receiptPath: "receipts/1-ab.PDF" })).toBe(
      "Receipt 2026-03-01 Adobe 59.99.pdf",
    );
    expect(receiptFilename({ paidOn: "2026-03-01", vendor: 'Café "Ñ" / Bar', amountCents: 500, receiptPath: "receipts/x.heic" })).toBe(
      "Receipt 2026-03-01 Caf Bar 5.00.heic",
    );
    expect(receiptFilename({ paidOn: "2026-03-01", vendor: "???", amountCents: 7, receiptPath: "r/x.jpg" })).toBe("Receipt 2026-03-01 0.07.jpg");
  });

  it("previews PDFs in a frame and everything else as an image", () => {
    expect(receiptKind("receipts/a.pdf")).toBe("pdf");
    expect(receiptKind("receipts/a.HEIC")).toBe("image");
  });
});
