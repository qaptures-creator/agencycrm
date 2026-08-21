/** Shared types for the Ashbourne BI connector. Nothing here touches the
 * network — safe to import from anywhere. */

export type AshbourneMember = {
  memberNo: string;
  cardNo?: string;
  firstName?: string;
  surname?: string;
  email?: string;
  mobile?: string;
  clubInfoDate?: Date | null;
  status?: string;
  membershipType?: string;
  expiryDate?: Date | null;
};

export type AshbourneFetchResult = {
  members: AshbourneMember[];
  /** How the data was retrieved — affects how much we trust completeness. */
  method: "export" | "grid-scrape";
  /** Non-secret diagnostics for when something looks wrong (empty result,
   * unexpected columns) — screenshot path/base64 is only ever written to a
   * temp dir the caller controls, never logged with credentials. */
  debug?: {
    reportUrl: string;
    columnsFound?: string[];
    screenshotBase64?: string;
  };
};

export class AshbourneConnectorError extends Error {
  step: string;
  constructor(step: string, message: string) {
    super(message);
    this.name = "AshbourneConnectorError";
    this.step = step;
  }
}
