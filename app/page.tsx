import React from "react";
import CopyEmailButton from "@/components/contact/CopyEmailButton";

export default function Home() {
  const currentYear = new Date().getFullYear();

  return (
    <main className="flex flex-col items-center justify-start min-h-screen px-4 sm:px-12 md:px-24 py-8">
      {/* Hero Section */}
      <section className="w-full max-w-5xl py-6 text-center">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          Siming Yan
        </h1>
        <p className="mt-3 text-xl font-medium text-gray-700 dark:text-gray-200">
          Data Scientist | Commodities Trading & Quantitative Modeling
        </p>
        <p className="mt-3 text-base text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
          Data Scientist with 5+ years of experience in commodities analytics, time-series forecasting,
          and distributed data engineering. Specialized in freight market alpha modeling, vessel/AIS
          trajectory prediction, and end-to-end ML platforms.
        </p>

        <div className="mt-5 flex flex-wrap justify-center items-center gap-3">
          <a
            href="https://github.com/fyenne"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-3.5 py-1.5 text-sm font-medium bg-gray-800 text-white rounded hover:bg-gray-700 transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://www.kaggle.com/fyenneyenn"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-3.5 py-1.5 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
          >
            Kaggle
          </a>
          <CopyEmailButton />
        </div>
      </section>

      {/* Education Section */}
      <section id="education" className="w-full max-w-5xl py-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 border-b pb-2 border-gray-200 dark:border-gray-700">
          Education
        </h2>
        <div className="space-y-4">
          <div className="p-5 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                University of Wisconsin–Madison
              </h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">2019 – 2021</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              M.S. Agriculture & Applied Economics (Econometrics, Time-Series Analysis)
            </p>
          </div>

          <div className="p-5 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Donghua University
              </h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">2014 – 2018</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              B.Eng Environment & Energy Engineering{" "}
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                (Distinguished Undergraduate Thesis)
              </span>
              <br />
              Minor in English Literature
            </p>
          </div>
        </div>
      </section>

      {/* Experience Section */}
      <section id="experience" className="w-full max-w-5xl py-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 border-b pb-2 border-gray-200 dark:border-gray-700">
          Professional Experience
        </h2>

        <div className="space-y-6">
          {/* Bunge */}
          <div className="p-5 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Data Scientist — Freight Trading
              </h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">Sep 2022 – Present</span>
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Bunge</p>

            <ul className="mt-4 list-disc list-outside ml-5 space-y-2 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              <li>
                Led development of a centralized freight & logistics data warehouse integrating
                global futures/options data, macroeconomic indicators, weather forecasts,
                AIS vessel tracking streams, and commodity supply–demand balances.
              </li>

              <li>
                Designed and implemented a multi-layer warehouse architecture{" "}
                <span className="inline-block px-1.5 py-0.5 font-mono text-xs font-medium rounded bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                  ODS → DWD → ADS
                </span>{" "}
                supporting data governance, scalable analytics, and automated machine learning pipelines,
                built on{" "}
                <span className="inline-block px-1.5 py-0.5 font-mono text-xs font-medium rounded bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                  SQL Server, MySQL, PostgreSQL
                </span>.
              </li>

              <li>
                Developed quantitative freight price forecasting models using ensemble tree methods{" "}
                <span className="inline-block px-1.5 py-0.5 font-mono text-xs font-medium rounded bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                  (XGBoost, LightGBM, CatBoost)
                </span>{" "}
                combined with neural architectures; production trading strategy achieved an annualized mean Sharpe Ratio of{" "}
                <span className="inline-block px-1.5 py-0.5 font-mono text-xs font-bold rounded bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40">
                  3.4
                </span>{" "}
                over the past two years, serving as a core supplementary trading signal.
              </li>

              <li>
                Built AIS vessel destination prediction models utilizing{" "}
                <span className="inline-block px-1.5 py-0.5 font-mono text-xs font-medium rounded bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                  Attention, GRU, LSTM
                </span>{" "}
                architectures across a custom hierarchical maritime region network (67 targets), achieving MAP@3 of{" "}
                <span className="inline-block px-1.5 py-0.5 font-mono text-xs font-bold rounded bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40">
                  0.97
                </span>.
              </li>

              <li>
                Engineered trading opportunity triggers on{" "}
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  Soybean Meal – Corn – Rapeseed Meal
                </span>{" "}
                futures spreads using tree-based classification for opportunistic trade entry, achieving Recall of{" "}
                <span className="inline-block px-1.5 py-0.5 font-mono text-xs font-bold rounded bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40">
                  0.72+
                </span>.
              </li>

              <li>
                Conducted cross-market statistical analysis between Chinese ETF assets
                and global equity markets using correlation analysis and linear regression
                to identify macro-driven asset dynamics.
              </li>

              <li>
                Developed scalable analytics platforms with{" "}
                <span className="inline-block px-1.5 py-0.5 font-mono text-xs font-medium rounded bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                  Django, GraphQL
                </span>{" "}
                backend services and interactive web dashboards using{" "}
                <span className="inline-block px-1.5 py-0.5 font-mono text-xs font-medium rounded bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                  Next.js, TailwindCSS, HighCharts
                </span>.
              </li>

              <li>
                Implemented low-latency trading connectivity for the SHFE market via{" "}
                <span className="inline-block px-1.5 py-0.5 font-mono text-xs font-medium rounded bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                  C++ trading API
                </span>.
              </li>
            </ul>
          </div>

          {/* SF Supply Chain */}
          <div className="p-5 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Big Data Engineer & Analyst
              </h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">Jun 2021 – Sep 2022</span>
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">SF Supply Chain</p>

            <ul className="mt-4 list-disc list-outside ml-5 space-y-2 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              <li>
                Designed distributed data warehouse pipelines using{" "}
                <span className="inline-block px-1.5 py-0.5 font-mono text-xs font-medium rounded bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                  PySpark and Hadoop
                </span>, supporting PB-scale transactional data processing across the enterprise data middle platform.
              </li>

              <li>
                Developed LSTM forecasting models for pre-position warehouse transaction volumes,
                achieving MAPE of{" "}
                <span className="inline-block px-1.5 py-0.5 font-mono text-xs font-bold rounded bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40">
                  0.12 ± 0.03
                </span>.
              </li>

              <li>
                Built internal operational analytics dashboards and automated notification systems
                for real-time warehouse monitoring and reporting.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Achievements Section */}
      <section id="achievements" className="w-full max-w-5xl py-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 border-b pb-2 border-gray-200 dark:border-gray-700">
          Achievements & Competitions
        </h2>

        <div className="space-y-4">
          <div className="p-5 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Kaggle Competitions
            </h3>

            <ul className="mt-4 list-disc list-outside ml-5 space-y-3 text-sm text-gray-600 dark:text-gray-300">
              <li>
                <a
                  href="https://www.kaggle.com/competitions/map-charting-student-math-misunderstandings"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  MAP – Charting Student Math Misunderstandings
                </a>
                : LLM LoRA fine-tuning, Solo{" "}
                <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600">
                  Silver Medal
                </span>,{" "}
                <span className="inline-block px-1.5 py-0.5 font-mono text-xs font-bold rounded bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40">
                  64th / 1,857 teams (Top 3.5%)
                </span>.
              </li>

              <li>
                <a
                  href="https://www.kaggle.com/competitions/cmi-detect-behavior-with-sensor-data"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  CMI – Detect Behavior with Sensor Data
                </a>
                : Bidirectional LSTM–GRU, Solo{" "}
                <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                  Bronze Medal
                </span>,{" "}
                <span className="inline-block px-1.5 py-0.5 font-mono text-xs font-bold rounded bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40">
                  234th / 2,657 teams (Top 8.8%)
                </span>.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Skills Section */}
      <section id="skills" className="w-full max-w-5xl py-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 border-b pb-2 border-gray-200 dark:border-gray-700">
          Technical Skills
        </h2>
        <div className="p-5 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 text-sm space-y-2.5 text-gray-700 dark:text-gray-300">
          <p>
            <strong className="text-gray-900 dark:text-white">Programming:</strong>{" "}
            Python, C++, SQL, JavaScript / TypeScript
          </p>
          <p>
            <strong className="text-gray-900 dark:text-white">ML / DL:</strong>{" "}
            PyTorch, TensorFlow, LightGBM, XGBoost, CatBoost, LSTM, GRU, Attention, Ensemble Modeling, Time-Series Forecasting
          </p>
          <p>
            <strong className="text-gray-900 dark:text-white">Data Engineering:</strong>{" "}
            Polars, Pandas, PySpark, Hadoop, MySQL, PostgreSQL, SQL Server
          </p>
          <p>
            <strong className="text-gray-900 dark:text-white">Backend & Frontend:</strong>{" "}
            Django, Next.js, GraphQL, REST APIs, Docker, Linux
          </p>
          <p>
            <strong className="text-gray-900 dark:text-white">Tools & Workflow:</strong>{" "}
            Git, CI/CD, Redis, Airflow
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full max-w-5xl py-8 mt-4 text-center text-gray-500 dark:text-gray-400 text-sm border-t border-gray-200 dark:border-gray-800">
        <p>&copy; {currentYear} Siming Yan. All rights reserved.</p>
      </footer>
    </main>
  );
}
