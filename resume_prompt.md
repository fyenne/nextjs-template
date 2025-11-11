based on my current code, extend more to a professional resume website, 

I have been educated in Uni of Wisconsin Madison major in Agriculture and applied economics 2019-2021
I have been educated in Uni of donghua major in Environment and Energy Engineering 2014-2018, minor in English Literature (distinguish undergraduate thesis)

my current work is at bunge, since 2022.9, where I serve as data scientist in Freight Trading.

major works including 
1. web crawling, data warehouse building up. Sources including but not limited to Chinese futures exchanges (4), yfiance commodity prices, data supplier API. MySQL, Postgres SQL, Sql Server.
2. datadash board creating, django as backend, Next.js as frontend (mostly vibe coding.)
3. data modeling
    a.> AIS vessel destination prediction via GRU and LSTM, self-defined regional level on 67 targets, map@3 score .97;
    b.> Daily freight price data modeling via tree based models (XGB, LGBM, CATBoost) and LSTM ensemble; next day price up or down. acc = 0.67+
    c.> Trading opportunity triggers on Soybean Meal - Corn - Rapeseed Meal futures. Tree models, binary classification on label of trading or not: Recall = .72, precisision = 

my prvious job was 2021.6 to 2022.9
at SF supply chain as big data engineer and analyst
1. Building data warehouse pipelines. Pyspark, Hadoop.
2. 

I also earned two kaggle medals recently:
1. MAP - Charting Student Math Misunderstandings; https://www.kaggle.com/competitions/map-charting-student-math-misunderstandings; solo silver placed 64th out of 1857 teams.
2. CMI; https://www.kaggle.com/competitions/cmi-detect-behavior-with-sensor-data; solo bronze medal placed 234th out of 2657 teams.


also my github: https://github.com/fyenne
my kaggle: https://www.kaggle.com/fyenneyenn

---
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

      <main className="flex flex-col items-center justify-between min-h-screen p-x-24">
        <div className="z-10 items-center justify-between w-full max-w-5xl font-mono text-sm lg:flex">
          <div className="fixed mt-5 top-2 left-0 flex justify-center w-full pt-8 pb-6  border-b border-gray-300 bg-gradient-to-b from-zinc-200 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">Siming Yan;</div>
          <Header />
        </div>

        <div className="grid mb-32 text-center lg:mb-0 lg:w-full lg:max-w-5xl lg:grid-cols-2 lg:text-left">
          
        </div>
      </main>
    </>
  );
}
