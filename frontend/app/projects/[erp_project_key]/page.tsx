"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;

type ScheduleItem = {
    item_id: number;
    erp_project_key: string;
    cat_s_id: number;  // 백엔드에서 classification_id를 cat_s_id로 반환 (호환성 유지)
    cat_s_name: string;
    owner_dept_id: string | null;  // null 허용
    baseline_start: string | null;
    baseline_end: string | null;
    current_start: string | null;
    current_end: string | null;
    due_end_basis: string | null;
    plan_shift: string | null;  // number -> string (백엔드에서 text로 반환)
    actual_start_date: string | null;
    actual_end_date: string | null;
    is_progress_delayed: boolean | null;
};

type Project = {
    erp_project_key: string;
    project_name: string;
};

export default function ProjectDetailPage() {
    const router = useRouter();
    const params = useParams();
    const erpProjectKey = params?.erp_project_key as string;

    const [project, setProject] = useState<Project | null>(null);
    const [items, setItems] = useState<ScheduleItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>("");

    // 프로젝트 정보 및 스케줄 아이템 로드
    useEffect(() => {
        if (!erpProjectKey) {
            setError("프로젝트 키가 없습니다.");
            setLoading(false);
            return;
        }

        async function loadData() {
            setLoading(true);
            setError("");
            try {
                // 프로젝트 정보
                const projectsRes = await fetch(`${API_BASE}/projects`);
                if (!projectsRes.ok) throw new Error("프로젝트 목록을 불러오지 못했습니다.");
                const projects: Project[] = await projectsRes.json();
                const foundProject = projects.find((p) => p.erp_project_key === erpProjectKey);
                
                if (!foundProject) {
                    setError(`프로젝트를 찾을 수 없습니다: ${erpProjectKey}`);
                    setLoading(false);
                    return;
                }
                setProject(foundProject);

                // 스케줄 아이템 (API가 없을 수 있으므로 에러는 무시)
                try {
                    const itemsRes = await fetch(`${API_BASE}/projects/${encodeURIComponent(erpProjectKey)}/items`);
                    if (itemsRes.ok) {
                        const itemsData: ScheduleItem[] = await itemsRes.json();
                        setItems(itemsData);
                    } else {
                        setItems([]);
                    }
                } catch (e) {
                    // items API가 없거나 오류가 발생해도 계속 진행
                    console.warn("스케줄 아이템을 불러오지 못했습니다:", e);
                    setItems([]);
                }
            } catch (e: any) {
                console.error(e);
                setError(e?.message ?? "데이터를 불러오는 중 오류가 발생했습니다.");
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [erpProjectKey]);

    function fmtDate(d: string | null) {
        return d ? new Date(d).toLocaleDateString("ko-KR") : "-";
    }

    if (loading) {
        return (
            <div className="p-6">
                <div className="mx-auto max-w-6xl">
                    <div className="text-center py-8 text-slate-500">로딩 중...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6">
                <div className="mx-auto max-w-6xl">
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
                        {error}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="mx-auto max-w-6xl space-y-6">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold">{project?.project_name}</h1>
                        <p className="mt-1 text-sm text-slate-600">{project?.erp_project_key}</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => router.push(`/rows/new?erp_project_key=${encodeURIComponent(erpProjectKey)}`)}
                            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                        >
                            + Row 생성
                        </button>
                        <button
                            onClick={() => router.back()}
                            className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50"
                        >
                            ← 뒤로
                        </button>
                    </div>
                </div>

                {/* 스케줄 아이템 테이블 */}
                <div className="rounded-xl border bg-white">
                    <div className="border-b p-4">
                        <div className="text-sm font-semibold">스케줄 아이템</div>
                    </div>
                    <div className="overflow-x-auto p-4">
                        {items.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                스케줄 아이템이 없습니다. Row를 생성해주세요.
                            </div>
                        ) : (
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="text-left text-slate-600 border-b">
                                        <th className="py-2 pr-4">소분류</th>
                                        <th className="py-2 pr-4">담당부서</th>
                                        <th className="py-2 pr-4">Baseline 시작</th>
                                        <th className="py-2 pr-4">Baseline 종료</th>
                                        <th className="py-2 pr-4">실제 시작</th>
                                        <th className="py-2 pr-4">실제 종료</th>
                                        <th className="py-2 pr-4">상태</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item) => (
                                        <tr key={item.item_id} className="border-t">
                                            <td className="py-2 pr-4">{item.cat_s_name}</td>
                                            <td className="py-2 pr-4">{item.owner_dept_id ?? "-"}</td>
                                            <td className="py-2 pr-4">{fmtDate(item.baseline_start)}</td>
                                            <td className="py-2 pr-4">{fmtDate(item.baseline_end)}</td>
                                            <td className="py-2 pr-4">{fmtDate(item.actual_start_date)}</td>
                                            <td className="py-2 pr-4">{fmtDate(item.actual_end_date)}</td>
                                            <td className="py-2 pr-4">
                                                {item.is_progress_delayed ? (
                                                    <span className="text-red-600">지연</span>
                                                ) : (
                                                    <span className="text-green-600">정상</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
