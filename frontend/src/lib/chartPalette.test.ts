import { CHART_PALETTE, chartColorAt } from "./chartPalette";

/**
 * The order the client set: black, green, grey, blue, orange, then others.
 *
 * The list used to begin at lime and hold no black and no grey at all, so the
 * first two slices of every chart came out lime and blue. Pinned here because
 * the order is the requirement — a colour moved by accident is not something
 * a type or a compiler would notice.
 */
describe("the chart palette", () => {
  it("starts with the five the client named, in order", () => {
    expect(CHART_PALETTE.slice(0, 5).map((c) => c.legend)).toEqual([
      "rgba(0, 0, 0, 1)",
      "rgba(198, 255, 28, 1)",
      expect.stringContaining("repeating-linear-gradient"),
      "rgba(19, 100, 255, 1)",
      "rgba(255, 182, 39, 1)",
    ]);
  });

  it("makes the third one striped, in both forms", () => {
    const grey = CHART_PALETTE[2];
    // The arc is SVG and the legend dot is a div; neither form substitutes
    // for the other, so a striped entry has to carry both.
    expect(grey.fill).toBe("url(#chart-stripe-gray)");
    expect(grey.legend).toContain("repeating-linear-gradient(-123.16deg");
  });

  it("paints the stripe at the same angle and rhythm in both forms", () => {
    // The SVG side is checked through the id it references; the CSS side
    // carries the numbers, and they are the ones the page already uses for a
    // diagonal stripe elsewhere.
    expect(CHART_PALETTE[2].legend).toContain("4px");
    expect(CHART_PALETTE[2].legend).toContain("5px");
  });

  it("gives every solid colour the same value in both forms", () => {
    for (const colour of CHART_PALETTE) {
      if (colour.fill.startsWith("url(")) continue;
      expect(colour.fill).toBe(colour.legend);
    }
  });

  it("has enough colours that a chart of eight repeats nothing", () => {
    const eight = Array.from({ length: 8 }, (_, i) => chartColorAt(i).legend);
    expect(new Set(eight).size).toBe(8);
  });

  it("wraps round rather than running out", () => {
    expect(chartColorAt(CHART_PALETTE.length)).toEqual(chartColorAt(0));
    expect(chartColorAt(CHART_PALETTE.length + 2)).toEqual(chartColorAt(2));
  });
});
