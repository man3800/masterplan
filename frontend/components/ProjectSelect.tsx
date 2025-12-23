"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import type { Project } from "@/types/project";

interface ProjectSelectProps {
  value: number | null;
  onChange: (projectId: number | null) => void;
  required?: boolean;
  disabled?: boolean;
}

export default function ProjectSelect({
  value,
  onChange,
  required = false,
  disabled = false,
}: ProjectSelectProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    async function loadProjects() {
      setLoading(true);
      setError("");
      try {
        const data = await apiGet<Project[]>("/projects?limit=200&sort=updated_at desc");
        setProjects(data);
      } catch (e: any) {
        setError(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    }

    loadProjects();
  }, []);

  function getDisplayText(project: Project): string {
    if (project.code) {
      return `${project.name} (${project.code})`;
    }
    return project.name;
  }

  const selectedProject = projects.find((p) => p.id === value);

  if (loading) {
    return (
      <div className="w-full rounded border px-3 py-2 bg-slate-50 text-sm text-slate-500">
        프로젝트 목록 로딩 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        오류: {error}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <select
        required={required}
        disabled={disabled}
        className="w-full rounded border px-3 py-2 bg-white text-sm"
        value={value || ""}
        onChange={(e) => {
          const projectId = e.target.value ? parseInt(e.target.value) : null;
          onChange(projectId);
        }}
      >
        <option value="">프로젝트 선택</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {getDisplayText(project)}
          </option>
        ))}
      </select>
      {selectedProject && selectedProject.customer_name && (
        <div className="text-xs text-slate-500">
          수주처: {selectedProject.customer_name}
        </div>
      )}
    </div>
  );
}

