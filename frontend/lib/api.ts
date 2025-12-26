const BASE = process.env.NEXT_PUBLIC_API_BASE;

if (!BASE) {
    throw new Error("NEXT_PUBLIC_API_BASE is not set. Check frontend/.env.local");
}

export async function apiGet<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function apiPost<T>(path: string, body: any, method: string = "POST"): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        method: method,
        headers: { "Content-Type": "application/json", "X-User-Id": "dev" },
        body: method !== "DELETE" ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
        const errorText = await res.text();
        // FastAPI 에러 응답 파싱 시도
        try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.detail) {
                throw new Error(JSON.stringify({ detail: errorJson.detail }));
            }
        } catch {
            // JSON 파싱 실패 시 원본 텍스트 사용
        }
        throw new Error(errorText || `HTTP ${res.status}`);
    }
    if (res.status === 204) {
        return null as T; // No content
    }
    return res.json();
}
