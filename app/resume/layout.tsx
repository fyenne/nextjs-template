import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Siming Yan | Data Scientist & Quantitative Modeler",
  description:
    "Portfolio and resume of Siming Yan — Data Scientist in commodities trading specializing in freight analytics, time-series forecasting, AIS vessel modeling, and ML data engineering.",
  keywords: [
    "Siming Yan",
    "Data Scientist",
    "Commodities Trading",
    "Freight Analytics",
    "Time-Series Forecasting",
    "Machine Learning",
    "Quantitative Trading",
  ],
  authors: [{ name: "Siming Yan", url: "https://github.com/fyenne" }],
};

export default function ResumeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
