const COMBINING_MARKS = new RegExp("[̀-ͯ]", "g");

/** "Southall Car Care Centre" -> "Southall-Car-Care-Centre-Proposal.pdf" */
export function proposalPdfFilename(companyName: string): string {
  const slug = companyName
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join("-");
  return `${slug || "Proposal"}-Proposal.pdf`;
}
