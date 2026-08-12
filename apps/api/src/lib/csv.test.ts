import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

const columns = [
  { key: "name", label: "Name" },
  { key: "note", label: "Note" },
];

describe("toCsv — formula-injection guard", () => {
  it.each([
    ["=cmd|'/c calc'!A1", "Name,Note\n'=cmd|'/c calc'!A1,safe"],
    ["+1+1", "Name,Note\n'+1+1,safe"],
    ["-2+3", "Name,Note\n'-2+3,safe"],
    // Also contains a comma, so the pre-existing quote-escaping wraps the
    // whole field in addition to the leading-quote formula-injection guard.
    ["@SUM(1,1)", 'Name,Note\n"\'@SUM(1,1)",safe'],
  ])("prefixes a leading-%s value with a literal single quote", (value, expected) => {
    const csv = toCsv(columns, [{ name: value, note: "safe" }]);
    expect(csv).toBe(expected);
  });

  it("does not alter a value with no dangerous leading character", () => {
    const csv = toCsv(columns, [{ name: "Regular Name", note: "hello" }]);
    expect(csv).toBe("Name,Note\nRegular Name,hello");
  });

  it("still quotes commas and escapes embedded quotes", () => {
    const csv = toCsv(columns, [{ name: "Contains, comma", note: 'Has "quotes"' }]);
    expect(csv).toBe('Name,Note\n"Contains, comma","Has ""quotes"""');
  });

  it("renders null/undefined as an empty cell", () => {
    const csv = toCsv(columns, [{ name: null, note: undefined }]);
    expect(csv).toBe("Name,Note\n,");
  });
});
