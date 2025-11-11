"use client";

import React, { useRef } from "react";
import Header from "../components/header/Header";

export default function Home() {
  const homeRef = useRef<HTMLDivElement>(null);
  const meta = {
    title: "Samo Yan",
    description: `Data Scientist in commodities trading. Time-series modeling, ML systems, and data engineering.`,
    image: "/titofCercle.png",
    type: "website",
  };

  return (
    <>
      <main className="flex flex-col items-center justify-start min-h-screen px-4 sm:px-24">

        {/* Hero Section */}
        <section className="w-full max-w-5xl py-4 text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Siming Yan</h1>
          <p className="mt-2 text-xl text-gray-600 dark:text-gray-300">
            Data Scientist | Commodities Trading
          </p>
          <p className="mt-2 text-base text-gray-500 dark:text-gray-400">
            Data Scientist with 5+ years of experience in commodities analytics, ML modeling,
            and data engineering. Specialized in time-series forecasting, freight analytics,
            vessel/AIS modeling, and end-to-end ML systems. Passionate about leveraging
            large-scale data for trading insights.
          </p>
          <div className="mt-2 flex justify-center space-x-4">
            <a
              href="https://github.com/fyenne"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 bg-gray-800 text-white rounded hover:bg-gray-700 text-sm"
            >
              GitHub
            </a>
            <a
              href="https://www.kaggle.com/fyenneyenn"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-500 text-sm"
            >
              Kaggle
            </a>
            <Header />
          </div>
        </section>

        {/* Education Section */}
        <section id="education" className="w-full max-w-5xl py-0">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Education</h2>
          <div className="space-y-4">
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
              <h3 className="text-lg font-semibold">University of Wisconsin–Madison</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                M.S. Agriculture & Applied Economics (Econometrics, Time-Series Analysis)
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">2019 – 2021</p>
            </div>
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
              <h3 className="text-lg font-semibold">Donghua University</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                B.Eng Environment & Energy Engineering (Distinguished Thesis)
                <br />Minor in English Literature
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">2014 – 2018</p>
            </div>
          </div>
        </section>

        {/* Experience Section */}
        <section id="experience" className="w-full max-w-5xl py-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Professional Experience
          </h2>

          <div className="space-y-6">

            {/* Bunge */}
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
              <h3 className="text-lg font-semibold">Data Scientist — Freight Trading</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">Bunge</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Sep 2022 – Present</p>

              <ul className="mt-3 list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-300">
                <li>
                  Web crawling and data warehouse development from sources including Chinese stocks/futures exchanges,
                  yfinance commodity prices, news websites and supplier APIs. Utilized 
                  <a className="text-yellow-800 bg-stone-100"> MySQL, PostgreSQL, SQL Server.</a>
                </li>

                <li>
                  Data modeling projects:
                  <ul className="ml-6 list-disc list-inside space-y-1">
                    <li>
                      AIS vessel destination prediction using 
                      <a className="text-yellow-800 bg-stone-100"> GRU and LSTM </a>, custom region hierarchy (67 targets),
                      achieving MAP@3 <a className="text-red-800 bg-stone-100">0.97</a>.
                    </li>

                    <li>
                      Daily freight price modeling via 
                      <a className="text-yellow-800 bg-stone-100"> tree models (XGBoost, LightGBM, CatBoost) + LSTM </a>
                      ensemble; next-day price direction accuracy 
                      <a className="text-red-800 bg-stone-100">0.64±0.05</a>.
                    </li>

                    <li>
                      Trading opportunity triggers for Soybean Meal – Corn – Rapeseed Meal using tree models;
                      trading signal recall 
                      <a className="text-red-800 bg-stone-100">0.74±0.03</a>.
                    </li>
                  </ul>
                </li>

                <li>Created web-apps & dashboards with Django backend and Next.js frontend.</li>

                <li>
                  SHFE trading API build-up via
                  <a className="text-yellow-800 bg-stone-100"> C++</a>.
                </li>
              </ul>
            </div>

            {/* SF Supply Chain */}
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
              <h3 className="text-lg font-semibold">Big Data Engineer & Analyst</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">SF Supply Chain</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Jun 2021 – Sep 2022</p>

              <ul className="mt-3 list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-300">
                <li>
                  Built data warehouse pipelines with PySpark and Hadoop.
                  PB-level data transactions in distributed data middle platform.
                </li>
                <li>
                  LSTM forecasting for preposition warehouse transaction amount;
                  MAPE <a className="text-red-800 bg-stone-100">0.12±0.03</a>.
                </li>
                <li>
                  Developed dashboards and notification center systems.
                </li>
              </ul>
            </div>

          </div>
        </section>

        {/* Achievements Section */}
        <section id="achievements" className="w-full max-w-5xl py-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Achievements & Competitions
          </h2>

          <div className="space-y-4">
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
              <h3 className="text-lg font-semibold">Kaggle Competitions</h3>

              <ul className="mt-3 list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-300">

                <li>
                  <a
                    href="https://www.kaggle.com/competitions/map-charting-student-math-misunderstandings"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    MAP - Charting Student Math Misunderstandings
                  </a>
                  : LLM LoRA finetune, Solo <a className="text-red-700 bg-stone-100">Silver</a> Medal,
                  <a className="text-red-700 bg-stone-100"> 64th</a> / 1857 teams.
                </li>

                <li>
                  <a
                    href="https://www.kaggle.com/competitions/cmi-detect-behavior-with-sensor-data"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    CMI - Detect Behavior with Sensor Data
                  </a>
                  : Bidirectional LSTM–GRU, Solo <a className="text-red-700 bg-stone-100">Bronze</a> Medal,
                  <a className="text-red-700 bg-stone-100"> 234th</a> / 2657 teams.
                </li>

              </ul>
            </div>
          </div>
        </section>

        {/* ✅ Skills moved to the end (with NO color changes) */}
        <section className="w-full max-w-5xl py-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Skills</h2>
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow text-sm text-gray-700 dark:text-gray-300">
            <p><strong>Programming:</strong> Python, C++, SQL, JavaScript/TypeScript</p>
            <p>
              <strong>ML / DL:</strong> PyTorch, TensorFlow, LightGBM, XGBoost, CatBoost,
              LSTM, GRU, ensemble modeling, time-series forecasting
            </p>
            <p>
              <strong>Data:</strong> Polars, Pandas, PySpark, Hadoop, MySQL, PostgreSQL, SQL Server
            </p>
            <p>
              <strong>Backend & Frontend:</strong> Django, Next.js, REST APIs, Docker, Linux
            </p>
            <p>
              <strong>Tools:</strong> Git, CI/CD basics, Redis, Airflow (familiar)
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className="w-full max-w-5xl py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
          <p>&copy; 2025 Siming Yan. All rights reserved.</p>
        </footer>

      </main>
    </>
  );
}
