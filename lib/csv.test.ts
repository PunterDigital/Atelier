import { describe, expect, it } from "vitest";

import { parseCsv } from "./csv";

describe("parseCsv (RFC 4180)", () => {
  it("parses plain rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields with commas, newlines and escaped quotes", () => {
    expect(
      parseCsv('name,notes\n"Lumen, Labs","Said ""hi""\nacross two lines"'),
    ).toEqual([
      ["name", "notes"],
      ["Lumen, Labs", 'Said "hi"\nacross two lines'],
    ]);
  });

  it("handles CRLF line endings and a trailing newline", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("strips a UTF-8 BOM", () => {
    expect(parseCsv("﻿name\nAda")).toEqual([["name"], ["Ada"]]);
  });

  it("keeps empty fields, drops empty trailing rows", () => {
    expect(parseCsv("a,,c\n,,\n")).toEqual([
      ["a", "", "c"],
      ["", "", ""],
    ]);
    expect(parseCsv("a\n\n\n")).toEqual([["a"]]);
  });
});
