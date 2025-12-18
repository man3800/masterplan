const BASE = process.env.NEXT_PUBLIC_API_BASE;

if (!BASE) {
    throw new Error("NEXT_PUBLIC_API_BASE is not set. Check frontend/.env.local");
}

export async function apiGet<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function apiPost<T>(path: string, body: any): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": "dev" },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}
