import "server-only";

/**
 * Read-only server-side client for the Goodtill / SumUp POS API
 * (https://apidoc.thegoodtill.com). This is the till system Muscle Massacre
 * actually uses at the counter — it is the source of truth for Shake Bar
 * product, stock and sales data.
 *
 * Credentials come from Railway env vars (GOODTILL_SUBDOMAIN,
 * GOODTILL_USERNAME, GOODTILL_PASSWORD, GOODTILL_API_URL) and never reach
 * the browser — every function here must only ever be called from server
 * code (server actions, route handlers, RSCs).
 *
 * Auth flow per the official docs: POST /login returns a JWT valid for 12
 * hours; GET /refresh_token extends it, and refreshing is allowed up to two
 * weeks after the token was created or last refreshed. This client caches
 * the token in memory for the life of the server process and transparently
 * logs in / refreshes as needed — nothing here ever logs the password or
 * the token itself.
 */

const TOKEN_VALID_MS = 12 * 60 * 60 * 1000; // 12h — see CreateToken docs
const TOKEN_REFRESH_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // 2 weeks
const EXPIRY_BUFFER_MS = 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;

export class GoodtillApiError extends Error {
  status?: number;
  endpoint?: string;
  constructor(message: string, options?: { status?: number; endpoint?: string; cause?: unknown }) {
    super(message);
    this.name = "GoodtillApiError";
    this.status = options?.status;
    this.endpoint = options?.endpoint;
    if (options?.cause) this.cause = options.cause;
  }
}

export class GoodtillNotConfiguredError extends GoodtillApiError {
  constructor(missing: string[]) {
    super(`Goodtill integration is not configured — missing env var(s): ${missing.join(", ")}`);
    this.name = "GoodtillNotConfiguredError";
  }
}

type GoodtillEnv = {
  apiUrl: string;
  subdomain: string;
  username: string;
  password: string;
};

function readEnv(): GoodtillEnv {
  const apiUrl = process.env.GOODTILL_API_URL;
  const subdomain = process.env.GOODTILL_SUBDOMAIN;
  const username = process.env.GOODTILL_USERNAME;
  const password = process.env.GOODTILL_PASSWORD;

  const missing: string[] = [];
  if (!apiUrl) missing.push("GOODTILL_API_URL");
  if (!subdomain) missing.push("GOODTILL_SUBDOMAIN");
  if (!username) missing.push("GOODTILL_USERNAME");
  if (!password) missing.push("GOODTILL_PASSWORD");
  if (missing.length > 0) throw new GoodtillNotConfiguredError(missing);

  // The official base URL is https://api.thegoodtill.com/api — normalize in
  // case the configured value omits the /api path segment.
  let normalizedApiUrl = apiUrl!.replace(/\/+$/, "");
  if (!/\/api$/i.test(normalizedApiUrl)) normalizedApiUrl += "/api";

  return { apiUrl: normalizedApiUrl, subdomain: subdomain!, username: username!, password: password! };
}

type TokenCache = {
  token: string;
  outletId: string | null;
  validUntil: number;
  refreshUntil: number;
};

// Module-scoped, in-memory only — never persisted, never logged.
let tokenCache: TokenCache | null = null;
// Collapses concurrent callers onto a single in-flight login/refresh.
let inFlight: Promise<TokenCache> | null = null;

type LoginResponse = {
  user_id: string;
  user_name: string;
  user_level: string;
  token: string;
  client_id: string;
  client_name: string;
  client_subdomain: string;
  current_outlet_id: string | null;
  current_outlet_name: string | null;
};

type RefreshResponse = {
  success: string;
  token: string;
  message: string;
};

async function login(env: GoodtillEnv): Promise<TokenCache> {
  const res = await rawFetch(env, "/login", {
    method: "POST",
    body: JSON.stringify({ subdomain: env.subdomain, username: env.username, password: env.password }),
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    throw new GoodtillApiError(await safeErrorMessage(res, "Goodtill login failed"), {
      status: res.status,
      endpoint: "/login",
    });
  }

  const data = (await res.json()) as LoginResponse;
  if (!data.token) {
    throw new GoodtillApiError("Goodtill login response did not include a token", { endpoint: "/login" });
  }
  if (data.user_level === "operator") {
    throw new GoodtillApiError(
      "Goodtill API credentials belong to an 'operator' user — only store_owner/admin accounts can use the API",
      { endpoint: "/login" }
    );
  }

  const now = Date.now();
  return {
    token: data.token,
    outletId: data.current_outlet_id,
    validUntil: now + TOKEN_VALID_MS,
    refreshUntil: now + TOKEN_REFRESH_WINDOW_MS,
  };
}

async function refresh(env: GoodtillEnv, current: TokenCache): Promise<TokenCache> {
  const res = await rawFetch(env, "/refresh_token", {
    method: "GET",
    headers: { Authorization: `Bearer ${current.token}` },
  });

  if (!res.ok) {
    // Refresh can legitimately fail (token past its 2-week refresh window,
    // revoked, etc.) — caller falls back to a fresh login.
    throw new GoodtillApiError(await safeErrorMessage(res, "Goodtill token refresh failed"), {
      status: res.status,
      endpoint: "/refresh_token",
    });
  }

  const data = (await res.json()) as RefreshResponse;
  if (!data.token) {
    throw new GoodtillApiError("Goodtill refresh response did not include a token", { endpoint: "/refresh_token" });
  }

  const now = Date.now();
  return {
    token: data.token,
    outletId: current.outletId,
    validUntil: now + TOKEN_VALID_MS,
    refreshUntil: now + TOKEN_REFRESH_WINDOW_MS,
  };
}

/** Returns a valid token, logging in or refreshing as needed. Concurrent
 * callers share a single in-flight login/refresh instead of racing. */
async function getValidToken(): Promise<TokenCache> {
  if (inFlight) return inFlight;

  const now = Date.now();
  if (tokenCache && now < tokenCache.validUntil - EXPIRY_BUFFER_MS) {
    return tokenCache;
  }

  const env = readEnv();

  inFlight = (async () => {
    try {
      if (tokenCache && now < tokenCache.refreshUntil - EXPIRY_BUFFER_MS) {
        try {
          const refreshed = await refresh(env, tokenCache);
          tokenCache = refreshed;
          return refreshed;
        } catch {
          // Fall through to a fresh login below.
        }
      }
      const fresh = await login(env);
      tokenCache = fresh;
      return fresh;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

async function rawFetch(env: GoodtillEnv, path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${env.apiUrl}${path}`, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new GoodtillApiError(`Goodtill request to ${path} timed out after ${REQUEST_TIMEOUT_MS}ms`, { endpoint: path });
    }
    throw new GoodtillApiError(`Goodtill request to ${path} failed: network error`, { endpoint: path, cause: err });
  } finally {
    clearTimeout(timeout);
  }
}

/** Reads a best-effort error message from a failed response without ever
 * assuming (or logging) the body contains anything sensitive beyond what
 * the API itself chose to return. */
async function safeErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const text = await res.text();
    try {
      const json = JSON.parse(text) as { message?: string; error?: string };
      const msg = json.message || json.error;
      if (msg) return `${fallback}: ${msg} (HTTP ${res.status})`;
    } catch {
      // Not JSON — fall through.
    }
    return `${fallback}: HTTP ${res.status}`;
  } catch {
    return `${fallback}: HTTP ${res.status}`;
  }
}

type FetchOptions = {
  method?: "GET" | "POST";
  query?: Record<string, string | number | boolean | string[] | undefined>;
  outletId?: string;
};

/** Authenticated GET/POST against the Goodtill API. Retries once on a 401
 * by forcing a fresh login, in case the cached token was revoked out of
 * band (e.g. user logged out all sessions in the Goodtill backoffice). */
async function goodtillFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const env = readEnv();
  let cache = await getValidToken();

  const doRequest = async (): Promise<Response> => {
    const query = options.query
      ? "?" +
        Object.entries(options.query)
          .filter(([, v]) => v !== undefined)
          .flatMap(([k, v]) => (Array.isArray(v) ? v.map((item) => [k, item] as const) : [[k, v as string | number | boolean] as const]))
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join("&")
      : "";

    const headers: Record<string, string> = { Authorization: `Bearer ${cache.token}` };
    const outletId = options.outletId ?? cache.outletId;
    if (outletId) headers["Outlet-Id"] = outletId;

    return rawFetch(env, `${path}${query}`, { method: options.method ?? "GET", headers });
  };

  let res = await doRequest();

  if (res.status === 401) {
    tokenCache = null;
    cache = await getValidToken();
    res = await doRequest();
  }

  if (!res.ok) {
    throw new GoodtillApiError(await safeErrorMessage(res, `Goodtill request to ${path} failed`), {
      status: res.status,
      endpoint: path,
    });
  }

  const data = (await res.json()) as { status?: boolean; data?: T; message?: string };
  if (data.status === false) {
    throw new GoodtillApiError(`Goodtill request to ${path} returned an error: ${data.message ?? "unknown error"}`, {
      endpoint: path,
    });
  }
  return (data.data ?? (data as unknown as T)) as T;
}

// ---------------------------------------------------------------------------
// Types — only fields documented at https://apidoc.thegoodtill.com are
// modelled. Unknown/undocumented fields the API may also send are preserved
// via the index signature rather than dropped, but nothing here is invented.
// ---------------------------------------------------------------------------

export type GoodtillCategory = {
  id: string;
  name: string;
  description: string | null;
  parent_category_id: string | null;
  account_code: string | null;
  active: number;
  status: number;
};

export type GoodtillProduct = {
  id: string;
  outlet_id: string;
  category_id: string | null;
  brand_id: string | null;
  supplier_id: string | null;
  product_name: string;
  product_sku: string | null;
  display_name: string | null;
  purchase_price: string;
  selling_price: string;
  has_variant: number;
  track_inventory: number;
  inventory: string;
  min_stock: string;
  alert_on: number;
  alert_below: string;
  active: number;
  [key: string]: unknown;
};

export type GoodtillInventoryItem = {
  inventory_id: string;
  category_id: string | null;
  supplier_id: string | null;
  brand_id: string | null;
  inventory: string;
  selling_price: string;
  purchase_price: string;
  product_name: string;
  stock_value: string;
  retail_value: string;
};

export type GoodtillOutlet = {
  id: string;
  outlet_name: string;
  outlet_address: string | null;
  outlet_city: string | null;
  outlet_county: string | null;
  outlet_postcode: string | null;
  outlet_country: string | null;
  store_tag: string | null;
  status: string;
  active: number;
};

export type GoodtillSaleItem = {
  product_name: string;
  product_sku: string | null;
  quantity: number;
  product_id: string | null;
  total_inc_vat: number;
  vat: number;
};

export type GoodtillSale = {
  sales_id: string;
  outlet_id: string;
  outlet_name: string;
  customer_id: string | null;
  customer_email: string | null;
  sale_date_time: string;
  total_inc_vat: number;
  vat: number;
  items: GoodtillSaleItem[];
};

// ---------------------------------------------------------------------------
// Public read-only API
// ---------------------------------------------------------------------------

export async function getGoodtillCategories(): Promise<GoodtillCategory[]> {
  return goodtillFetch<GoodtillCategory[]>("/categories");
}

export async function getGoodtillProducts(): Promise<GoodtillProduct[]> {
  return goodtillFetch<GoodtillProduct[]>("/products");
}

export async function getGoodtillProductInventory(): Promise<GoodtillInventoryItem[]> {
  return goodtillFetch<GoodtillInventoryItem[]>("/products/inventory");
}

export async function getGoodtillOutlets(): Promise<GoodtillOutlet[]> {
  return goodtillFetch<GoodtillOutlet[]>("/outlets");
}

function formatGoodtillDateTime(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export async function getGoodtillSales(params: {
  from?: Date;
  to?: Date;
  includeVoided?: boolean;
  outletIds?: string[];
} = {}): Promise<GoodtillSale[]> {
  return goodtillFetch<GoodtillSale[]>("/external/get_sales", {
    query: {
      from: params.from ? formatGoodtillDateTime(params.from) : undefined,
      to: params.to ? formatGoodtillDateTime(params.to) : undefined,
      timezone: "utc",
      include_voided: params.includeVoided ? 1 : 0,
      outlet_ids: params.outletIds,
    },
  });
}

/** Non-secret diagnostic info to help debug misconfiguration: the exact
 * URL that would be called and a length/preview of the subdomain, but
 * never the username or password. */
export function getGoodtillDiagnosticEnvSummary():
  | { configured: true; attemptedLoginUrl: string; subdomainPreview: string }
  | { configured: false; error: string } {
  try {
    const env = readEnv();
    const subdomainPreview =
      env.subdomain.length > 4 ? `${env.subdomain.slice(0, 2)}***${env.subdomain.slice(-2)}` : "***";
    return { configured: true, attemptedLoginUrl: `${env.apiUrl}/login`, subdomainPreview };
  } catch (err) {
    return { configured: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/** Logs in (or reuses the cached token) and confirms the connection is
 * live. Returns a redacted summary only — never the token itself. */
export async function testGoodtillConnection(): Promise<
  | { ok: true; clientName: string; subdomain: string; outletName: string | null; userLevel: string; tokenValidUntil: string }
  | { ok: false; error: string }
> {
  try {
    const env = readEnv();
    tokenCache = null; // force a fresh login so this genuinely exercises auth
    const res = await rawFetch(env, "/login", {
      method: "POST",
      body: JSON.stringify({ subdomain: env.subdomain, username: env.username, password: env.password }),
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      return { ok: false, error: await safeErrorMessage(res, "Login failed") };
    }
    const data = (await res.json()) as LoginResponse;
    const now = Date.now();
    tokenCache = { token: data.token, outletId: data.current_outlet_id, validUntil: now + TOKEN_VALID_MS, refreshUntil: now + TOKEN_REFRESH_WINDOW_MS };
    return {
      ok: true,
      clientName: data.client_name,
      subdomain: data.client_subdomain,
      outletName: data.current_outlet_name,
      userLevel: data.user_level,
      tokenValidUntil: new Date(now + TOKEN_VALID_MS).toISOString(),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
