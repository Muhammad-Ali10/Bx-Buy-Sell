"use client"

import { Doughnut } from "react-chartjs-2"
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js"

ChartJS.register(ArcElement, Tooltip, Legend)

export default function SalesChannelsChart() {
  const data = {
    labels: ["Shopify Store", "Etsy", "Amazon"],
    datasets: [
      {
        data: [45, 35, 20],
        backgroundColor: ["#c1ff00", "#e5e5e5", "#3b82f6"],
        borderWidth: 0,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    cutout: "70%",
  }

  return <Doughnut data={data} options={options} />
}
