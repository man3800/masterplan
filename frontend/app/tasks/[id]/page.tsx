"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import type { Task, TaskUpdate } from "@/types/task";

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

export default function TaskDetailPage() {
  const router = useRouter();
  const params = useParams();
  const taskId = parseInt(params?.id as string);

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [editing, setEditing] = useState(false);

  // Edit form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("open");
  const [baselineStart, setBaselineStart] = useState("");
  const [baselineEnd, setBaselineEnd] = useState("");
  const [actualStartDate, setActualStartDate] = useState("");
  const [actualEndDate, setActualEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!taskId) {
      setError("작업 ID가 없습니다.");
      setLoading(false);
      return;
    }

    async function loadTask() {
      setLoading(true);
      setError("");
      try {
        const taskData = await apiGet<Task>(`/tasks/${taskId}`);
        setTask(taskData);
        // Initialize form
        setTitle(taskData.title);
        setDescription(taskData.description || "");
        setStatus(taskData.status);
        setBaselineStart(taskData.baseline_start ? taskData.baseline_start.slice(0, 16) : "");
        setBaselineEnd(taskData.baseline_end ? taskData.baseline_end.slice(0, 16) : "");
        setActualStartDate(taskData.actual_start_date || "");
        setActualEndDate(taskData.actual_end_date || "");
      } catch (e: any) {
        setError(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    }

    loadTask();
  }, [taskId]);

  async function handleSave() {
    if (!task) return;

    setSaving(true);
    setError("");
    try {
      const update: TaskUpdate = {
        title: title.trim(),
        description: description.trim() || null,
        status,
        baseline_start: baselineStart || null,
        baseline_end: baselineEnd || null,
        actual_start_date: actualStartDate || null,
        actual_end_date: actualEndDate || null,
      };

      const updated = await apiPost<Task>(`/tasks/${taskId}`, update, "PATCH");
      setTask(updated);
      setEditing(false);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      await fetch(`${API_BASE}/tasks/${taskId}`, { method: "DELETE" });
      router.push("/tasks");
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  async function handleComplete() {
    try {
      const updated = await apiPost<Task>(`/tasks/${taskId}/complete`, {});
      setTask(updated);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  async function handleReopen() {
    try {
      const updated = await apiPost<Task>(`/tasks/${taskId}/reopen`, {});
      setTask(updated);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <div className="mx-auto max-w-4xl">
          <div className="text-center py-8 text-slate-500">로딩 중...</div>
        </div>
      </div>
    );
  }

  if (error && !task) {
    return (
      <div className="min-h-screen p-6">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
          <button
            onClick={() => router.back()}
            className="mt-4 rounded-md border px-4 py-2 text-sm hover:bg-slate-50"
          >
            ← 뒤로
          </button>
        </div>
      </div>
    );
  }

  if (!task) {
    return null;
  }

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">작업 상세</h1>
          <div className="flex gap-2">
            <button
              onClick={() => router.back()}
              className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50"
            >
              ← 뒤로
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-xl border bg-white p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">ID</label>
              <div className="text-sm">{task.id}</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">상태</label>
              <div>{getStatusBadge(task.status)}</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">프로젝트</label>
              <div className="text-sm">
                {task.project_name || `ID: ${task.project_id}`}
              </div>
              {task.project_name && (
                <div className="text-xs text-slate-500 mt-0.5">ID: {task.project_id}</div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">분류 ID</label>
              <div className="text-sm">{task.classification_id}</div>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">제목</label>
            {editing ? (
              <input
                type="text"
                className="w-full rounded border px-3 py-2"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            ) : (
              <div className="text-sm font-medium">{task.title}</div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">설명</label>
            {editing ? (
              <textarea
                rows={4}
                className="w-full rounded border px-3 py-2"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            ) : (
              <div className="text-sm text-slate-700 whitespace-pre-wrap">
                {task.description || "-"}
              </div>
            )}
          </div>

          {/* Status (editable) */}
          {editing && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">상태</label>
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
          )}

          {/* Baseline Dates */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Baseline 일정</label>
            {editing ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <input
                    type="datetime-local"
                    className="w-full rounded border px-3 py-2"
                    value={baselineStart}
                    onChange={(e) => setBaselineStart(e.target.value)}
                  />
                </div>
                <div>
                  <input
                    type="datetime-local"
                    className="w-full rounded border px-3 py-2"
                    value={baselineEnd}
                    onChange={(e) => setBaselineEnd(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="text-sm">
                {formatDateTime(task.baseline_start)} ~ {formatDateTime(task.baseline_end)}
              </div>
            )}
          </div>

          {/* Actual Dates */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">실제 일정</label>
            {editing ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <input
                    type="date"
                    className="w-full rounded border px-3 py-2"
                    value={actualStartDate}
                    onChange={(e) => setActualStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <input
                    type="date"
                    className="w-full rounded border px-3 py-2"
                    value={actualEndDate}
                    onChange={(e) => setActualEndDate(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="text-sm">
                {formatDate(task.actual_start_date)} ~ {formatDate(task.actual_end_date)}
              </div>
            )}
          </div>

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">생성일</label>
              <div className="text-xs text-slate-500">{formatDateTime(task.created_at)}</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">수정일</label>
              <div className="text-xs text-slate-500">{formatDateTime(task.updated_at)}</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            {editing ? (
              <>
                <button
                  onClick={() => {
                    setEditing(false);
                    // Reset form
                    setTitle(task.title);
                    setDescription(task.description || "");
                    setStatus(task.status);
                    setBaselineStart(task.baseline_start ? task.baseline_start.slice(0, 16) : "");
                    setBaselineEnd(task.baseline_end ? task.baseline_end.slice(0, 16) : "");
                    setActualStartDate(task.actual_start_date || "");
                    setActualEndDate(task.actual_end_date || "");
                  }}
                  className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "저장 중..." : "저장"}
                </button>
              </>
            ) : (
              <>
                {task.status !== "closed" && (
                  <button
                    onClick={handleComplete}
                    className="rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
                  >
                    완료 처리
                  </button>
                )}
                {task.status === "closed" && (
                  <button
                    onClick={handleReopen}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                  >
                    다시 열기
                  </button>
                )}
                <button
                  onClick={() => setEditing(true)}
                  className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50"
                >
                  수정
                </button>
                <button
                  onClick={handleDelete}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
                >
                  삭제
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

