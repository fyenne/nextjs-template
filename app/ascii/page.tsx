import type { Metadata } from "next";
import AsciiCube from "@/components/ascii/AsciiCube";

export const metadata: Metadata = {
  title: "ascii",
  description: "A separate demo: a box of streaming characters, larger than the screen, that turns when you type 11 letters or numbers.",
};

export default function AsciiPage() {
  return <AsciiCube />;
}
