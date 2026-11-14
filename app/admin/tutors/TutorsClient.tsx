"use client";
import { useCallback, useEffect, useState } from "react";
import { btn2Cls, btnCls, Card, ErrorBox, inputCls, PageHeader, Working } from "@/components/ui";
import { get, post } from "@/lib/client";

type Tutor = { email: string; name: string | null; role: "tutor" | "director"; active: number; added_at: string };

export default function TutorsClient({ myEmail }: { myEmail: string }) {
  const [tutors, setTutors] = useState<Tutor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"tutor" | "director">("tutor");

  const load = useCallback(
    () => get<{ tutors: Tutor[] }>("/api/admin/tutors").then((j) => setTutors(j.tutors)).catch((e: Error) => { setError(e.message); setTutors([]); }),
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
      <Card title="Add a tutor">
        <form onSubmit={add} noValidate className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-start">
          <div>
            <input className={inputCls} type="email" placeholder="Email" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            {emailError && <p role="alert" className="mt-1 text-sm text-red-700">{emailError}</p>}
          </div>
          <input className={inputCls} placeholder="Name (optional)" aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <select className={inputCls} aria-label="Role" value={role} onChange={(e) => setRole(e.target.value as "tutor" | "director")}>
            <option value="tutor">Tutor</option>
            <option value="director">Director</option>
          </select>
          <button type="submit" className={btnCls} disabled={busy}>Add</button>
        </form>
      </Card>
      <Card title="Tutors">
        {tutors === null && <Working label="Loading" />}
        {tutors?.length === 0 && <p className="text-sm text-stone-500">No tutors yet — add the first one above.</p>}
        {!!tutors?.length && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-stone-500">
                <tr><th className="py-2 pr-4">Email</th><th className="pr-4">Name</th><th className="pr-4">Role</th><th className="pr-4">Active</th><th className="pr-4">Added</th><th /></tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {tutors.map((t) => (
                  <tr key={t.email}>
                    <td className="py-2 pr-4">{t.email}</td>
                    <td className="pr-4">{t.name ?? ""}</td>
                    <td className="pr-4">{t.role}</td>
                    <td className="pr-4">{t.active ? "Yes" : "No"}</td>
                    <td className="pr-4 whitespace-nowrap">{t.added_at}</td>
                    <td className="text-right">
                      {!!t.active && t.email !== myEmail && (
                        <button type="button" className={btn2Cls} disabled={busy} onClick={() => deactivate(t.email)}>Deactivate</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
