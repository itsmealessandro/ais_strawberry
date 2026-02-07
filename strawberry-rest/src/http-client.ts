type JsonValue = Record<string, unknown> | Array<unknown> | null;

export type HttpResponse = {
  status: number;
  data: JsonValue;
};

export const requestJson = async (url: string, init?: RequestInit): Promise<HttpResponse> => {
  const response = await fetch(url, init);
  const contentType = response.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json") ? await response.json() : null;
  return { status: response.status, data };
};
