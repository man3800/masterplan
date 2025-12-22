"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

    const [projects, setProjects] = useState<Project[]>([]);
    const [categories, setCategories] = useState<CategoryL[]>([]);

    const [projectKey, setProjectKey] = useState("");
    const [catSId, setCatSId] = useState<number | null>(null);
    const [baselineStart, setBaselineStart] = useState("");
    const [baselineEnd, setBaselineEnd] = useState("");
    const [note, setNote] = useState("");

    const [loading, setLoading] = useState(false);

    // 1) 프로젝트 목록
    useEffect(() => {
        fetch(`${API_BASE}/projects`)
            .then((res) => res.json())
            .then(setProjects)
            .catch(console.error);
    }, []);

    // 2) 분류 트리 (프로젝트별)
    useEffect(() => {
        if (!projectKey) {
            setCategories([]);
            return;
        }
        fetch(`${API_BASE}/projects/${encodeURIComponent(projectKey)}/classifications/tree`)
            .then((res) => res.json())
            .then(setCategories)
            .catch(console.error);
    }, [projectKey]);

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
                        "X-User-Id": "dev", // MVP용 임시
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

            router.push(`/projects/${encodeURIComponent(projectKey)}`);
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
                <h1 className="text-2xl font-bold">Row 생성</h1>

                {/* 프로젝트 선택 */}
                <div>
                    <label className="block text-sm font-medium mb-1">프로젝트</label>
                    <select
                        className="w-full rounded border px-3 py-2"
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
                    <div className="rounded border p-3 space-y-2 max-h-64 overflow-auto">
                        {categories.map((l) => (
                            <div key={l.id}>
                                <div className="font-semibold">{l.name}</div>
                                {l.children.map((m) => (
                                    <div key={m.id} className="ml-4">
                                        <div className="text-sm text-slate-600">{m.name}</div>
                                        <div className="ml-4 space-y-1">
                                            {m.children.map((s) => (
                                                <label
                                                    key={s.id}
                                                    className="flex items-center gap-2 text-sm cursor-pointer"
                                                >
                                                    <input
                                                        type="radio"
                                                        name="cat_s"
                                                        checked={catSId === s.id}
                                                        onChange={() => setCatSId(s.id)}
                                                    />
                                                    {s.name}
                                                </label>
                                            ))}
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
                            className="w-full rounded border px-3 py-2"
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
                            className="w-full rounded border px-3 py-2"
                            value={baselineEnd}
                            onChange={(e) => setBaselineEnd(e.target.value)}
                        />
                    </div>
                </div>

                {/* 메모 */}
                <div>
                    <label className="block text-sm font-medium mb-1">메모 (선택)</label>
                    <textarea
                        className="w-full rounded border px-3 py-2"
                        rows={3}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                    />
                </div>

                {/* 저장 */}
                <button
                    type="button"
                    disabled={loading}
                    onClick={() => {
                        console.log("SUBMIT payload", { projectKey, catSId, baselineStart, baselineEnd, note });

                        if (!projectKey || !catSId || !baselineStart || !baselineEnd) {
                            alert("필수값 누락: 프로젝트/소분류/시작일/종료일을 모두 입력해야 합니다.");
                            return;
                        }

                        handleSubmit();
                    }}
                    className="rounded-md bg-blue-600 px-6 py-2 text-sm text-white disabled:opacity-50"
                >
                    {loading ? "저장 중..." : "Row 생성"}
                </button>
            </div>
        </div>
    );
}
