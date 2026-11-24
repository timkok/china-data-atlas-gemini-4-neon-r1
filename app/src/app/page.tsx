import React from "react";
import { HomeClient } from "@/components/HomeClient";
import { getAtlasSummary } from "@/lib/atlas";

export default function HomePage() {
  const summary = getAtlasSummary();
  return <HomeClient bundle={summary} />;
}
