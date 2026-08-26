/**
 * Safe fetch helper that guards against HTML responses (e.g. Netlify 404 / SPA redirect)
 * and formats clear errors rather than crashing with "Unexpected token <".
 */

export async function safeFetchJson<T = any>(url: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, options);
  } catch (netErr: any) {
    throw new Error(`Network request failed: ${netErr?.message || 'Check your internet connection'}`);
  }

  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();

  if (!text || text.trim().length === 0) {
    if (!res.ok) {
      throw new Error(`Server returned HTTP status ${res.status}`);
    }
    return {} as T;
  }

  // Check if response is HTML instead of JSON
  const trimmed = text.trim();
  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html") || contentType.includes("text/html")) {
    if (res.status === 404 || res.status === 200) {
      throw new Error(
        `Backend API endpoint (${url}) returned HTML instead of JSON. When running on Netlify, please ensure Netlify Functions are active and environment variables (e.g. GEMINI_API_KEY, GEOAPIFY_API_KEY) are set in the Netlify Dashboard.`
      );
    }
    throw new Error(`Server returned HTML error (${res.status}): ${trimmed.slice(0, 120)}...`);
  }

  try {
    const data = JSON.parse(text);
    if (!res.ok) {
      const errMsg = data.error || data.message || `Server error (${res.status})`;
      throw new Error(errMsg);
    }
    return data as T;
  } catch (parseErr: any) {
    if (parseErr.message && !parseErr.message.includes("JSON")) {
      throw parseErr;
    }
    throw new Error(`Invalid JSON returned from ${url}: ${text.slice(0, 100)}`);
  }
}
