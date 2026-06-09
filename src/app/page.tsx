import { redirect } from "next/navigation";
import { REDRAFT_YEARS } from "@/lib/constants";

export default function Home() {
  // Default into the most recent completed class.
  redirect(`/redraft/${REDRAFT_YEARS[REDRAFT_YEARS.length - 1]}`);
}
