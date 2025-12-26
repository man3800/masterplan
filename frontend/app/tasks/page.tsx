"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiGet } from "@/lib/api";
import type { Task, TaskListParams } from "@/types/task";
import ProjectSelect from "@/components/ProjectSelect";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;

function getStatusBadge(status: string) {
  const statusMap: Record<string, { label: string; className: string }> = {
    open: { label: "대기", className: "bg-slate-100 text-slate-700" },
    closed: { label: "완료", className: "bg-green-100 text-green-700" },
    in_progress: { label: "진행중", className: "bg-blue-100 text-blue-700" },
  };
  const statusInfo = statusMap[status] || { label: status, className: "bg-gray-100 text-gray-700" };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.className}`}>
      {statusInfo.label}
    </span>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ko-KR");
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    return date.toLocaleString("ko-KR");
  } catch {
    return dateStr;
  }
}

export default function TasksPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  // Project filter from URL
  const [projectIdFilter, setProjectIdFilter] = useState<number | null>(() => {
    const projectId = searchParams.get("project_id");
    return projectId ? parseInt(projectId) : null;
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [classificationIdFilter, setClassificationIdFilter] = useState<number | null>(null);

  // Pagination
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Sort
  const [sort, setSort] = useState("updated_at desc");

  async function loadTasks() {
    if (!projectIdFilter) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const params: TaskListParams = {
        limit,
        offset,
        sort,
      };

      if (searchQuery) params.q = searchQuery;
      if (statusFilter) params.status = statusFilter;
      if (projectIdFilter) params.project_id = projectIdFilter;
      if (classificationIdFilter) params.classification_id = classificationIdFilter;

      const queryString = new URLSearchParams(
        Object.entries(params)
          .filter(([_, v]) => v !== null && v !== undefined && v !== "")
          .map(([k, v]) => [k, String(v)])
      ).toString();

      const tasksData = await apiGet<Task[]>(`/tasks?${queryString}`);
      setTasks(tasksData);
      // Note: API doesn't return total count, so we estimate based on returned items
      setTotalCount(tasksData.length === limit ? offset + limit + 1 : offset + tasksData.length);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, offset, sort, searchQuery, statusFilter, projectIdFilter, classificationIdFilter]);

  // Update URL when project filter changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (projectIdFilter) {
      params.set("project_id", String(projectIdFilter));
    } else {
      params.delete("project_id");
    }
    router.replace(`/tasks?${params.toString()}`, { scroll: false });
  }, [projectIdFilter, router, searchParams]);

  const handleSearch = () => {
    setOffset(0);
    loadTasks();
  };

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-600">작업 관리 및 조회</p>
          </div>
          <button
            onClick={() => {
              const url = projectIdFilter 
                ? `/tasks/new?project_id=${projectIdFilter}`
                : "/tasks/new";
              router.push(url);
            }}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            + 새 작업
          </button>
        </header>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Project Select */}
        <div className="rounded-xl border bg-white p-4">
          <label className="block text-sm font-medium mb-2">프로젝트 선택</label>
          <ProjectSelect
            value={projectIdFilter}
            onChange={(id) => {
              setProjectIdFilter(id);
              setOffset(0); // Reset pagination
            }}
            required={false}
          />
        </div>

        {!projectIdFilter && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
            프로젝트를 선택하세요. 프로젝트를 선택하면 해당 프로젝트의 작업 목록이 표시됩니다.
          </div>
        )}

        {/* Filters */}
        {projectIdFilter && (
          <div className="rounded-xl border bg-white p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">검색</label>
                <input
                  type="text"
                  placeholder="제목/설명 검색..."
                  className="w-full rounded border px-3 py-1.5 text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">상태</label>
                <select
                  className="w-full rounded border px-3 py-1.5 text-sm bg-white"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">전체</option>
                  <option value="open">대기</option>
                  <option value="in_progress">진행중</option>
                  <option value="closed">완료</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">분류 ID</label>
                <input
                  type="number"
                  placeholder="분류 ID"
                  className="w-full rounded border px-3 py-1.5 text-sm"
                  value={classificationIdFilter || ""}
                  onChange={(e) =>
                    setClassificationIdFilter(e.target.value ? parseInt(e.target.value) : null)
                  }
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleSearch}
                className="rounded-md bg-slate-600 px-4 py-1.5 text-sm text-white hover:bg-slate-700"
              >
                검색
              </button>
            </div>
          </div>
        )}

        {/* Tasks Table */}
        <div className="rounded-xl border bg-white">
          <div className="border-b p-4 flex items-center justify-between">
            <div className="text-sm font-semibold">작업 목록</div>
            <div className="text-xs text-slate-600">
              {loading ? "로딩 중..." : `${tasks.length}건`}
            </div>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-slate-500">로딩 중...</div>
            ) : tasks.length === 0 ? (
              <div className="p-8 text-center text-slate-500">작업이 없습니다.</div>
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-600 border-b bg-slate-50">
                    <th className="py-3 px-4">ID</th>
                    <th className="py-3 px-4">제목</th>
                    <th className="py-3 px-4">상태</th>
                    <th className="py-3 px-4">Baseline</th>
                    <th className="py-3 px-4">Actual</th>
                    <th className="py-3 px-4">업데이트</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr
                      key={task.id}
                      className="border-b hover:bg-slate-50 cursor-pointer"
                      onClick={() => router.push(`/tasks/${task.id}`)}
                    >
                      <td className="py-3 px-4">{task.id}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium">{task.title}</div>
                        {task.description && (
                          <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                            {task.description}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(task.status)}</td>
                      <td className="py-3 px-4 text-xs">
                        {formatDateTime(task.baseline_start)} ~ {formatDateTime(task.baseline_end)}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {formatDate(task.actual_start_date)} ~ {formatDate(task.actual_end_date)}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {formatDateTime(task.updated_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {!loading && tasks.length > 0 && (
            <div className="border-t p-4 flex items-center justify-between">
              <div className="text-xs text-slate-600">
                {offset + 1} - {offset + tasks.length} / {totalCount > 0 ? totalCount : "?"}건
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                  className="rounded border px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  이전
                </button>
                <button
                  onClick={() => setOffset(offset + limit)}
                  disabled={tasks.length < limit}
                  className="rounded border px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  다음
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

