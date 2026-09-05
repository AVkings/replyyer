export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-api-key, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export function withCors(res: Response) {
  const headers = corsHeaders();
  Object.entries(headers).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}
