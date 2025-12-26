"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import type { TaskCreate } from "@/types/task";
import type { ClassificationTreeNode } from "@/types/classification";
import type { Project } from "@/types/project";
import ProjectSelect from "@/components/ProjectSelect";

export default function NewRowPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [categories, setCategories] = useState<ClassificationTreeNode[]>([]);

    // URL에서 받는 파라미터
    const erpProjectKey = searchParams.get("erp_project_key") || "";
    const projectIdParam = searchParams.get("project_id");

    // 내부 선택 값은 projectId 중심으로 운용
    const [projectId, setProjectId] = useState<number | null>(() => {
        // URL에 project_id가 있으면 바로 사용
        if (projectIdParam) {
            return parseInt(projectIdParam);
        }
        return null;
    });

    const [classificationId, setClassificationId] = useState<number | null>(null);
    const [title, setTitle] = useState("");
    const [baselineStart, setBaselineStart] = useState("");
    const [baselineEnd, setBaselineEnd] = useState("");
    const [note, setNote] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>("");
    const [initializing, setInitializing] = useState(true);

    // 1) erp_project_key로 프로젝트 ID 찾기 (초기화 시 한 번만)
    useEffect(() => {
        async function findProjectId() {
            if (projectId || !erpProjectKey) {
                setInitializing(false);
                return;
            }

            try {
                const projects = await apiGet<Project[]>("/projects?limit=200");
                const found = projects.find((p) => p.code === erpProjectKey);
                if (found) {
                    setProjectId(found.id);
                } else {
                    console.warn(`Project with code '${erpProjectKey}' not found`);
                }
            } catch (e) {
                const errorMessage = e instanceof Error ? e.message : String(e);
                console.error("Failed to find project:", e);
                setError(`프로젝트를 찾을 수 없습니다: ${errorMessage}`);
            } finally {
                setInitializing(false);
            }
        }

        findProjectId();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // 초기 로드만

    // 2) 분류 트리 로드 (project_id 기준)
    useEffect(() => {
        if (!projectId || projectId <= 0) {
            setCategories([]);
            setClassificationId(null);
            return;
        }

        async function loadClassifications() {
            try {
                const tree = await apiGet<ClassificationTreeNode[]>(
                    `/classifications/tree?project_id=${projectId}`
                );
                setCategories(tree);
            } catch (e) {
                const errorMessage = e instanceof Error ? e.message : String(e);
                console.error("Failed to load classifications:", e);
                setError(`분류 목록 로딩 실패: ${errorMessage}`);
                setCategories([]);
            }
        }

        loadClassifications();
    }, [projectId]);

    // 분류 트리를 flatten하고 path 생성 (리프 노드만 포함)
    function flattenTreeWithPath(
        nodes: ClassificationTreeNode[],
        parentPath: string = ""
    ): Array<{ id: number; name: string; path: string; depth: number; isLeaf: boolean }> {
        const result: Array<{ id: number; name: string; path: string; depth: number; isLeaf: boolean }> = [];
        for (const node of nodes) {
            const currentPath = parentPath ? `${parentPath} / ${node.name}` : node.name;
            const isLeaf = !node.children || node.children.length === 0;

            // 리프 노드만 결과에 포함 (작업 = 리프 노드만 선택 가능)
            if (isLeaf && node.is_active) {
                result.push({
                    id: node.id,
                    name: node.name,
                    path: currentPath,
                    depth: node.depth,
                    isLeaf: true,
                });
            }

            // 자식 노드 재귀 처리
            if (node.children && node.children.length > 0) {
                result.push(...flattenTreeWithPath(node.children, currentPath));
            }
        }
        return result;
    }

    const flatClassifications = categories.length > 0 ? flattenTreeWithPath(categories) : [];
    const hasActiveClassifications = categories.some((node) => hasActiveLeaf(node));

    // 트리에 활성 리프 노드가 있는지 확인
    function hasActiveLeaf(node: ClassificationTreeNode): boolean {
        const isLeaf = !node.children || node.children.length === 0;
        if (isLeaf && node.is_active) {
            return true;
        }
        if (node.children && node.children.length > 0) {
            return node.children.some((child) => hasActiveLeaf(child));
        }
        return false;
    }

    // 3) 저장 (Tasks API 사용)
    async function handleSubmit() {
        if (!projectId || projectId <= 0) {
            setError("프로젝트를 선택하세요.");
            return;
        }

        if (!classificationId || !baselineStart || !baselineEnd) {
            setError("필수 항목을 모두 입력하세요: 작업, Baseline 시작일, Baseline 종료일");
            return;
        }

        setLoading(true);
        setError("");

        try {
            // title이 없으면 분류 path로 자동 생성
            let taskTitle = title.trim();
            if (!taskTitle) {
                const selectedClassification = flatClassifications.find((c) => c.id === classificationId);
                taskTitle = selectedClassification?.path || `작업 ${classificationId}`;
            }

            // date를 datetime으로 변환 (baseline_start, baseline_end는 timestamptz)
            const baselineStartDateTime = baselineStart ? `${baselineStart}T00:00:00Z` : null;
            const baselineEndDateTime = baselineEnd ? `${baselineEnd}T23:59:59Z` : null;

            const taskData: TaskCreate = {
                project_id: projectId,
                classification_id: classificationId,
                title: taskTitle,
                description: note.trim() || null,
                status: "open",
                baseline_start: baselineStartDateTime,
                baseline_end: baselineEndDateTime,
            };

            await apiPost<TaskCreate>("/tasks", taskData);

            // 프로젝트 상세 페이지로 이동 (code로 이동)
            // 프로젝트 정보를 다시 가져와서 code 확인
            try {
                const projects = await apiGet<Project[]>("/projects?limit=200");
                const selectedProject = projects.find((p) => p.id === projectId);
                if (selectedProject?.code) {
                    router.push(`/projects/${encodeURIComponent(selectedProject.code)}`);
                } else {
                    // code가 없으면 대시보드로 이동
                    router.push("/");
                }
            } catch {
                // 프로젝트 정보를 가져오지 못해도 대시보드로 이동
                router.push("/");
            }
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            console.error("Failed to create task:", e);
            setError(`저장 실패: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="p-6">
            <div className="mx-auto max-w-4xl space-y-6">
                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {/* 프로젝트 선택 */}
                <div>
                    <label className="block text-sm font-medium mb-1">프로젝트</label>
                    {initializing ? (
                        <div className="w-full rounded border px-3 py-2 bg-slate-50 text-sm text-slate-500">
                            프로젝트 정보 로딩 중...
                        </div>
                    ) : (
                        <ProjectSelect
                            value={projectId}
                            onChange={(id) => {
                                setProjectId(id);
                                setClassificationId(null); // 프로젝트 변경 시 분류 초기화
                            }}
                            required={true}
                        />
                    )}
                </div>

                {/* 작업 선택 */}
                {projectId && projectId > 0 && (
                    <div>
                        <div className="text-sm font-medium mb-2">작업</div>
                        {categories.length === 0 ? (
                            <div className="rounded border p-3 bg-slate-50 text-slate-500 text-sm">
                                분류 목록 로딩 중...
                            </div>
                        ) : !hasActiveClassifications ? (
                            <div className="rounded border border-blue-200 bg-blue-50 p-4 space-y-3">
                                <p className="text-sm text-blue-700">
                                    이 프로젝트에 작업이 없습니다. 먼저 분류를 등록하세요.
                                </p>
                                <button
                                    onClick={() => router.push(`/classifications?project_id=${projectId}`)}
                                    className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                                >
                                    분류 등록하러 가기
                                </button>
                            </div>
                        ) : flatClassifications.length === 0 ? (
                            <div className="rounded border p-3 bg-slate-50 text-slate-500 text-sm">
                                활성화된 작업이 없습니다. 분류 관리에서 작업(리프 노드)을 추가하세요.
                            </div>
                        ) : (
                            <div className="rounded border p-3 space-y-1 max-h-64 overflow-auto">
                                {flatClassifications.map((item) => (
                                    <label
                                        key={item.id}
                                        className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 p-1 rounded"
                                    >
                                        <input
                                            type="radio"
                                            name="classification"
                                            checked={classificationId === item.id}
                                            onChange={() => setClassificationId(item.id)}
                                        />
                                        <span className="flex-1">{item.path}</span>
                                        <span className="text-xs text-blue-500">(작업)</span>
                                    </label>
                                ))}
                            </div>
                        )}
                        {classificationId && (
                            <p className="mt-2 text-xs text-slate-600">
                                선택된 작업 ID: {classificationId}
                            </p>
                        )}
                    </div>
                )}

                {/* 제목 (선택) */}
                <div>
                    <label className="block text-sm font-medium mb-1">
                        제목 <span className="text-xs text-slate-500">(선택, 비어있으면 작업 경로로 자동 생성)</span>
                    </label>
                    <input
                        type="text"
                        className="w-full rounded border px-3 py-2"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="제목을 입력하세요 (선택사항)"
                    />
                </div>

                {/* baseline */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Baseline 시작일 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            required
                            className="w-full rounded border px-3 py-2"
                            value={baselineStart}
                            onChange={(e) => setBaselineStart(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Baseline 종료일 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            required
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
                        placeholder="메모를 입력하세요"
                    />
                </div>

                {/* 저장 */}
                <button
                    type="button"
                    disabled={loading || !projectId || projectId <= 0 || !classificationId || !baselineStart || !baselineEnd}
                    onClick={handleSubmit}
                    className="rounded-md bg-blue-600 px-6 py-2 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700"
                >
                    {loading ? "저장 중..." : "Row 생성"}
                </button>
            </div>
        </div>
    );
}
