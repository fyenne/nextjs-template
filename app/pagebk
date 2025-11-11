"use client";

import React from "react";
import Header from "../components/header/Header";
import { useContext, useEffect, useState, useRef } from "react";

export default function Home() {
  const homeRef = useRef<HTMLDivElement>(null);
  const meta = {
    title: "Samo yan",
    description: `I've been working on datascience for 5 years. Get in touch with me to know more.`,
    image: "/titofCercle.png",
    type: "website",
  };
  return (
    <>

      <main className="flex flex-col items-center justify-start min-h-screen px-4 sm:px-24">
        {/* Hero Section */}
        <section className="w-full max-w-5xl py-4 text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Siming Yan</h1>
          <p className="mt-2 text-xl text-gray-600 dark:text-gray-300">Data Scientist | Commodities Trading</p>
          <p className="mt-2 text-base text-gray-500 dark:text-gray-400">
            Experienced data scientist with over 5 years in building data pipelines, dashboards, and Machine Learning / Deep Learning models. Passionate about leveraging data for trading insights.
          </p>
          <div className="mt-2 flex justify-center space-x-4">
            <a href="https://github.com/fyenne" target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-gray-800 text-white rounded hover:bg-gray-700 text-sm">GitHub</a>
            <a href="https://www.kaggle.com/fyenneyenn" target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-500 text-sm">Kaggle</a>
            <Header />
          </div>
        </section>

        {/* Education Section */}
        <section id="education" className="w-full max-w-5xl py-0">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Education</h2>
          <div className="space-y-4">
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
              <h3 className="text-lg font-semibold">University of Wisconsin-Madison</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">Major in Agriculture and Applied Economics</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">2019 - 2021</p>
            </div>
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
              <h3 className="text-lg font-semibold">Donghua University</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">Major in Environment and Energy Engineering, Minor in English Literature</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">2014 - 2018 (Distinguished Undergraduate Thesis)</p>
            </div>
          </div>
        </section>

        {/* Experience Section */}
        <section id="experience" className="w-full max-w-5xl py-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Professional Experience</h2>
          <div className="space-y-6">
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
              <h3 className="text-lg font-semibold">Data Scientist, Freight Trading</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">Bunge</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">September 2022 - Present</p>
              <ul className="mt-3 list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-300">
                <li>Web crawling and data warehouse development from sources including Chinese stocks / futures exchanges, yfinance commodity prices, news websites and data supplier APIs. Utilized <a className="text-yellow-800 bg-stone-100">MySQL, PostgreSQL, and SQL Server.</a></li>
                <li>Data modeling projects:
                  <ul className="ml-6 list-disc list-inside space-y-1">
                    <li>AIS vessel destination prediction: using <a className="text-yellow-800 bg-stone-100">GRU and LSTM</a>, self-defined regional levels on 67 targets, achieving MAP@3 score of <a className="text-red-800 bg-stone-100">0.97</a>.</li>
                    <li>Daily freight price modeling: via <a className="text-yellow-800 bg-stone-100">tree-based models (XGBoost, LightGBM, CatBoost) and LSTM </a> ensemble for next-day price direction binary classification; accuracy <a className="text-red-800 bg-stone-100">0.64±0.05</a>.</li>
                    <li>Trading opportunity triggers for Soybean Meal - Corn - Rapeseed Meal futures: using tree-based models; binary classification, label trading signal with recall <a className="text-red-800 bg-stone-100">0.74±0.03</a>.</li>
                  </ul>
                </li>
                <li>Created web-apps & dashboards with Django backend and Next.js frontend.</li>
                <li>SHFE trading API build up via <a className="text-yellow-800 bg-stone-100">C++.</a></li>
              </ul>
            </div>
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
              <h3 className="text-lg font-semibold">Big Data Engineer and Analyst</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">SF Supply Chain</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">June 2021 - September 2022</p>
              <ul className="mt-3 list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-300">
                <li>Built data warehouse pipelines with PySpark and Hadoop. PB level data transactions in distributed data Middle Platform.</li>
                <li>Preposition warehouse transaction amount prediction with LSTM. MAPE <a className="text-red-800 bg-stone-100">0.12±0.03</a>. </li>
                <li>Data Applications such as dashboards and notification center.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Achievements Section */}
        <section id="achievements" className="w-full max-w-5xl py-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Achievements & Competitions</h2>
          <div className="space-y-4">
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
              <h3 className="text-lg font-semibold">Kaggle Competitions</h3>
              <ul className="mt-3 list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-300">
                <li>
                  <a href="https://www.kaggle.com/competitions/map-charting-student-math-misunderstandings" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    MAP - Charting Student Math Misunderstandings
                  </a>: LLM lora fintune, Solo Silver Medal, <a className="text-red-700 bg-stone-100">64th</a> out of 1857 teams.
                </li>
                <li>
                  <a href="https://www.kaggle.com/competitions/cmi-detect-behavior-with-sensor-data" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    CMI - Detect Behavior with Sensor Data
                  </a>: Bidirectional LSTM-GRU, Solo Bronze Medal, <a className="text-red-700 bg-stone-100">234th</a> out of 2657 teams.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Footer or Contact */}
        <footer className="w-full max-w-5xl py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
          <p>&copy; 2025 Siming Yan. All rights reserved.</p>
        </footer>

      </main>
    </>
  );
}