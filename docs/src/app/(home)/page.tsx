import type { Metadata } from "next";
import HomePageContent from "./HomePageContent";

export const metadata: Metadata = {
  title: "Cortex",
  openGraph: {
    title: "Cortex - Vector Storage for AI Applications",
    description:
      "Developer-controlled context memory layer for Effect applications. Vector storage for AI/LLM applications, built with Effect and ZVec.",
    type: "website",
  },
};

export default function HomePage() {
  return <HomePageContent />;
}
