"use client";

import { Field } from "./PageBackground";

/** Dashboards and trackers: the same lavender field, tinted by state. */
export function AmbientBackground({ accent }: { accent: "brand" | "zest" | "success" }) {
  return <Field tint={accent} />;
}
