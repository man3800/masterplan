"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiGet } from "@/lib/api";
import type { ClassificationTreeNode } from "@/types/classification";
import type { Project } from "@/types/project";
import ProjectSelect from "@/components/ProjectSelect";

function ClassificationsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const projectIdParam = searchParams.get("project_id");
    const projectId = projectIdParam ? parseInt(projectIdParam) : null;

    const [projectIdState, setProjectIdState] = useState<number | null>(projectId);
    const [tree, setTree] = useState<ClassificationTreeNode[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>("");

    // URL의 project_id와 state 동기화
    useEffect(() => {
        if (projectId) {
            setProjectIdState(projectId);
        }
    }, [projectId]);

    // 분류 트리 로드 함수
    const loadTree = React.useCallback(async () => {
        if (!projectIdState || projectIdState <= 0) {
            setTree([]);
            return;
        }

        setLoading(true);
        setError("");
        try {
            const data = await apiGet<ClassificationTreeNode[]>(
                `/classifications/tree?project_id=${projectIdState}`
            );
            setTree(data);
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            setError(`분류 목록 로딩 실패: ${errorMessage}`);
            setTree([]);
        } finally {
            setLoading(false);
        }
    }, [projectIdState]);

    // 분류 트리 로드
    useEffect(() => {
        loadTree();
    }, [loadTree]);

    // 분류 관리 페이지에서 업데이트 알림 받기 (BroadcastChannel 사용)
    useEffect(() => {
        const channel = new BroadcastChannel("classification-updates");
        
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === "classification-updated") {
                const updatedProjectId = event.data.projectId;
                // 현재 프로젝트와 같거나, projectId가 없으면 현재 프로젝트의 트리 다시 로드
                if (!updatedProjectId || updatedProjectId === projectIdState) {
                    loadTree();
                }
            }
        };

        channel.addEventListener("message", handleMessage);
        return () => {
            channel.removeEventListener("message", handleMessage);
            channel.close();
        };
    }, [projectIdState, loadTree]);

    function renderTreeNode(node: ClassificationTreeNode, depth: number = 0): React.ReactElement {
        const indent = depth * 24;
        const isLeaf = !node.children || node.children.length === 0;

        return (
            <div key={node.id} className="border-b last:border-b-0">
                <div
                    className="flex items-center gap-2 py-1 hover:bg-slate-50"
                    style={{ paddingLeft: `${indent}px` }}
                >
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{node.name}</span>
                            <span className="text-xs text-slate-500">({node.path})</span>
                            {!node.is_active && (
                                <span className="text-xs text-red-500">(비활성)</span>
                            )}
                            {isLeaf && (
                                <span className="text-xs text-blue-500">(작업)</span>
                            )}
                        </div>
                    </div>
                </div>
                
                {node.children && node.children.length > 0 && (
                    <div>
                        {node.children.map((child) => renderTreeNode(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="mx-auto max-w-6xl space-y-6">
                {/* 헤더 */}
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold">분류 뷰</h1>
                        <p className="mt-1 text-sm text-slate-600">
                            프로젝트별 분류 트리 조회
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                const url = projectIdState && projectIdState > 0
                                    ? `/classifications/manage?project_id=${projectIdState}`
                                    : `/classifications/manage`;
                                // 별도 창으로 열기 (너비: 600px, 높이: 900px)
                                const width = 600;
                                const height = 900;
                                const left = (window.screen.width - width) / 2;
                                const top = (window.screen.height - height) / 2;
                                const windowName = "classificationManage";
                                
                                // 같은 이름의 창 열기 (이미 열려있으면 그 창의 참조를 반환)
                                const manageWindow = window.open(
                                    url,
                                    windowName,
                                    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
                                );
                                
                                // 창이 이미 열려있었던 경우 최상위로 올리기
                                if (manageWindow) {
                                    manageWindow.focus();
                                }
                            }}
                            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                        >
                            분류 관리 (새 창)
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {/* 프로젝트 선택 */}
                <div className="rounded-xl border bg-white p-4">
                    <label className="block text-sm font-medium mb-2">프로젝트 선택</label>
                    <ProjectSelect
                        value={projectIdState}
                        onChange={(id) => {
                            setProjectIdState(id);
                            setTree([]);
                        }}
                        required={true}
                    />
                </div>

                {/* 트리 표시 */}
                {projectIdState && projectIdState > 0 && (
                    <div className="rounded-xl border bg-white">
                        <div className="border-b p-4">
                            <div className="text-sm font-semibold">분류 트리</div>
                        </div>
                        <div className="p-4">
                            {loading ? (
                                <div className="text-center py-8 text-slate-500">로딩 중...</div>
                            ) : tree.length === 0 ? (
                                <div className="text-center py-8 text-slate-500">
                                    분류가 없습니다.
                                </div>
                            ) : (
                                <div>
                                    {tree.map((node) => renderTreeNode(node))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {!projectIdState && (
                    <div className="rounded-xl border bg-white p-8 text-center text-slate-500">
                        프로젝트를 선택하세요.
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ClassificationsPage() {
    return (
        <Suspense fallback={
            <div className="p-6">
                <div className="mx-auto max-w-6xl">
                    <div className="text-center py-8 text-slate-500">로딩 중...</div>
                </div>
            </div>
        }>
            <ClassificationsContent />
        </Suspense>
    );
}
