"use client"

import { Bar } from "react-chartjs-2"
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js"

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

export default function RevenueChart() {
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        mode: "index",
        intersect: false,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
      },
      y: {
        grid: {
          color: "rgba(0, 0, 0, 0.05)",
        },
        ticks: {
          callback: (value) => value + "%",
        },
      },
    },
  }

  const labels = [
    "Jan 23",
    "Feb 23",
    "Mar 23",
    "Apr 23",
    "May 23",
    "Jun 23",
    "Jul 23",
    "Aug 23",
    "Sep 23",
    "Oct 23",
    "Nov 23",
    "Dec 23",
  ]

  const data = {
    labels,
    datasets: [
      {
        label: "Revenue",
        data: [20, 25, 22, 30, 28, 35, 40, 38, 42, 45, 48, 50],
        backgroundColor: "#92CE17",
        borderRadius: 4,
      },
      {
        label: "Profit",
        data: [10, 12, 11, 15, 14, 18, 30, 19, 21, 22, 24, 25],
        backgroundColor: "#1364FF",
        borderRadius: 4,
      },
    ],
  }

  return <Bar options={options} data={data} />
}
