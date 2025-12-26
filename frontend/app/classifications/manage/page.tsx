"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import type { ClassificationTreeNode, ClassificationCreate, ClassificationUpdate } from "@/types/classification";
import type { Project } from "@/types/project";
import ProjectSelect from "@/components/ProjectSelect";

function ClassificationsManageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const projectIdParam = searchParams.get("project_id");
    const projectId = projectIdParam ? parseInt(projectIdParam) : null;

    const [projectIdState, setProjectIdState] = useState<number | null>(projectId);
    const [tree, setTree] = useState<ClassificationTreeNode[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>("");
    
    // 상단 폼에서 사용할 부모 선택 상태
    const [selectedParentForForm, setSelectedParentForForm] = useState<number | null>(null);
    const [rootNode, setRootNode] = useState<ClassificationTreeNode | null>(null);

    // 인라인 입력 상태
    const [inlineName, setInlineName] = useState("");
    const [inlineSortNo, setInlineSortNo] = useState(0);
    const [inlineIsActive, setInlineIsActive] = useState(true);
    const nameInputRef = React.useRef<HTMLInputElement>(null);
    
    // 모달 상태 (수정용)
    const [showModal, setShowModal] = useState(false);
    const [modalClassificationId, setModalClassificationId] = useState<number | null>(null);
    const [modalName, setModalName] = useState("");
    const [modalSortNo, setModalSortNo] = useState(0);
    const [modalIsActive, setModalIsActive] = useState(true);

    // URL의 project_id와 state 동기화
    useEffect(() => {
        if (projectId) {
            setProjectIdState(projectId);
        }
    }, [projectId]);

    // 분류 트리 로드
    useEffect(() => {
        if (!projectIdState || projectIdState <= 0) {
            setTree([]);
            return;
        }

        async function loadTree() {
            setLoading(true);
            setError("");
            try {
                const data = await apiGet<ClassificationTreeNode[]>(
                    `/classifications/tree?project_id=${projectIdState}`
                );
                setTree(data);
                
                // ROOT 노드 찾기
                const foundRoot = data.find((node) => node.parent_id === null && node.name === "ROOT");
                setRootNode(foundRoot || null);
                
                // 상단 폼의 부모 선택 초기화
                if (foundRoot && !selectedParentForForm) {
                    setSelectedParentForForm(foundRoot.id);
                }
                
                // ROOT가 없으면 자동 생성 시도
                if (!foundRoot && data.length === 0) {
                    try {
                        const rootData: ClassificationCreate = {
                            project_id: projectIdState,
                            parent_id: null,
                            name: "ROOT",
                            sort_no: 0,
                            is_active: true,
                        };
                        await apiPost<ClassificationCreate>("/classifications", rootData);
                        // 트리 다시 로드
                        const newData = await apiGet<ClassificationTreeNode[]>(
                            `/classifications/tree?project_id=${projectIdState}`
                        );
                        setTree(newData);
                        const newRoot = newData.find((node) => node.parent_id === null && node.name === "ROOT");
                        setRootNode(newRoot || null);
                        if (newRoot) {
                            setSelectedParentForForm(newRoot.id);
                        }
                    } catch (e) {
                        console.error("ROOT 자동 생성 실패:", e);
                        setError("ROOT 노드가 없습니다. 수동으로 생성해주세요.");
                    }
                }
            } catch (e) {
                const errorMessage = e instanceof Error ? e.message : String(e);
                setError(`분류 목록 로딩 실패: ${errorMessage}`);
                setTree([]);
            } finally {
                setLoading(false);
            }
        }

        loadTree();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectIdState]);

    function renderParentOptions(nodes: ClassificationTreeNode[], selectedParentId: number, depth: number = 0): React.ReactElement[] {
        const options: React.ReactElement[] = [];
        for (const node of nodes) {
            const indent = "  ".repeat(depth);
            options.push(
                <option key={node.id} value={node.id}>
                    {indent}{node.name} ({node.path})
                </option>
            );
            if (node.children && node.children.length > 0) {
                options.push(...renderParentOptions(node.children, selectedParentId, depth + 1));
            }
        }
        return options;
    }

    // 트리에서 특정 부모의 자식들을 찾는 함수
    function findChildrenByParentId(nodes: ClassificationTreeNode[], parentId: number): ClassificationTreeNode[] {
        for (const node of nodes) {
            if (node.id === parentId) {
                return node.children || [];
            }
            if (node.children && node.children.length > 0) {
                const found = findChildrenByParentId(node.children, parentId);
                if (found.length >= 0) {
                    return found;
                }
            }
        }
        return [];
    }

    // 부모 선택 시 자동으로 정렬 순서 설정
    const updateSortNoForParent = React.useCallback((parentId: number | null) => {
        if (!parentId || !tree.length) {
            setInlineSortNo(0);
            return;
        }

        const children = findChildrenByParentId(tree, parentId);
        if (children.length === 0) {
            setInlineSortNo(0);
            return;
        }

        // 자식들 중 가장 큰 sort_no 찾기
        const maxSortNo = Math.max(...children.map(c => c.sort_no || 0));
        setInlineSortNo(maxSortNo + 1);
    }, [tree]);

    function cancelInline() {
        setSelectedParentForForm(rootNode?.id || null);
        setInlineName("");
        setInlineSortNo(0);
        setError("");
    }
    
    async function saveInline() {
        if (!projectIdState || projectIdState <= 0 || !inlineName.trim()) {
            setError("이름을 입력하세요.");
            return;
        }

        const actualParentId = selectedParentForForm || rootNode?.id || null;
        if (!actualParentId) {
            setError("ROOT 노드가 없습니다.");
            return;
        }

        try {
            const data: ClassificationCreate = {
                project_id: projectIdState,
                parent_id: actualParentId,
                name: inlineName.trim(),
                sort_no: inlineSortNo,
                is_active: inlineIsActive,
            };
            await apiPost<ClassificationCreate>("/classifications", data);
            
            // 현재 선택된 부모 분류 ID 저장 (초기화 전에)
            const currentParentId = selectedParentForForm;
            
            // 트리 다시 로드
            const data2 = await apiGet<ClassificationTreeNode[]>(
                `/classifications/tree?project_id=${projectIdState}`
            );
            setTree(data2);
            const foundRoot = data2.find((node) => node.parent_id === null && node.name === "ROOT");
            setRootNode(foundRoot || null);
            
            // 저장 후 폼 초기화 (부모 분류는 유지)
            setInlineName("");
            setInlineSortNo(0);
            // 부모 분류는 저장 전 값으로 복원
            setSelectedParentForForm(currentParentId);
            
            // 분류 뷰 페이지에 업데이트 알림 (BroadcastChannel 사용)
            const channel = new BroadcastChannel("classification-updates");
            channel.postMessage({ type: "classification-updated", projectId: projectIdState });
            channel.close();
        } catch (e) {
            let errorMessage = e instanceof Error ? e.message : String(e);
            try {
                const errorJson = JSON.parse(errorMessage);
                if (errorJson.detail) {
                    errorMessage = errorJson.detail;
                }
            } catch {
                // JSON이 아니면 원본 메시지 사용
            }
            setError(errorMessage);
        }
    }

    function openEditModal(classificationId: number) {
        // 트리에서 해당 분류 찾기
        const findNode = (nodes: ClassificationTreeNode[]): ClassificationTreeNode | null => {
            for (const node of nodes) {
                if (node.id === classificationId) {
                    return node;
                }
                if (node.children && node.children.length > 0) {
                    const found = findNode(node.children);
                    if (found) return found;
                }
            }
            return null;
        };
        
        const classification = findNode(tree);
        if (!classification) {
            setError("분류를 찾을 수 없습니다.");
            return;
        }
        
        setModalClassificationId(classification.id);
        setModalName(classification.name);
        setModalSortNo(classification.sort_no);
        setModalIsActive(classification.is_active);
        setShowModal(true);
        setError("");
    }

    async function handleSaveModal() {
        if (!projectIdState || projectIdState <= 0 || !modalName.trim() || !modalClassificationId) {
            setError("이름을 입력하세요.");
            return;
        }

        try {
            const data: ClassificationUpdate = {
                name: modalName.trim(),
                sort_no: modalSortNo,
                is_active: modalIsActive,
            };
            await apiPost<ClassificationUpdate>(
                `/classifications/${modalClassificationId}`,
                data,
                "PATCH"
            );

            setShowModal(false);
            // 트리 다시 로드
            const data2 = await apiGet<ClassificationTreeNode[]>(
                `/classifications/tree?project_id=${projectIdState}`
            );
            setTree(data2);
            const foundRoot = data2.find((node) => node.parent_id === null && node.name === "ROOT");
            setRootNode(foundRoot || null);
        } catch (e) {
            let errorMessage = e instanceof Error ? e.message : String(e);
            try {
                const errorJson = JSON.parse(errorMessage);
                if (errorJson.detail) {
                    errorMessage = errorJson.detail;
                }
            } catch {
                // JSON이 아니면 원본 메시지 사용
            }
            setError(errorMessage);
        }
    }

    async function handleDelete(classificationId: number, node: ClassificationTreeNode) {
        if (!projectIdState || projectIdState <= 0) return;

        // 자식 분류가 있는지 확인
        const hasChildren = node.children && node.children.length > 0;
        if (hasChildren) {
            setError(`자식 분류가 있어서 제거할 수 없습니다. 먼저 자식 분류를 제거하세요.`);
            return;
        }

        // 연결된 작업이 있는지 확인
        try {
            const tasks = await apiGet<any[]>(`/tasks?classification_id=${classificationId}&limit=1`);
            if (tasks && tasks.length > 0) {
                setError(`연결된 작업이 있어서 제거할 수 없습니다. 먼저 해당 분류에 연결된 작업을 제거하세요.`);
                return;
            }
        } catch (e) {
            // 작업 확인 중 오류가 발생해도 계속 진행 (백엔드에서도 검증함)
            console.warn("작업 확인 중 오류:", e);
        }

        // 확인 메시지
        if (!confirm(`"${node.name}" 분류를 제거하시겠습니까?`)) {
            return;
        }

        try {
            await apiPost(
                `/classifications/${classificationId}`,
                null,
                "DELETE"
            );
            // 트리 다시 로드 (부모 선택 드롭다운용)
            const data = await apiGet<ClassificationTreeNode[]>(
                `/classifications/tree?project_id=${projectIdState}`
            );
            setTree(data);
            const foundRoot = data.find((node) => node.parent_id === null && node.name === "ROOT");
            setRootNode(foundRoot || null);
            
            // 분류 뷰 페이지에 업데이트 알림 (BroadcastChannel 사용)
            const channel = new BroadcastChannel("classification-updates");
            channel.postMessage({ type: "classification-updated", projectId: projectIdState });
            channel.close();
        } catch (e) {
            let errorMessage = e instanceof Error ? e.message : String(e);
            try {
                const errorJson = JSON.parse(errorMessage);
                if (errorJson.detail) {
                    errorMessage = errorJson.detail;
                }
            } catch {
                // JSON이 아니면 원본 메시지 사용
            }
            setError(`제거 실패: ${errorMessage}`);
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="mx-auto max-w-6xl space-y-6">
                {/* 헤더 */}
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold">분류 관리</h1>
                        <p className="mt-1 text-sm text-slate-600">
                            프로젝트별 분류 등록 및 관리
                        </p>
                    </div>
                    <div className="flex gap-2">
                    </div>
                </div>

                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {/* 프로젝트 선택 */}
                <div className="rounded-xl border bg-white p-2">
                    <label className="block text-sm font-medium mb-1">프로젝트 선택</label>
                    <ProjectSelect
                        value={projectIdState}
                        onChange={(id) => {
                            setProjectIdState(id);
                            setTree([]);
                        }}
                        required={true}
                    />
                </div>

                {/* 분류 추가 폼 (항상 표시) */}
                {projectIdState && projectIdState > 0 && rootNode && (
                    <div className="rounded-xl border bg-white p-2">
                        <div className="text-sm font-semibold mb-2">분류 추가</div>
                        <div className="space-y-2">
                            <div>
                                <label className="block text-xs font-medium mb-1">
                                    부모 분류
                                </label>
                                <select
                                    className="w-full rounded border px-2 py-1 text-sm"
                                    value={selectedParentForForm || rootNode.id}
                                    onChange={(e) => {
                                        const parentId = parseInt(e.target.value);
                                        setSelectedParentForForm(parentId);
                                        updateSortNoForParent(parentId);
                                    }}
                                >
                                    {renderParentOptions(tree, rootNode.id)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1">
                                    분류 이름 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    ref={nameInputRef}
                                    type="text"
                                    className="w-full rounded border px-2 py-1 text-sm"
                                    value={inlineName}
                                    onChange={(e) => setInlineName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            saveInline();
                                        }
                                    }}
                                    placeholder="분류 이름 입력"
                                />
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs font-medium mb-1">정렬 순서</label>
                                    <input
                                        type="number"
                                        className="w-full rounded border px-2 py-1 text-sm"
                                        value={inlineSortNo}
                                        onChange={(e) => setInlineSortNo(parseInt(e.target.value) || 0)}
                                    />
                                </div>
                                <div className="flex items-center gap-2 pt-2">
                                    <input
                                        type="checkbox"
                                        id="inline-active"
                                        checked={inlineIsActive}
                                        onChange={(e) => setInlineIsActive(e.target.checked)}
                                    />
                                    <label htmlFor="inline-active" className="text-xs">활성</label>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={cancelInline}
                                    className="rounded border px-3 py-1 text-xs hover:bg-slate-100"
                                >
                                    초기화
                                </button>
                                <button
                                    onClick={saveInline}
                                    className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
                                >
                                    저장
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 분류 목록 (간단한 리스트) */}
                {projectIdState && projectIdState > 0 && tree.length > 0 && (
                    <div className="rounded-xl border bg-white">
                        <div className="border-b p-4">
                            <div className="text-sm font-semibold">분류 목록 (수정/제거)</div>
                        </div>
                        <div className="p-4">
                            <div className="space-y-0.5">
                                {tree.flatMap((node) => {
                                    const flatten = (n: ClassificationTreeNode, depth: number = 0): Array<{ node: ClassificationTreeNode; depth: number }> => {
                                        const result = [{ node: n, depth }];
                                        if (n.children && n.children.length > 0) {
                                            n.children.forEach((child) => {
                                                result.push(...flatten(child, depth + 1));
                                            });
                                        }
                                        return result;
                                    };
                                    return flatten(node);
                                }).map(({ node, depth }) => (
                                    <div key={node.id} className="flex items-center justify-between py-1 border-b last:border-b-0" style={{ paddingLeft: `${depth * 16}px` }}>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{node.name}</span>
                                                <span className="text-xs text-slate-500">({node.path})</span>
                                                {!node.is_active && (
                                                    <span className="text-xs text-red-500">(비활성)</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => openEditModal(node.id)}
                                                className="rounded border px-2 py-1 text-xs hover:bg-slate-100"
                                            >
                                                수정
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setSelectedParentForForm(node.id);
                                                    updateSortNoForParent(node.id);
                                                    // 분류 이름 입력 필드로 포커스 이동
                                                    setTimeout(() => {
                                                        nameInputRef.current?.focus();
                                                    }, 100);
                                                }}
                                                className="rounded border px-2 py-1 text-xs hover:bg-slate-100"
                                            >
                                                추가
                                            </button>
                                            <button
                                                onClick={() => handleDelete(node.id, node)}
                                                className="rounded border px-2 py-1 text-xs hover:bg-red-50 text-red-600 hover:text-red-700"
                                                disabled={node.children && node.children.length > 0}
                                                title={node.children && node.children.length > 0 ? "자식 분류가 있어서 제거할 수 없습니다" : "분류 제거"}
                                            >
                                                제거
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {!projectIdState && (
                    <div className="rounded-xl border bg-white p-8 text-center text-slate-500">
                        프로젝트를 선택하세요.
                    </div>
                )}
            </div>

            {/* 모달 */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="w-full max-w-md rounded-lg bg-white p-6 space-y-4">
                        <h2 className="text-lg font-bold">분류 수정</h2>

                        <div>
                            <label className="block text-sm font-medium mb-1">
                                이름 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                className="w-full rounded border px-3 py-2"
                                value={modalName}
                                onChange={(e) => setModalName(e.target.value)}
                                placeholder="분류 이름"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">정렬 순서</label>
                            <input
                                type="number"
                                className="w-full rounded border px-3 py-2"
                                value={modalSortNo}
                                onChange={(e) => setModalSortNo(parseInt(e.target.value) || 0)}
                            />
                        </div>

                        <div>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={modalIsActive}
                                    onChange={(e) => setModalIsActive(e.target.checked)}
                                />
                                활성 상태
                            </label>
                        </div>

                        <div className="flex justify-end gap-2 pt-4 border-t">
                            <button
                                onClick={() => setShowModal(false)}
                                className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSaveModal}
                                className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                            >
                                저장
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function ClassificationsManagePage() {
    return (
        <Suspense fallback={
            <div className="p-6">
                <div className="mx-auto max-w-6xl">
                    <div className="text-center py-8 text-slate-500">로딩 중...</div>
                </div>
            </div>
        }>
            <ClassificationsManageContent />
        </Suspense>
    );
}

