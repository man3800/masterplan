# Tasks API 및 프론트엔드 구현 완료

## 개요

실제 DB 스키마를 기반으로 Tasks CRUD API와 프론트엔드 UI를 구현했습니다.

## 스키마 인트로스펙션

- **파일**: `backend/sql/00_introspect_schema.sql`
- **실행**: `psql -h 127.0.0.1 -U postgres -d masterplan -f backend/sql/00_introspect_schema.sql`
- **결과**: `backend/sql/schema_output.txt`에 저장됨

### 확인된 테이블 구조

1. **tasks**
   - `id` (bigint, PK)
   - `project_id` (bigint, FK → projects)
   - `classification_id` (bigint, FK → classifications)
   - `title` (text, NOT NULL)
   - `description` (text, nullable)
   - `status` (text, NOT NULL, default: 'open')
   - `baseline_start` (timestamptz, nullable)
   - `baseline_end` (timestamptz, nullable)
   - `actual_start_date` (date, nullable)
   - `actual_end_date` (date, nullable)
   - `created_at` (timestamptz, NOT NULL)
   - `updated_at` (timestamptz, NOT NULL)

2. **classifications**
   - 재귀 구조 (`parent_id`)
   - `is_active` (boolean) - soft delete 대신 사용

3. **projects**
   - `id`, `code`, `name`, `status` (ENUM), 등

## 백엔드 API

### 엔드포인트

#### Tasks
- `GET /tasks` - 목록 조회 (필터, 검색, 페이징, 정렬)
- `GET /tasks/{id}` - 상세 조회
- `POST /tasks` - 생성
- `PATCH /tasks/{id}` - 수정
- `DELETE /tasks/{id}` - 삭제 (hard delete)
- `POST /tasks/{id}/complete` - 완료 처리
- `POST /tasks/{id}/reopen` - 다시 열기

#### Classifications
- `GET /classifications/tree?project_id={id}` - 트리 조회
- `GET /classifications` - 목록 조회
- `GET /classifications/{id}` - 상세 조회
- `POST /classifications` - 생성
- `PATCH /classifications/{id}` - 수정
- `DELETE /classifications/{id}` - 삭제 (하위가 있으면 실패)

### 쿼리 파라미터 (GET /tasks)

- `q` - 검색 (title, description에서 LIKE 검색)
- `status` - 상태 필터
- `project_id` - 프로젝트 필터
- `classification_id` - 분류 필터
- `limit` - 페이지 크기 (기본: 50, 최대: 200)
- `offset` - 오프셋 (기본: 0)
- `sort` - 정렬 (기본: "updated_at desc")

### 모델

- `TaskCreate` - 생성 입력
- `TaskUpdate` - 수정 입력 (모든 필드 Optional)
- `TaskOut` - 응답 모델

## 프론트엔드 UI

### 페이지

1. **`/tasks`** - 작업 목록
   - 검색, 필터, 정렬, 페이징
   - 테이블 형태로 표시
   - Row 클릭 시 상세 페이지로 이동

2. **`/tasks/new`** - 새 작업 생성
   - 프로젝트 ID, 분류 ID, 제목 등 입력
   - Baseline/Actual 날짜 입력

3. **`/tasks/[id]`** - 작업 상세
   - 상세 정보 표시
   - 수정 모드 (인라인 편집)
   - 완료/다시 열기 버튼
   - 삭제 버튼

### 타입

- `frontend/types/task.ts` - Task 관련 타입
- `frontend/types/classification.ts` - Classification 관련 타입

## 실행 방법

### 백엔드

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8081
```

### 프론트엔드

```bash
cd frontend
npm install
npm run dev
```

## 주의사항

1. **프로젝트 ID 매핑**: 현재 `/tasks/new` 페이지에서 프로젝트 ID를 직접 입력해야 합니다. `/projects` API가 `id`를 반환하지 않아서 발생하는 제한입니다. 향후 개선 필요.

2. **분류 트리**: Classification 트리는 `project_id`로 조회하지만, 기존 API는 `project_code`를 사용합니다. 통일 필요.

3. **Soft Delete**: `tasks` 테이블에는 `deleted_at` 컬럼이 없으므로 hard delete를 사용합니다. 필요시 마이그레이션으로 추가 가능.

4. **Baseline 날짜**: `baseline_start`와 `baseline_end`는 `timestamptz` 타입입니다. 프론트엔드에서 `datetime-local` 입력을 사용합니다.

## 다음 단계

1. 프로젝트 목록 API에 `id` 필드 추가
2. 분류 트리 API를 `project_id` 기반으로 통일
3. 테스트 코드 작성
4. 에러 처리 개선

