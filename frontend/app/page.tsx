"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";

type Project = {
    erp_project_key: string;
    project_name: string;
    machine_type_name: string | null;
    baseline_due_date: string | null;
    current_due_date: string | null;
};

type CatS = { id: number; name: string; owner_dept_id: string };
type CatM = { id: number; name: string; children: CatS[] };
type CatL = { id: number; name: string; children: CatM[] };

type ItemRow = {
    item_id: number;
    erp_project_key: string;
    cat_s_id: number;
    cat_s_name: string;
    owner_dept_id: string;
    baseline_start: string | null;
    baseline_end: string | null;
    current_start: string | null;
    current_end: string | null;
    due_end_basis: string | null;
    plan_shift: string | null;
    actual_start_date: string | null;
    actual_end_date: string | null;
    is_progress_delayed: boolean;
};

export default function Page() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [tree, setTree] = useState<CatL[]>([]);
    const [items, setItems] = useState<ItemRow[]>([]);

    const [selectedProject, setSelectedProject] = useState<string>("");

    // 대/중/소 선택
    const [selectedCatL, setSelectedCatL] = useState<number | "">("");
    const [selectedCatM, setSelectedCatM] = useState<number | "">("");
    const [selectedCatS, setSelectedCatS] = useState<number | "">("");

    // baseline 날짜
    const [baselineStart, setBaselineStart] = useState<string>("");
    const [baselineEnd, setBaselineEnd] = useState<string>("");

    const [err, setErr] = useState<string>("");

    async function refreshItems(projectKey: string) {
        const encoded = encodeURIComponent(projectKey);
        const rows = await apiGet<ItemRow[]>(`/projects/${encoded}/items`);
        setItems(rows);
    }

    // 초기 로딩: 프로젝트 + 카테고리 트리
    useEffect(() => {
        (async () => {
            try {
                setErr("");
                const [p, t] = await Promise.all([
                    apiGet<Project[]>("/projects"),
                    apiGet<CatL[]>("/categories/tree"),
                ]);
                setProjects(p);
                setTree(t);

                if (p.length > 0) setSelectedProject(p[0].erp_project_key);
            } catch (e: any) {
                setErr(e?.message ?? String(e));
            }
        })();
    }, []);

    // 프로젝트 변경 시 items 갱신
    useEffect(() => {
        if (!selectedProject) return;
        refreshItems(selectedProject).catch((e) => setErr(e?.message ?? String(e)));
    }, [selectedProject]);

    // 대분류 바뀌면 중/소 초기화
    useEffect(() => {
        setSelectedCatM("");
        setSelectedCatS("");
    }, [selectedCatL]);

    // 중분류 바뀌면 소 초기화
    useEffect(() => {
        setSelectedCatS("");
    }, [selectedCatM]);

    // 옵션 계산
    const catMOptions = useMemo<CatM[]>(() => {
        if (selectedCatL === "") return [];
        const l = tree.find((x) => x.id === selectedCatL);
        return l?.children ?? [];
    }, [tree, selectedCatL]);

    const catSOptions = useMemo<CatS[]>(() => {
        if (selectedCatM === "") return [];
        const m = catMOptions.find((x) => x.id === selectedCatM);
        return m?.children ?? [];
    }, [catMOptions, selectedCatM]);

    async function onCreateRow() {
        try {
            setErr("");

            if (!selectedProject) throw new Error("프로젝트를 선택하세요.");
            if (selectedCatL === "") throw new Error("대분류를 선택하세요.");
            if (selectedCatM === "") throw new Error("중분류를 선택하세요.");
            if (selectedCatS === "") throw new Error("소분류를 선택하세요.");
            if (!baselineStart || !baselineEnd)
                throw new Error("Baseline 시작/종료일을 입력하세요.");

            const encoded = encodeURIComponent(selectedProject);

            await apiPost(`/projects/${encoded}/items`, {
                cat_s_id: selectedCatS,
                baseline_start: baselineStart,
                baseline_end: baselineEnd,
                plan_note: null,
            });

            await refreshItems(selectedProject);

            // UX: Row 추가 후 소분류만 초기화(대/중 유지)
            setSelectedCatS("");
        } catch (e: any) {
            setErr(e?.message ?? String(e));
        }
    }

    const selectedProjectObj = useMemo(
        () => projects.find((p) => p.erp_project_key === selectedProject),
        [projects, selectedProject]
    );

    return (
        <div className="min-h-screen p-6">
            <div className="mx-auto max-w-6xl space-y-6">
                <header className="space-y-1">
                    <h1 className="text-2xl font-bold">MasterPlan MVP</h1>
                    <p className="text-sm text-slate-600">
                        프로젝트 선택 → 대/중/소 선택 → Baseline 입력 → Row 생성
                    </p>
                </header>

                {err && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 whitespace-pre-wrap">
                        {err}
                    </div>
                )}

                <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {/* 프로젝트 */}
                    <div className="space-y-2 rounded-xl border p-4">
                        <div className="text-sm font-semibold">프로젝트</div>

                        <select
                            className="w-full rounded-lg border p-2"
                            value={selectedProject}
                            onChange={(e) => setSelectedProject(e.target.value)}
                        >
                            {projects.map((p) => (
                                <option key={p.erp_project_key} value={p.erp_project_key}>
                                    {p.project_name} ({p.machine_type_name ?? "-"})
                                </option>
                            ))}
                        </select>

                        <div className="text-xs text-slate-600">
                            baseline due: {selectedProjectObj?.baseline_due_date ?? "-"}
                        </div>
                    </div>

                    {/* 분류 + baseline */}
                    <div className="space-y-3 rounded-xl border p-4">
                        <div className="text-sm font-semibold">분류 선택 (대/중/소)</div>

                        {/* 대분류 */}
                        <select
                            className="w-full rounded-lg border p-2"
                            value={selectedCatL}
                            onChange={(e) =>
                                setSelectedCatL(e.target.value ? Number(e.target.value) : "")
                            }
                        >
                            <option value="">대분류 선택</option>
                            {tree.map((l) => (
                                <option key={l.id} value={l.id}>
                                    {l.name}
                                </option>
                            ))}
                        </select>

                        {/* 중분류 */}
                        <select
                            className="w-full rounded-lg border p-2"
                            value={selectedCatM}
                            onChange={(e) =>
                                setSelectedCatM(e.target.value ? Number(e.target.value) : "")
                            }
                            disabled={selectedCatL === ""}
                        >
                            <option value="">중분류 선택</option>
                            {catMOptions.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {m.name}
                                </option>
                            ))}
                        </select>

                        {/* 소분류 */}
                        <select
                            className="w-full rounded-lg border p-2"
                            value={selectedCatS}
                            onChange={(e) =>
                                setSelectedCatS(e.target.value ? Number(e.target.value) : "")
                            }
                            disabled={selectedCatM === ""}
                        >
                            <option value="">소분류 선택</option>
                            {catSOptions.map((s) => (
                                <option key={s.id} value={s.id}>
                                    #{s.id} {s.name} ({s.owner_dept_id})
                                </option>
                            ))}
                        </select>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                            <div>
                                <div className="mb-1 text-xs text-slate-600">Baseline 시작</div>
                                <input
                                    type="date"
                                    className="w-full rounded-lg border p-2"
                                    value={baselineStart}
                                    onChange={(e) => setBaselineStart(e.target.value)}
                                />
                            </div>
                            <div>
                                <div className="mb-1 text-xs text-slate-600">Baseline 종료</div>
                                <input
                                    type="date"
                                    className="w-full rounded-lg border p-2"
                                    value={baselineEnd}
                                    onChange={(e) => setBaselineEnd(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            onClick={onCreateRow}
                            className="w-full rounded-lg bg-black p-2 text-white hover:opacity-90"
                        >
                            Row 생성
                        </button>
                    </div>

                    {/* 요약 */}
                    <div className="space-y-2 rounded-xl border p-4">
                        <div className="text-sm font-semibold">Row 요약</div>
                        <div className="text-xs text-slate-600">총 {items.length}건</div>
                        <div className="text-xs text-slate-600">
                            선택:{" "}
                            {selectedCatL === ""
                                ? "-"
                                : `${selectedCatL} / ${selectedCatM || "-"} / ${selectedCatS || "-"}`}
                        </div>
                    </div>
                </section>

                {/* 테이블 */}
                <section className="rounded-xl border">
                    <div className="border-b p-4 text-sm font-semibold">프로젝트 Row</div>
                    <div className="overflow-x-auto p-4">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="text-left text-slate-600">
                                    <th className="py-2 pr-4">ID</th>
                                    <th className="py-2 pr-4">소분류</th>
                                    <th className="py-2 pr-4">담당</th>
                                    <th className="py-2 pr-4">Baseline</th>
                                    <th className="py-2 pr-4">Actual</th>
                                    <th className="py-2 pr-4">지연</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((it) => (
                                    <tr key={it.item_id} className="border-t">
                                        <td className="py-2 pr-4">{it.item_id}</td>
                                        <td className="py-2 pr-4">{it.cat_s_name}</td>
                                        <td className="py-2 pr-4">{it.owner_dept_id}</td>
                                        <td className="py-2 pr-4">
                                            {it.baseline_start ?? "-"} ~ {it.baseline_end ?? "-"}
                                        </td>
                                        <td className="py-2 pr-4">
                                            {it.actual_start_date ?? "-"} ~ {it.actual_end_date ?? "-"}
                                        </td>
                                        <td className="py-2 pr-4">
                                            {it.is_progress_delayed ? "Y" : "-"}
                                        </td>
                                    </tr>
                                ))}
                                {items.length === 0 && (
                                    <tr>
                                        <td className="py-6 text-slate-500" colSpan={6}>
                                            Row가 없습니다. 대/중/소를 선택하고 Row를 생성해보세요.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </div>
    );
}
