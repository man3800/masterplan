"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import type { TaskCreate, Task } from "@/types/task";
import type { ClassificationTreeNode } from "@/types/classification";
import ProjectSelect from "@/components/ProjectSelect";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;

export default function NewTaskPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  // Form state - URL에서 project_id 읽어서 초기값 설정
  const [projectId, setProjectId] = useState<number | null>(() => {
    const projectIdParam = searchParams.get("project_id");
    return projectIdParam ? parseInt(projectIdParam) : null;
  });
  const [classificationId, setClassificationId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("open");
  const [baselineStart, setBaselineStart] = useState("");
  const [baselineEnd, setBaselineEnd] = useState("");
  const [actualStartDate, setActualStartDate] = useState("");
  const [actualEndDate, setActualEndDate] = useState("");

  // Data
  const [classifications, setClassifications] = useState<ClassificationTreeNode[]>([]);
  const [loadingClassifications, setLoadingClassifications] = useState(false);

  // Load classifications when project is selected
  useEffect(() => {
    if (!projectId) {
      setClassifications([]);
      setClassificationId(null);
      return;
    }

    async function loadClassifications() {
      setLoadingClassifications(true);
      try {
        const tree = await apiGet<ClassificationTreeNode[]>(
          `/classifications/tree?project_id=${projectId}`
        );
        setClassifications(tree);
      } catch (e: any) {
        setError(`분류 목록 로딩 실패: ${e?.message ?? String(e)}`);
        setClassifications([]);
      } finally {
        setLoadingClassifications(false);
      }
    }

    loadClassifications();
  }, [projectId]);

  // Flatten tree for display (recursive)
  function flattenTree(nodes: ClassificationTreeNode[], depth: number = 0): Array<ClassificationTreeNode & { displayName: string }> {
    const result: Array<ClassificationTreeNode & { displayName: string }> = [];
    for (const node of nodes) {
      const indent = "  ".repeat(depth);
      result.push({
        ...node,
        displayName: `${indent}${node.name}`,
      });
      if (node.children && node.children.length > 0) {
        result.push(...flattenTree(node.children, depth + 1));
      }
    }
    return result;
  }

  const flatClassifications = classifications.length > 0 ? flattenTree(classifications) : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!projectId || !classificationId || !title.trim()) {
      setError("프로젝트, 분류, 제목은 필수입니다.");
      return;
    }

    setLoading(true);
    try {
      const taskData: TaskCreate = {
        project_id: projectId,
        classification_id: classificationId,
        title: title.trim(),
        description: description.trim() || null,
        status,
        baseline_start: baselineStart || null,
        baseline_end: baselineEnd || null,
        actual_start_date: actualStartDate || null,
        actual_end_date: actualEndDate || null,
      };

      const created = await apiPost<Task>("/tasks", taskData);
      router.push(`/tasks/${created.id}`);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50"
          >
            ← 뒤로
          </button>
        </header>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="rounded-xl border bg-white p-6 space-y-6">
          {/* Project Select */}
          <div>
            <label className="block text-sm font-medium mb-1">
              프로젝트 <span className="text-red-500">*</span>
            </label>
            <ProjectSelect
              value={projectId}
              onChange={setProjectId}
              required={true}
            />
          </div>

          {/* Classification Select */}
          <div>
            <label className="block text-sm font-medium mb-1">
              작업 분류(소분류) <span className="text-red-500">*</span>
            </label>
            {!projectId ? (
              <div className="w-full rounded border px-3 py-2 bg-slate-50 text-slate-500">
                프로젝트를 먼저 선택하세요
              </div>
            ) : loadingClassifications ? (
              <div className="w-full rounded border px-3 py-2 bg-slate-50 text-slate-500">
                분류 목록 로딩 중...
              </div>
            ) : flatClassifications.length === 0 ? (
              <div className="w-full rounded border px-3 py-2 bg-slate-50 text-slate-500">
                분류가 없습니다
              </div>
            ) : (
              <select
                required
                className="w-full rounded border px-3 py-2 bg-white"
                value={classificationId || ""}
                onChange={(e) =>
                  setClassificationId(e.target.value ? parseInt(e.target.value) : null)
                }
              >
                <option value="">분류를 선택하세요</option>
                {flatClassifications.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.displayName} (ID: {item.id})
                  </option>
                ))}
              </select>
            )}
            {projectId && flatClassifications.length > 0 && (
              <p className="mt-1 text-xs text-slate-500">
                {flatClassifications.length}개의 분류 항목 중 선택하세요
              </p>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-1">
              제목 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={500}
              className="w-full rounded border px-3 py-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">설명</label>
            <textarea
              rows={4}
              maxLength={2000}
              className="w-full rounded border px-3 py-2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium mb-1">상태</label>
            <select
              className="w-full rounded border px-3 py-2 bg-white"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="open">대기</option>
              <option value="in_progress">진행중</option>
              <option value="closed">완료</option>
            </select>
          </div>

          {/* Baseline Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Baseline 시작</label>
              <input
                type="datetime-local"
                className="w-full rounded border px-3 py-2"
                value={baselineStart}
                onChange={(e) => setBaselineStart(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Baseline 종료</label>
              <input
                type="datetime-local"
                className="w-full rounded border px-3 py-2"
                value={baselineEnd}
                onChange={(e) => setBaselineEnd(e.target.value)}
              />
            </div>
          </div>

          {/* Actual Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">실제 시작일</label>
              <input
                type="date"
                className="w-full rounded border px-3 py-2"
                value={actualStartDate}
                onChange={(e) => setActualStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">실제 종료일</label>
              <input
                type="date"
                className="w-full rounded border px-3 py-2"
                value={actualEndDate}
                onChange={(e) => setActualEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-md border px-5 py-2 text-sm hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-blue-600 px-6 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "저장 중..." : "생성"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

