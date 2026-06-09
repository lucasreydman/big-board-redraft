import { redirect } from "next/navigation";
import { REDRAFT_YEARS } from "@/lib/constants";

export default function RedraftIndex() {
  // Default into the most recent completed class.
  redirect(`/redraft/${REDRAFT_YEARS[REDRAFT_YEARS.length - 1]}`);
}
