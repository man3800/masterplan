# 프론트엔드 사용 가이드

## 개요

MasterPlan 프론트엔드는 Next.js로 구현되었으며, 작업(Task) 관리 기능을 제공합니다.

## 시작하기

### 1. 환경 설정

```bash
cd frontend
npm install
```

### 2. 환경 변수 설정

`frontend/.env.local` 파일에 다음 내용을 추가:

```env
NEXT_PUBLIC_API_BASE=http://localhost:8081
```

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

## 주요 기능

### 1. 작업 목록 (`/tasks`)

**접근 방법**: 사이드바에서 "작업 목록" 클릭 또는 직접 `/tasks` 접속

**기능**:
- 프로젝트 선택: 상단에 `ProjectSelect` 컴포넌트로 프로젝트 선택
- 프로젝트 미선택 시: "프로젝트를 선택하세요" 안내 메시지 표시, API 호출 안 함
- 프로젝트 선택 후: 해당 프로젝트의 작업 목록 자동 로드
- 검색: 제목/설명에서 키워드 검색
- 필터: 상태(대기/진행중/완료), 분류 ID로 필터링
- 정렬: 기본값은 최신 업데이트 순 (`updated_at desc`)
- 페이징: 이전/다음 버튼으로 페이지 이동
- 상세 보기: 작업 행 클릭 시 상세 페이지로 이동

**URL 파라미터**:
- `?project_id=1` - 프로젝트 ID가 URL에 유지됨

**예시**:
```
http://localhost:3000/tasks?project_id=1
```

### 2. 작업 생성 (`/tasks/new`)

**접근 방법**: 
- 작업 목록 페이지에서 "+ 새 작업" 버튼 클릭
- 직접 `/tasks/new` 접속

**필수 입력 항목**:
1. **프로젝트** - `ProjectSelect`로 선택 (필수)
2. **분류 ID** - 숫자로 직접 입력 (필수, 향후 개선 예정)
3. **제목** - 작업 제목 (필수)

**선택 입력 항목**:
- 설명
- 상태 (기본값: "대기")
- Baseline 시작/종료 (datetime-local)
- 실제 시작일/종료일 (date)

**저장 후**: 생성된 작업의 상세 페이지로 자동 이동

**예시**:
```typescript
// ProjectSelect 사용 예시
<ProjectSelect
  value={projectId}
  onChange={(id) => setProjectId(id)}
  required={true}
/>
```

### 3. 작업 상세 (`/tasks/[id]`)

**접근 방법**: 작업 목록에서 작업 행 클릭

**기능**:
- 작업 정보 표시:
  - ID, 프로젝트 (이름 + ID), 분류 ID
  - 제목, 설명
  - 상태 (뱃지로 표시)
  - Baseline 일정
  - 실제 일정
  - 생성일, 수정일
- **수정**: "수정" 버튼 클릭 → 인라인 편집 모드
- **완료 처리**: "완료 처리" 버튼 (상태가 "완료"가 아닐 때)
- **다시 열기**: "다시 열기" 버튼 (상태가 "완료"일 때)
- **삭제**: "삭제" 버튼 → 확인 후 삭제

**상태 뱃지**:
- 대기 (open) - 회색
- 진행중 (in_progress) - 파란색
- 완료 (closed) - 초록색

## 컴포넌트 사용법

### ProjectSelect 컴포넌트

**위치**: `frontend/components/ProjectSelect.tsx`

**Props**:
```typescript
interface ProjectSelectProps {
  value: number | null;           // 선택된 프로젝트 ID
  onChange: (projectId: number | null) => void;  // 변경 핸들러
  required?: boolean;              // 필수 여부 (기본: false)
  disabled?: boolean;              // 비활성화 여부 (기본: false)
}
```

**사용 예시**:
```typescript
import ProjectSelect from "@/components/ProjectSelect";

function MyComponent() {
  const [projectId, setProjectId] = useState<number | null>(null);

  return (
    <div>
      <label>프로젝트 선택</label>
      <ProjectSelect
        value={projectId}
        onChange={(id) => setProjectId(id)}
        required={true}
      />
    </div>
  );
}
```

**표시 형식**:
- `name (code)` - code가 있는 경우
- `name` - code가 없는 경우
- 수주처(customer_name)가 있으면 하단에 보조 표시

**동작**:
- 마운트 시 자동으로 `GET /projects?limit=200&sort=updated_at desc` 호출
- 로딩 중: "프로젝트 목록 로딩 중..." 표시
- 에러 발생 시: 에러 메시지 표시

## 타입 정의

### Task 타입

**위치**: `frontend/types/task.ts`

```typescript
interface Task {
  id: number;
  project_id: number;
  project_name: string | null;  // JOIN된 프로젝트 이름
  classification_id: number;
  title: string;
  description: string | null;
  status: string;
  baseline_start: string | null;  // ISO datetime string
  baseline_end: string | null;    // ISO datetime string
  actual_start_date: string | null;  // ISO date string
  actual_end_date: string | null;    // ISO date string
  created_at: string;  // ISO datetime string
  updated_at: string;  // ISO datetime string
}
```

### Project 타입

**위치**: `frontend/types/project.ts`

```typescript
type ProjectStatus = "pending" | "in_progress" | "paused" | "done";

interface Project {
  id: number;
  code: string | null;
  name: string;
  customer_code: string | null;
  customer_name: string | null;
  status: ProjectStatus;
  ordered_at: string | null;
  paused_at: string | null;
  completed_at: string | null;
  due_at: string | null;
  created_at: string;
  updated_at: string;
}
```

## API 클라이언트

### apiGet

**위치**: `frontend/lib/api.ts`

```typescript
import { apiGet } from "@/lib/api";

// 사용 예시
const tasks = await apiGet<Task[]>("/tasks?project_id=1&limit=50");
const project = await apiGet<Project>("/projects/1");
```

### apiPost

**위치**: `frontend/lib/api.ts`

```typescript
import { apiPost } from "@/lib/api";

// POST 예시
const created = await apiPost<Task>("/tasks", {
  project_id: 1,
  classification_id: 10,
  title: "새 작업",
  status: "open"
});

// PATCH 예시
const updated = await apiPost<Task>("/tasks/1", {
  title: "수정된 제목",
  status: "in_progress"
}, "PATCH");

// DELETE 예시
await apiPost("/tasks/1", {}, "DELETE");
```

## 사용 흐름 예시

### 1. 작업 생성 흐름

1. `/tasks` 접속
2. 상단에서 프로젝트 선택
3. "+ 새 작업" 버튼 클릭
4. `/tasks/new`에서:
   - 프로젝트 선택 (자동으로 선택됨)
   - 분류 ID 입력
   - 제목 입력
   - 필요시 날짜 입력
5. "생성" 버튼 클릭
6. `/tasks/{id}` 상세 페이지로 이동

### 2. 작업 수정 흐름

1. `/tasks`에서 작업 행 클릭
2. `/tasks/{id}` 상세 페이지에서 "수정" 버튼 클릭
3. 인라인 편집 모드에서 수정
4. "저장" 버튼 클릭
5. 변경사항 반영

### 3. 작업 완료 처리

1. `/tasks/{id}` 상세 페이지에서 "완료 처리" 버튼 클릭
2. 상태가 "완료"로 변경됨
3. 필요시 "다시 열기" 버튼으로 되돌리기 가능

## 주의사항

1. **프로젝트 선택 필수**: 작업 목록을 보려면 반드시 프로젝트를 선택해야 합니다.

2. **분류 ID 직접 입력**: 현재 `/tasks/new`에서 분류 ID를 직접 입력해야 합니다. 향후 개선 예정입니다.

3. **날짜 형식**:
   - Baseline: `datetime-local` 형식 (예: `2024-01-01T10:00`)
   - Actual: `date` 형식 (예: `2024-01-01`)

4. **에러 처리**: API 호출 실패 시 에러 메시지가 빨간색 박스로 표시됩니다.

5. **URL 파라미터**: 프로젝트 ID는 URL query에 유지되므로, 새로고침해도 선택된 프로젝트가 유지됩니다.

## 향후 개선 예정

1. 분류 선택 UI 추가 (현재는 ID 직접 입력)
2. 프로젝트별 통계/대시보드
3. 작업 일괄 처리 기능
4. 고급 검색/필터 기능
5. 엑셀 내보내기

