import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "约会体验反馈 · Samo",
  description: "匿名反馈问卷：聊聊那次约会，帮我看见自己没注意到的细节。",
};

export default function FeedbackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
