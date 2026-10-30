import type { Metadata } from "next";
import WishingPond from "@/components/pond/WishingPond";

export const metadata: Metadata = {
  title: "Wishing pond | html-in-canvas demo",
  description: "A koi pond whose HTML card is distorted by a WebGL ripple shader using the html-in-canvas API.",
};

export default function PondPage() {
  return <WishingPond />;
}
