/**
 * The colours the listing page's donut charts are drawn in.
 *
 * The client set the order: black, green, grey, blue, orange, and then
 * whatever else for a chart with more slices than five. The grey is striped.
 */

/**
 * How one slice is painted, in the two forms the page needs.
 *
 * The arc is SVG and the legend dot beside it is an HTML div, so a colour has
 * to exist twice over. That was fine while every colour was a plain string;
 * the striped grey the client asked for is a `<pattern>` in one and a
 * `repeating-linear-gradient` in the other, and neither form can stand in for
 * the other.
 */
export type ChartColor = {
  /** An SVG paint — a colour, or a reference to a pattern in `<defs>`. */
  fill: string;
  /** A CSS background for the legend dot. */
  legend: string;
};

const solidChartColor = (value: string): ChartColor => ({ fill: value, legend: value });

/** The angle the diagonal stripe already uses elsewhere on this page. */
const STRIPE_ANGLE = -123.16;
const STRIPE_PERIOD = 5;
const STRIPE_WIDTH = 1;
const STRIPE_BASE = 'rgba(0, 0, 0, 0.06)';
const STRIPE_LINE = 'rgba(0, 0, 0, 0.30)';
const STRIPE_PATTERN_ID = 'chart-stripe-gray';

/**
 * The striped grey, defined once for the chart.
 *
 * Rendered inside every `<PieChart>` that can show it. A pattern is only
 * usable by the SVG document it lives in, so the locked placeholder needs its
 * own copy rather than borrowing the real chart's.
 */
export const ChartStripeDefs = () => (
  <defs>
    <pattern
      id={STRIPE_PATTERN_ID}
      width={STRIPE_PERIOD}
      height={STRIPE_PERIOD}
      patternUnits="userSpaceOnUse"
      patternTransform={`rotate(${STRIPE_ANGLE + 90})`}
    >
      <rect width={STRIPE_PERIOD} height={STRIPE_PERIOD} fill={STRIPE_BASE} />
      <rect width={STRIPE_PERIOD} height={STRIPE_WIDTH} fill={STRIPE_LINE} />
    </pattern>
  </defs>
);

/**
 * The order the client asked for: black, green, grey, blue, orange — and then
 * the colours that were already here, for a chart with more slices than five.
 *
 * The list used to start at lime and hold no black and no grey at all, so the
 * first two slices of every chart came out lime and blue.
 */
export const CHART_PALETTE: ChartColor[] = [
  solidChartColor('rgba(0, 0, 0, 1)'),
  solidChartColor('rgba(198, 255, 28, 1)'),
  {
    fill: `url(#${STRIPE_PATTERN_ID})`,
    legend: `repeating-linear-gradient(${STRIPE_ANGLE}deg, ${STRIPE_BASE}, ${STRIPE_BASE} ${
      STRIPE_PERIOD - STRIPE_WIDTH
    }px, ${STRIPE_LINE} ${STRIPE_PERIOD - STRIPE_WIDTH}px, ${STRIPE_LINE} ${STRIPE_PERIOD}px)`,
  },
  solidChartColor('rgba(19, 100, 255, 1)'),
  solidChartColor('rgba(255, 182, 39, 1)'),
  // Past the five the client named, whatever keeps the slices apart.
  solidChartColor('rgba(255, 92, 135, 1)'),
  solidChartColor('rgba(92, 214, 255, 1)'),
  solidChartColor('rgba(143, 102, 255, 1)'),
];

export const chartColorAt = (index: number): ChartColor =>
  CHART_PALETTE[index % CHART_PALETTE.length];

