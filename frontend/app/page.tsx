"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";

type StatusCount = {
    status_id: number;
    status_code: string;
    status_name: string;
    display_order: number;
    count: number;
};

type DashboardProject = {
    erp_project_key: string;
    project_name: string;
    machine_type_code: string | null;
    machine_type_name: string | null;
    status_id: number | null;
    status_name: string | null;
    baseline_due_date: string | null;
    current_due_date: string | null;
    progress_pct: number;
};

function fmtDate(d: string | null) {
    return d ?? "-";
}

export default function Page() {
    const [statusCounts, setStatusCounts] = useState<StatusCount[]>([]);
    const [projects, setProjects] = useState<DashboardProject[]>([]);
    const [selectedStatusId, setSelectedStatusId] = useState<number | null>(null);

    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string>("");

    async function load(statusId: number | null) {
        setLoading(true);
        setErr("");
        try {
            const [sc, pr] = await Promise.all([
                apiGet<StatusCount[]>("/dashboard/status-counts"),
                apiGet<DashboardProject[]>(
                    statusId ? `/dashboard/projects?status_id=${statusId}` : "/dashboard/projects"
                ),
            ]);
            
            // 기본값 맵 생성 (0으로 초기화)
            const defaultStatusMap: Record<string, StatusCount> = {
                pending: {
                    status_id: 1,
                    status_code: "pending",
                    status_name: "대기",
                    display_order: 1,
                    count: 0,
                },
                in_progress: {
                    status_id: 2,
                    status_code: "in_progress",
                    status_name: "진행",
                    display_order: 2,
                    count: 0,
                },
                paused: {
                    status_id: 3,
                    status_code: "paused",
                    status_name: "중지",
                    display_order: 3,
                    count: 0,
                },
                done: {
                    status_id: 4,
                    status_code: "done",
                    status_name: "완료",
                    display_order: 4,
                    count: 0,
                },
            };
            
            // 서버 응답과 합치기
            sc.forEach((item) => {
                if (item.status_code in defaultStatusMap) {
                    // 서버 응답의 status_name을 사용하되, "중단"을 "중지"로 통일
                    const statusName = item.status_name === "중단" ? "중지" : item.status_name;
                    defaultStatusMap[item.status_code] = {
                        ...item,
                        status_name: statusName,
                    };
                }
            });
            
            // 표시 순서대로 정렬: 전체 → 대기 → 진행 → 중지 → 완료
            const orderedCounts = [
                defaultStatusMap.pending,
                defaultStatusMap.in_progress,
                defaultStatusMap.paused,
                defaultStatusMap.done,
            ];
            
            setStatusCounts(orderedCounts);
            setProjects(pr);
        } catch (e: any) {
            setErr(e?.message ?? String(e));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load(selectedStatusId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedStatusId]);

    const totalProjects = useMemo(
        () => statusCounts.reduce((a, b) => a + (b.count ?? 0), 0),
        [statusCounts]
    );

    return (
        <div className="min-h-screen p-6">
            <div className="mx-auto max-w-6xl space-y-5">
                <header className="space-y-1">
                    <h1 className="text-2xl font-bold">대시보드</h1>
                    <p className="text-sm text-slate-600">
                        프로젝트 현황 요약 · 상태별 필터 · 진행률(단순)
                    </p>
                </header>

                {err && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 whitespace-pre-wrap">
                        {err}
                    </div>
                )}

                {/* 상단 Status Bar */}
                <section className="rounded-xl border p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold">프로젝트 상태</div>
                        <div className="text-xs text-slate-600">총 {totalProjects}건</div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setSelectedStatusId(null)}
                            className={[
                                "rounded-full border px-3 py-1 text-sm",
                                selectedStatusId === null ? "bg-black text-white" : "bg-white hover:bg-slate-50",
                            ].join(" ")}
                            title="전체 보기"
                        >
                            전체 <span className="ml-1 text-xs opacity-80">{totalProjects}</span>
                        </button>

                        {statusCounts.map((s) => {
                            const active = selectedStatusId === s.status_id;
                            return (
                                <button
                                    key={s.status_id}
                                    onClick={() => setSelectedStatusId(s.status_id)}
                                    className={[
                                        "rounded-full border px-3 py-1 text-sm",
                                        active ? "bg-black text-white" : "bg-white hover:bg-slate-50",
                                    ].join(" ")}
                                    title={`${s.status_code}`}
                                >
                                    {s.status_name}
                                    <span className="ml-1 text-xs opacity-80">{s.count}</span>
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* 프로젝트 테이블 */}
                <section className="rounded-xl border">
                    <div className="border-b p-4 flex items-center justify-between">
                        <div className="text-sm font-semibold">프로젝트 리스트</div>
                        <div className="text-xs text-slate-600">
                            {loading ? "로딩 중..." : `${projects.length}건`}
                        </div>
                    </div>

                    <div className="overflow-x-auto p-4">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="text-left text-slate-600">
                                    <th className="py-2 pr-4">프로젝트</th>
                                    <th className="py-2 pr-4">모델</th>
                                    <th className="py-2 pr-4">상태</th>
                                    <th className="py-2 pr-4">기준 납기</th>
                                    <th className="py-2 pr-4">변경 납기</th>
                                    <th className="py-2 pr-4">진행률</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!loading &&
                                    projects.map((p) => (
                                        <tr key={p.erp_project_key} className="border-t">
                                            <td className="py-2 pr-4">
                                                <a
                                                    href={`/projects/${encodeURIComponent(p.erp_project_key)}`}
                                                    className="group inline-block"
                                                    title="프로젝트 상세로 이동"
                                                >
                                                    <div className="font-semibold text-slate-900 group-hover:underline">
                                                        {p.project_name}
                                                    </div>
                                                    <div className="text-xs text-slate-500 group-hover:text-slate-700">
                                                        {p.erp_project_key}
                                                    </div>
                                                </a>
                                            </td>

                                            <td className="py-2 pr-4">
                                                {p.machine_type_name ?? "-"}
                                                <div className="text-xs text-slate-500">
                                                    {p.machine_type_code ?? ""}
                                                </div>
                                            </td>

                                            <td className="py-2 pr-4">
                                                <span className="rounded-full border px-2 py-0.5 text-xs">
                                                    {p.status_name ?? "미지정"}
                                                </span>
                                            </td>

                                            <td className="py-2 pr-4">{fmtDate(p.baseline_due_date)}</td>
                                            <td className="py-2 pr-4">{fmtDate(p.current_due_date)}</td>

                                            <td className="py-2 pr-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-36 rounded-full bg-slate-100 h-2 overflow-hidden">
                                                        <div
                                                            className="h-2 bg-slate-900"
                                                            style={{ width: `${Math.max(0, Math.min(100, p.progress_pct))}%` }}
                                                        />
                                                    </div>
                                                    <div className="w-10 text-right tabular-nums">
                                                        {p.progress_pct}%
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}

                                {loading && (
                                    <tr>
                                        <td colSpan={6} className="py-8 text-slate-500">
                                            불러오는 중…
                                        </td>
                                    </tr>
                                )}

                                {!loading && projects.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="py-8 text-slate-500">
                                            표시할 프로젝트가 없습니다.
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
