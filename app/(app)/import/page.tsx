import type { Metadata } from "next";
import ImportView from "@/components/import/ImportView";

export const metadata: Metadata = { title: "Import from GitHub" };

export default function ImportPage() {
  return <ImportView />;
}
