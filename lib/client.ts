export async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({ error: "The server sent an unreadable reply." }));
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json as T;
}

export async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = await res.json().catch(() => ({ error: "The server sent an unreadable reply." }));
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json as T;
}
