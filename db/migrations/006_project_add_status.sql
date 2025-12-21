-- =========================
-- 2. 프로젝트 상태 FK 추가
-- =========================
alter table erp_projects_cache
add column if not exists project_status_id bigint;

alter table erp_projects_cache
add constraint fk_project_status
foreign key (project_status_id)
references project_status(status_id);
