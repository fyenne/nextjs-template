import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import React from "react";

const inter = Inter({ subsets: ["latin"] });

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
