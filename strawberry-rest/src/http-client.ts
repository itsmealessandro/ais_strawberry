// Minimal HTTP helper to fetch JSON responses.
type JsonValue = Record<string, unknown> | Array<unknown> | null;

// Normalized response used by validation helpers.
export type HttpResponse = {
  status: number;
  data: JsonValue;
};

// Perform a request and parse JSON when available.
export const requestJson = async (url: string, init?: RequestInit): Promise<HttpResponse> => {
  const response = await fetch(url, init);
  const contentType = response.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json") ? await response.json() : null;
  return { status: response.status, data };
};
