import { Lore } from "@/lore/model";

const getAnalysisStatus = (lore: Lore) => {
  return lore.snapshot.status === "completed"
    ? "Analysis current"
    : "Analysis partial";
};

export default getAnalysisStatus;
