import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "你好，我是 Samo · 一棵关于我的树",
  description:
    "一棵从出生长到现在的人生树：主干是时间线，枝头是爱好。点一节时间，放大看看那时候的我。",
};

export default function HelloLayout({ children }: { children: React.ReactNode }) {
  return children;
}
