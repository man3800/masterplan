"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;

type Project = {
    erp_project_key: string;
    project_name: string;
};

type CategoryS = {
    id: number;
    name: string;
    owner_dept_id: string;
};

type CategoryM = {
    id: number;
    name: string;
    children: CategoryS[];
};

type CategoryL = {
    id: number;
    name: string;
    children: CategoryM[];
};

export default function NewRowPage() {
    const router = useRouter();
    const sp = useSearchParams();

    // ✅ 쿼리에서 프로젝트 키 받기
    const presetProjectKey = useMemo(() => {
        const q = sp.get("erp_project_key");
        return q ? q : "";
    }, [sp]);

    const [projects, setProjects] = useState<Project[]>([]);
    const [categories, setCategories] = useState<CategoryL[]>([]);

    const [projectKey, setProjectKey] = useState("");
    const [catSId, setCatSId] = useState<number | null>(null);
    const [baselineStart, setBaselineStart] = useState("");
    const [baselineEnd, setBaselineEnd] = useState("");
    const [note, setNote] = useState("");

    const [loading, setLoading] = useState(false);
    const [hint, setHint] = useState<string>("");

    // 1) 프로젝트 목록
    useEffect(() => {
        fetch(`${API_BASE}/projects`)
            .then((res) => res.json())
            .then((data: Project[]) => {
                setProjects(data);

                // ✅ preset이 있으면 자동 선택
                if (presetProjectKey) {
                    const exists = data.some((p) => p.erp_project_key === presetProjectKey);
                    if (exists) {
                        setProjectKey(presetProjectKey);
                        setHint(`프로젝트가 자동 선택되었습니다: ${presetProjectKey}`);
                    } else {
                        setHint(`주의: 존재하지 않는 프로젝트 키입니다: ${presetProjectKey}`);
                    }
                }
            })
            .catch((e) => {
                console.error(e);
                setHint("프로젝트 목록을 불러오지 못했습니다.");
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 2) 분류 트리
    useEffect(() => {
        fetch(`${API_BASE}/categories/tree`)
            .then((res) => res.json())
            .then(setCategories)
            .catch((e) => {
                console.error(e);
                setHint("분류 트리를 불러오지 못했습니다.");
            });
    }, []);

    // 3) 저장
    async function handleSubmit() {
        if (!projectKey || !catSId || !baselineStart || !baselineEnd) {
            alert("필수 항목을 모두 입력하세요.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(
                `${API_BASE}/projects/${encodeURIComponent(projectKey)}/items`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-User-Id": "dev", // MVP 임시
                    },
                    body: JSON.stringify({
                        cat_s_id: catSId,
                        baseline_start: baselineStart,
                        baseline_end: baselineEnd,
                        plan_note: note || null,
                    }),
                }
            );

            if (!res.ok) {
                const t = await res.text();
                throw new Error(t);
            }

            router.replace(`/projects/${encodeURIComponent(projectKey)}`);
            router.refresh();
        } catch (e) {
            console.error(e);
            alert("저장 실패");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="p-6">
            <div className="mx-auto max-w-4xl space-y-6">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold">Row 생성</h1>
                        <p className="mt-1 text-sm text-slate-600">
                            프로젝트 선택 → 소분류 선택 → Baseline 입력 → 생성
                        </p>
                    </div>

                    <button
                        onClick={() => router.back()}
                        className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50"
                    >
                        ← 뒤로
                    </button>
                </div>

                {hint && (
                    <div className="rounded-lg border bg-white p-3 text-sm text-slate-700 whitespace-pre-wrap">
                        {hint}
                    </div>
                )}

                {/* 프로젝트 선택 */}
                <div>
                    <label className="block text-sm font-medium mb-1">프로젝트</label>
                    <select
                        className="w-full rounded border px-3 py-2 bg-white"
                        value={projectKey}
                        onChange={(e) => setProjectKey(e.target.value)}
                    >
                        <option value="">프로젝트 선택</option>
                        {projects.map((p) => (
                            <option key={p.erp_project_key} value={p.erp_project_key}>
                                {p.project_name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* 분류 선택 */}
                <div>
                    <div className="text-sm font-medium mb-2">작업 분류 (소분류)</div>
                    <div className="rounded border bg-white p-3 space-y-2 max-h-64 overflow-auto">
                        {categories.map((l) => (
                            <div key={`L-${l.id}`}>
                                <div className="font-semibold">{l.name}</div>

                                {l.children.map((m) => (
                                    <div key={`L-${l.id}-M-${m.id}`} className="ml-4">
                                        <div className="text-sm text-slate-600">{m.name}</div>

                                        <div className="ml-4 space-y-1">
                                            {m.children.map((s) => {
                                                // ✅ 화면상의 고유 key/id는 "경로+소분류id"로 만든다 (중복 방지)
                                                const uiKey = `L${l.id}-M${m.id}-S${s.id}`;
                                                const inputId = `cat_s_${uiKey}`;

                                                return (
                                                    <div key={uiKey} className="flex items-center gap-2">
                                                        <input
                                                            id={inputId}
                                                            type="radio"
                                                            name="cat_s"                // ✅ 그룹은 하나로 유지
                                                            value={s.id}
                                                            checked={catSId === s.id}   // ✅ 실제 선택 값은 소분류 id
                                                            onChange={() => setCatSId(s.id)}
                                                        />
                                                        <label htmlFor={inputId} className="text-sm cursor-pointer">
                                                            {s.name}
                                                            <span className="ml-2 text-xs text-slate-500">
                                                                ({s.owner_dept_id})
                                                            </span>
                                                            <span className="ml-2 text-xs text-slate-400">
                                                                - {l.name} / {m.name}
                                                            </span>
                                                        </label>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                {/* baseline */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Baseline 시작일
                        </label>
                        <input
                            type="date"
                            className="w-full rounded border px-3 py-2 bg-white"
                            value={baselineStart}
                            onChange={(e) => setBaselineStart(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Baseline 종료일
                        </label>
                        <input
                            type="date"
                            className="w-full rounded border px-3 py-2 bg-white"
                            value={baselineEnd}
                            onChange={(e) => setBaselineEnd(e.target.value)}
                        />
                    </div>
                </div>

                {/* 메모 */}
                <div>
                    <label className="block text-sm font-medium mb-1">메모 (선택)</label>
                    <textarea
                        className="w-full rounded border px-3 py-2 bg-white"
                        rows={3}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                    />
                </div>

                {/* 저장 */}
                <div className="flex justify-end gap-2">
                    <button
                        disabled={loading}
                        onClick={() =>
                            router.push(`/projects/${encodeURIComponent(projectKey || presetProjectKey || "")}`)
                        }
                        className="rounded-md border px-5 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                    >
                        프로젝트로
                    </button>

                    <button
                        disabled={loading}
                        onClick={handleSubmit}
                        className="rounded-md bg-blue-600 px-6 py-2 text-sm text-white disabled:opacity-50"
                    >
                        {loading ? "저장 중..." : "Row 생성"}
                    </button>
                </div>
            </div>
        </div>
    );
}
