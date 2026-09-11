import { render } from "@testing-library/react";
import { PieChart, Pie, Cell, Customized } from "recharts";
import { ChartStripeDefs, chartColorAt } from "./chartPalette";

/**
 * The striped slice has something to paint it.
 *
 * Recharts renders only the children it knows about, so a plain `<defs>`
 * written inside `<PieChart>` is silently dropped — the pattern never reaches
 * the document and the grey slice comes out unpainted. `Customized` is the
 * supported way in, and this is here because the failure is invisible: no
 * error, no warning, just a slice that is not there.
 */
it("recharts keeps the pattern, and the arc references it", () => {
  const data = [
    { name: "a", value: 45, ...chartColorAt(0) },
    { name: "b", value: 20, ...chartColorAt(1) },
    { name: "c", value: 35, ...chartColorAt(2) },
  ];
  const { container } = render(
    <PieChart width={300} height={300}>
      <Customized component={ChartStripeDefs} />
      <Pie data={data} dataKey="value" cx="50%" cy="50%" outerRadius={100} innerRadius={60} isAnimationActive={false}>
        {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
      </Pie>
    </PieChart>,
  );
  const pattern = container.querySelector("#chart-stripe-gray");
  expect(pattern).not.toBeNull();
  expect(pattern!.tagName.toLowerCase()).toBe("pattern");

  const paths = Array.from(container.querySelectorAll("path.recharts-sector"));
  const fills = paths.map((p) => p.getAttribute("fill"));
  expect(fills).toContain("url(#chart-stripe-gray)");
});
