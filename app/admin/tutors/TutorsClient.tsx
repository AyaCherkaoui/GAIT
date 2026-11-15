"use client";
import { useCallback, useEffect, useState } from "react";
import { btn2Cls, btnCls, Card, Chip, Empty, ErrorBox, inputCls, labelCls, PageHeader, Working } from "@/components/ui";
import { get, post } from "@/lib/client";

type Tutor = { email: string; name: string | null; role: "tutor" | "director"; active: number; added_at: string };

type Req = { id: number; email: string; name: string | null; role: "tutor" | "director" };

export default function TutorsClient({ myEmail }: { myEmail: string }) {
  const [tutors, setTutors] = useState<Tutor[] | null>(null);
  const [requests, setRequests] = useState<Req[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"tutor" | "director">("tutor");

  const load = useCallback(
    () => get<{ tutors: Tutor[]; requests: Req[] }>("/api/admin/tutors").then((j) => { setTutors(j.tutors); setRequests(j.requests); }).catch((e: Error) => { setError(e.message); setTutors([]); }),
    [],
  );
  useEffect(() => { load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEmailError(null);
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return setEmailError("Enter a valid email address.");
    setBusy(true);
    try {
      await post("/api/admin/tutors", { email: value, name, role });
      setEmail("");
      setName("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function answer(id: number, action: "approve" | "decline") {
    setError(null);
    setBusy(true);
    try {
      await post("/api/admin/requests", { id, action });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(target: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/tutors?email=${encodeURIComponent(target)}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({ error: "The server sent an unreadable reply." }));
      if (!res.ok) throw new Error(json.error || "Request failed");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Tutors">Only people on this list can sign in. Deactivating someone ends their access at once.</PageHeader>
      <ErrorBox error={error} />
      {requests.length > 0 && (
        <Card title="Requests" tone="note">
          <ul className="divide-y divide-gold-300/70">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="break-all font-medium text-stone-900">{r.email}</p>
                  <p className="text-sm text-stone-600">{r.name ? `${r.name} · ` : ""}wants to be a {r.role}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className={`${btnCls} min-h-10`} disabled={busy} onClick={() => answer(r.id, "approve")}>Approve</button>
                  <button type="button" className={`${btn2Cls} min-h-10`} disabled={busy} onClick={() => answer(r.id, "decline")}>Decline</button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card title="Add a tutor">
        <form onSubmit={add} noValidate className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="tutor-email" className={labelCls}>Email</label>
            <input id="tutor-email" className={inputCls} type="email" placeholder="name@augustana.edu" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!emailError} />
            {emailError && <p role="alert" className="mt-1 text-sm text-red-800">{emailError}</p>}
          </div>
          <div>
            <label htmlFor="tutor-name" className={labelCls}>Name (optional)</label>
            <input id="tutor-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="tutor-role" className={labelCls}>Role</label>
            <select id="tutor-role" className={inputCls} value={role} onChange={(e) => setRole(e.target.value as "tutor" | "director")}>
              <option value="tutor">Tutor</option>
              <option value="director">Director</option>
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className={`${btnCls} min-h-11 w-full sm:w-auto`} disabled={busy}>Add tutor</button>
          </div>
        </form>
      </Card>
      <Card title="Tutors">
        {tutors === null && <Working label="Loading" />}
        {tutors?.length === 0 && <Empty title="No tutors yet">Add the first one with the form above.</Empty>}
        {!!tutors?.length && (
          <table className="block w-full text-left text-sm sm:table">
            <thead className="hidden border-b border-stone-200 text-stone-600 sm:table-header-group">
              <tr>
                <th className="py-2 pr-4 font-semibold">Email</th>
                <th className="pr-4 font-semibold">Name</th>
                <th className="pr-4 font-semibold">Role</th>
                <th className="pr-4 font-semibold">Status</th>
                <th className="pr-4 font-semibold">Added</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="block divide-y divide-stone-200 sm:table-row-group">
              {tutors.map((t) => (
                <tr key={t.email} className={`flex flex-wrap items-center gap-x-3 gap-y-2 py-3 sm:table-row ${t.active ? "text-stone-900" : "bg-stone-50 text-stone-600"}`}>
                  <td className="w-full break-all font-medium sm:table-cell sm:w-auto sm:py-3 sm:pr-4">{t.email}</td>
                  <td className="sm:table-cell sm:pr-4">{t.name ?? ""}</td>
                  <td className="sm:table-cell sm:pr-4"><Chip tone={t.role === "director" ? "gold" : "plain"}>{t.role === "director" ? "Director" : "Tutor"}</Chip></td>
                  <td className="sm:table-cell sm:pr-4">{t.active ? "Active" : <span className="font-semibold">Inactive</span>}</td>
                  <td className="hidden whitespace-nowrap sm:table-cell sm:pr-4">{t.added_at}</td>
                  <td className="ml-auto sm:table-cell sm:text-right">
                    {!!t.active && t.email !== myEmail && (
                      <button type="button" className={`${btn2Cls} min-h-10`} disabled={busy} onClick={() => deactivate(t.email)}>Deactivate</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
