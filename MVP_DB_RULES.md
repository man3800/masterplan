# 📘 MVP_DB_RULES.md

## 1. 목적 (Purpose)

이 문서는 MasterPlan MVP의 DB 구조와 운영 규칙을 고정하기 위한 기준 문서입니다.
향후 사람과 AI가 동일한 전제에서 설계·개발·수정하도록 돕습니다.

⚠️ **이 문서는 "이상적인 설계"가 아니라 현재 MVP에서 실제로 동작하는 구조를 기준으로 합니다.**

---

## 2. 핵심 엔티티 관계

### 2.1 프로젝트 (projects)

프로젝트는 최상위 컨테이너입니다.

하나의 프로젝트는:
- 여러 개의 분류(classifications)를 가집니다
- 여러 개의 작업(tasks)을 가집니다

**관계:**
```
projects (1) ─── (N) classifications
projects (1) ─── (N) tasks
```

**주요 컬럼:**
- `id`: BIGSERIAL PRIMARY KEY
- `code`: TEXT UNIQUE (예: "HB-130X-1035")
- `name`: TEXT NOT NULL (예: "HB-130X(#1035)")
- `status`: project_status (pending, in_progress, paused, done)
- `customer_code`, `customer_name`: 수주처 정보
- `ordered_at`, `paused_at`, `completed_at`, `due_at`: 주요 날짜
- `created_at`, `updated_at`: 시스템 메타

### 2.2 분류 (classifications)

분류는 프로젝트에 소속된 트리 구조입니다.
단일 테이블로 재귀 구조를 구성합니다.

**관계:**
```
classifications (1) ─── (N) tasks
```

**주요 컬럼:**
- `id`: BIGSERIAL PRIMARY KEY
- `project_id`: BIGINT NOT NULL (분류가 속한 프로젝트)
- `parent_id`: BIGINT NULL (상위 분류, NULL이면 ROOT)
- `name`: TEXT NOT NULL (분류명)
- `depth`: INT NOT NULL DEFAULT 0 (깊이, DB가 자동 관리)
- `path`: TEXT NOT NULL (전체 경로, DB가 자동 관리)
- `sort_no`: INT NOT NULL DEFAULT 0 (정렬 순서)
- `is_active`: BOOLEAN NOT NULL DEFAULT TRUE (소프트 활성/비활성)
- `owner_dept_id`: BIGINT (담당 부서 ID, 선택)
- `created_at`, `updated_at`: 시스템 메타

**제약조건:**
- `UNIQUE (project_id, path)`: 경로 유일성
- `UNIQUE (project_id, parent_id, name)`: 같은 부모 아래 이름 중복 방지
- `FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE`
- `FOREIGN KEY (parent_id) REFERENCES classifications(id) ON DELETE CASCADE`

### 2.3 작업 (tasks)

작업은 항상 프로젝트에 속하며, 항상 하나의 분류에 속합니다.

**주요 컬럼:**
- `id`: BIGSERIAL PRIMARY KEY
- `project_id`: BIGINT NOT NULL (필수)
- `classification_id`: BIGINT NOT NULL (필수, 하지만 INSERT 시 생략 가능 → 자동 ROOT)
- `title`: TEXT NOT NULL
- `description`: TEXT
- `status`: TEXT NOT NULL DEFAULT 'open'
- `baseline_start`: TIMESTAMPTZ (baseline 시작일)
- `baseline_end`: TIMESTAMPTZ (baseline 종료일)
- `actual_start_date`: DATE (실제 시작일)
- `actual_end_date`: DATE (실제 종료일)
- `created_at`, `updated_at`: 시스템 메타

**제약조건:**
- `FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE`
- `FOREIGN KEY (classification_id) REFERENCES classifications(id) ON DELETE RESTRICT`
- `CHECK (baseline_start <= baseline_end)`: 날짜 유효성 검사
- `CHECK (actual_start_date <= actual_end_date)`: 날짜 유효성 검사

---

## 3. ROOT 분류 규칙 (중요 ⭐)

### 3.1 ROOT의 의미

ROOT는 프로젝트별 분류 트리의 시작점입니다.
시스템 분류이며, 일반 분류와 동일한 테이블에 저장됩니다.

**ROOT 조건:**
- `name = 'ROOT'`
- `parent_id IS NULL`
- `path = '/ROOT'`

### 3.2 ROOT는 반드시 존재한다

- 프로젝트당 ROOT는 정확히 1개
- 다음 제약으로 중복 생성 불가:
  - `UNIQUE (project_id, path)` → `/ROOT` 경로 유일
  - `UNIQUE (project_id, parent_id, name)` → 같은 부모(NULL) 아래 이름 중복 방지

### 3.3 분류 계층 규칙

```
ROOT (parent_id IS NULL, depth=0, path='/ROOT')
  └─ 대분류 (parent_id = ROOT.id, depth=1, path='/ROOT/대분류')
      └─ 중분류 (parent_id = 대분류.id, depth=2, path='/ROOT/대분류/중분류')
          └─ 소분류 (parent_id = 중분류.id, depth=3, path='/ROOT/대분류/중분류/소분류')
```

**깊이 제한 없음 (N단계 가능)**

**MVP 관례:**
- depth=0: ROOT (시스템)
- depth=1: 대분류 (예: X축, B축)
- depth=2: 중분류 (예: TABLE BED, 구매품)
- depth=3: 소분류 (예: 설계, 가공, 입고 등)

---

## 4. 분류 데이터 무결성 규칙

### 4.1 이름 중복 규칙

- 같은 프로젝트 + 같은 부모 아래에서는 `name` 중복 불가
- 다른 부모라면 `name` 중복 가능

**예시:**
- ✅ 허용: `/X축/구매품/Bearing 입고`, `/B축/구매품/Bearing 입고`
- ❌ 불가: `/X축/구매품/Bearing 입고` (중복)

### 4.2 삭제 규칙

- 분류에 자식이 있으면 삭제 불가 (`ON DELETE RESTRICT`)
- 실제 운영에서는 삭제 대신 `is_active=false` 권장

### 4.3 순환 방지

- 분류는 자기 자신 또는 자손을 부모로 가질 수 없습니다
- DB 트리거에서 자동 차단됩니다

---

## 5. path / depth 자동 관리 규칙 (중요 ⭐)

### 5.1 직접 수정 금지

❌ **애플리케이션에서 다음 컬럼을 직접 계산/수정하지 않습니다:**
- `path`
- `depth`

### 5.2 DB 트리거가 자동 처리

**INSERT 시:**
- `depth = parent.depth + 1`
- `path = parent.path + '/' + name`

**UPDATE 시:**
- 이름 변경 또는 부모 이동 시
- 모든 자손의 `path` / `depth` 자동 갱신

---

## 6. 작업(tasks) 기본 분류 규칙 (중요 ⭐)

### 6.1 classification_id 자동 세팅

`tasks` INSERT 시:
- `classification_id`를 지정하지 않으면
- 해당 프로젝트의 ROOT로 자동 세팅됩니다

### 6.2 필수 컬럼 요약

**반드시 필요:**
- `project_id`
- `title`
- `status`

**선택:**
- `classification_id`는 생략 가능 (자동 ROOT)

---

## 7. 공식 조회 뷰(Views)

### 7.1 ROOT 기준 트리 전체

```sql
SELECT *
FROM v_classifications_under_root
WHERE project_id = :project_id
ORDER BY level, sort_no, name, id;
```

### 7.2 대분류 목록 (ROOT의 직계 자식)

```sql
SELECT *
FROM v_classifications_root_children
WHERE project_id = :project_id
ORDER BY sort_no, name, id;
```

---

## 8. 권장 SQL 패턴

### 8.1 분류 추가

**입력:** `project_id`, `parent_id`, `name`, `sort_no`(optional)

**주의:** `path`, `depth`는 넣지 않습니다.

```sql
INSERT INTO classifications (project_id, parent_id, name, sort_no)
VALUES (:project_id, :parent_id, :name, :sort_no);
```

### 8.2 분류 이름 변경

```sql
UPDATE classifications 
SET name = :new_name 
WHERE project_id = :project_id AND id = :id;
```

### 8.3 분류 이동

```sql
UPDATE classifications 
SET parent_id = :new_parent_id 
WHERE project_id = :project_id AND id = :id;
```

### 8.4 작업 추가

```sql
INSERT INTO tasks (project_id, title, status, created_at, updated_at)
VALUES (:project_id, :title, :status, now(), now());
```

**주의:** `classification_id`는 생략 가능 (자동 ROOT)

---

## 9. AI / 개발자 작업 지침 (중요 ⭐)

### 9.1 반드시 지킬 것

- ✅ 분류 추가 시 `path`, `depth` 계산하지 말 것
- ✅ 분류 이동/이름 변경은 UPDATE만 수행할 것
- ✅ ROOT를 제거하거나 이름 변경하지 말 것
- ✅ `tasks` INSERT 시 `classification_id` 강제하지 말 것

### 9.2 권장

- ✅ 분류 UI는 ROOT부터 트리로 표시
- ✅ 삭제 대신 비활성(`is_active=false`) 사용
- ✅ 성능 문제 생길 때만 인덱스/함수 추가

### 9.3 절대 하지 말 것

- ❌ ROOT 삭제/이름 변경
- ❌ `path`/`depth` 수동 계산/수정
- ❌ 트리거 제거/비활성화
- ❌ 같은 부모 아래 이름 중복 생성

---

## 10. 마이그레이션 작성 규칙 (실무 ⭐)

### 10.1 인코딩

- 마이그레이션 SQL은 ASCII-only로 작성 (인코딩 이슈 방지)
- 파일 저장은 UTF-8 without BOM 사용

### 10.2 Idempotent 설계

- 마이그레이션은 가능하면 idempotent(`IF NOT EXISTS`)하게 만듭니다
- 동일 마이그레이션을 여러 번 실행해도 안전해야 합니다

### 10.3 트랜잭션

- 마이그레이션은 `BEGIN`/`COMMIT`으로 감싸서 원자성 보장

---

## 11. MVP 이후 확장 예정 (현재 미구현)

- 분류 이동/이름변경 helper 함수
- task 개수 포함 트리 뷰
- `owner_dept_id` 기반 권한 제어
- 분류 정렬(`sort_no`) 고급 규칙

⛔ **위 항목은 MVP 범위 아님. 필요해질 때만 마이그레이션 추가**

---

## 12. 결론

- 프로젝트 = 최상위 컨테이너
- ROOT = 프로젝트 내부 분류 트리의 기준점
- 분류/작업 관계는 DB가 최대한 안전하게 관리
- 애플리케이션과 AI는 단순한 규칙만 따르면 됩니다

---

## 13. 변경 이력

| 날짜 | 내용 |
|------|------|
| 2025-12-22 | 재귀 분류 구조 기반으로 전면 개편 |
| 2025-12-23 | ROOT 규칙 명확화, path/depth 자동 관리 규칙 추가 |
