# 📅 제조 프로젝트 스케줄(일 단위) 화면 설계 문서

## 목차
1. [화면 개요](#1-화면-개요)
2. [데이터 기준](#2-데이터-기준)
3. [작업 노드 판별 규칙](#3-작업-노드-판별-규칙)
4. [날짜 축 생성 규칙](#4-날짜-축-생성-규칙)
5. [날짜 헤더 규칙](#5-날짜-헤더-규칙)
6. [막대(bar) 규칙](#6-막대bar-규칙)
7. [작업 겹침 처리 (Lane Algorithm)](#7-작업-겹침-처리-lane-algorithm)
8. [Row 높이 계산](#8-row-높이-계산)
9. [레이아웃 요구사항](#9-레이아웃-요구사항)
10. [예외 케이스](#10-예외-케이스)
11. [구현 순서](#11-구현-순서)
12. [검증 시나리오](#12-검증-시나리오)

---

## 1. 화면 개요

### 1.1 URL
```
/projects/[id]/schedule
```

### 1.2 목적
제조 프로젝트의 작업 계획/실적을 일 단위 간트 차트 형태로 관리

### 1.3 대상 사용자
생산/공정 계획 작성자

---

## 2. 데이터 기준

### 2.1 사용 테이블

#### classifications
- `id`: BIGINT
- `parent_id`: BIGINT (NULL이면 ROOT)
- `name`: TEXT
- `depth`: INT (0부터 시작, ROOT=0)
- `path`: TEXT (예: `/ROOT/X축/TABLE BED/가공`)
- `is_active`: BOOLEAN

#### tasks
- `id`: BIGINT
- `project_id`: BIGINT
- `classification_id`: BIGINT
- `title`: TEXT
- `baseline_start`: TIMESTAMPTZ (계획 시작일시)
- `baseline_end`: TIMESTAMPTZ (계획 종료일시)
- `actual_start_date`: DATE (실제 시작일)
- `actual_end_date`: DATE (실제 종료일)

#### projects
- `id`: BIGINT
- `ordered_at`: DATE (수주일)

---

## 3. 작업 노드 판별 규칙

### 3.1 작업(row)이 되는 조건

작업 노드는 다음 **두 조건을 모두 만족**해야 합니다:

1. **leaf 노드**: 자식이 없음 (children이 없는 노드)
2. **depth ≥ 3**: DB의 `depth` 값이 3 이상

⚠️ **중요: leaf 조건이 우선입니다.**
- `depth ≥ 3`이더라도 자식이 있는 경우에는 작업 row가 아닙니다.
- 반드시 **leaf(자식 없음) 조건을 우선**합니다.

**예시:**
```
ROOT (depth=0)                    → 그룹 row
  └─ X축 (depth=1)                → 그룹 row
      └─ TABLE BED (depth=2)      → 그룹 row
          └─ 가공 (depth=3)       → ✅ 작업 row (leaf인 경우)
              └─ 설계 (depth=4)   → ✅ 작업 row (leaf라면)
```

### 3.2 그룹 row

위 조건을 만족하지 않는 노드는 **그룹 row**입니다.

- 그룹 row에는 막대를 그리지 않습니다
- 그룹 row는 트리 구조를 표현하기 위한 계층 표시용입니다
- 그룹 row는 접기/펼치기 기능을 가질 수 있습니다 (선택사항)

### 3.3 depth 기준

- DB의 `depth` 값을 그대로 사용합니다
- 향후 중분류가 늘어나도 자동 대응 가능합니다
- 예: depth=4, depth=5도 작업 row가 될 수 있습니다 (leaf인 경우)

---

## 4. 날짜 축 생성 규칙

### 4.1 시작일 (고정)

**프로젝트의 수주일 = `projects.ordered_at`**

- 스케줄의 첫 날짜는 항상 수주일입니다
- `ordered_at`이 NULL인 경우: 현재 날짜를 시작일로 사용 (예외 처리)

### 4.2 종료일 (자동 계산)

**종료일은 고정값을 사용하지 않습니다.**

#### 계산 로직:
1. 모든 task의 `baseline_end::date` 중 최대값을 구합니다
2. 해당 최대값을 종료일로 사용합니다

#### 예외 케이스: 계획이 하나도 없는 경우
- 종료일 = `ordered_at + 30일` (기본값)
- 또는 `ordered_at`이 NULL이면: 현재 날짜 + 30일

### 4.3 스케줄 범위

```
스케줄 = ordered_at ~ max(baseline_end)
```

단, 계획이 없는 경우:
```
스케줄 = ordered_at ~ (ordered_at + 30일)
```

---

## 5. 날짜 헤더 규칙

### 5.1 단위
- **일 단위**로 표시

### 5.2 헤더 구성: 2줄

#### 첫 번째 줄: 월 (Month)
- 월별로 `colspan`을 계산하여 표시
- 예: 2024년 1월이 31일이면 `colspan="31"`

#### 두 번째 줄: 일 (Day)
- 실제 달의 일수를 정확히 표시 (1~28/29/30/31)
- 각 일자 셀에 날짜 숫자 표시

### 5.3 주말 처리

- **토/일 컬럼만 회색 배경** 적용
- 요일 텍스트 표시 ❌ (예: "월", "화" 등 표시하지 않음)
- 공휴일 계산 ❌ (MVP에서는 공휴일 처리하지 않음)

**구현 예시:**
```typescript
// 날짜가 토요일(6) 또는 일요일(0)인지 확인
const dayOfWeek = date.getDay();
const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
// isWeekend가 true면 회색 배경 적용
```

---

## 6. 막대(bar) 규칙

### 6.1 막대 종류

#### PLAN (계획)
- `baseline_start ~ baseline_end` 기간을 표시
- **항상 존재** (필수)
- `timestamptz → date`로 변환하여 렌더링
- 색상: 파란색 계열 (예: `#3b82f6`)

#### ACTUAL (실적)
- `actual_start_date ~ actual_end_date` 기간을 표시
- **둘 다 존재할 때만 표시** (둘 중 하나라도 NULL이면 표시하지 않음)
- 색상: 초록색 계열 (예: `#10b981`)

### 6.2 막대 배치

- **한 task = 한 레인**
- 같은 레인 안에서:
  - **위**: PLAN
  - **아래**: ACTUAL

**시각적 예시:**
```
┌─────────────────────────┐
│   PLAN (파란색)         │
├─────────────────────────┤
│   ACTUAL (초록색)       │
└─────────────────────────┘
```

### 6.3 막대 라벨

- 기본: `tasks.title` (없으면 `classification.name`)
- 막대 위에 텍스트 오버레이로 표시 (선택사항)

---

## 7. 작업 겹침 처리 (Lane Algorithm)

### 7.1 목적

- 같은 작업(row)에 여러 task가 존재할 수 있습니다
- 같은 날에 2개 이상의 작업이 겹칠 수 있습니다
- 겹치면 row 안에서 레인으로 쌓아야 합니다
- 레인 수에 따라 row 높이가 자동 증가합니다

### 7.2 레인 배치 알고리즘

#### 입력
- 해당 `classification_id`의 모든 tasks
- 각 task의 `baseline_start`, `baseline_end` (date 변환 후)

⚠️ **중요: 모든 날짜 비교는 date 단위로 수행하며, 시간 정보는 사용하지 않습니다.**

#### 알고리즘 (Lane Algorithm)

```typescript
function assignLanes(tasks: Task[]): TaskWithLane[] {
  // 1. baseline_start 기준 오름차순 정렬
  const sortedTasks = [...tasks].sort((a, b) => {
    const aStart = new Date(a.baseline_start).getTime();
    const bStart = new Date(b.baseline_start).getTime();
    return aStart - bStart;
  });

  // 2. 빈 lanes 배열 생성 (각 lane은 마지막 종료일을 저장)
  const lanes: Date[] = [];

  // 3. 각 task 순회
  const result: TaskWithLane[] = [];
  
  for (const task of sortedTasks) {
    const taskStart = new Date(task.baseline_start);
    const taskEnd = new Date(task.baseline_end);
    
    // 4. 기존 lane 중 사용 가능한 것 찾기
    let assignedLane = -1;
    for (let i = 0; i < lanes.length; i++) {
      // task.start > lane.last_end 이면 해당 lane 사용 가능
      if (taskStart > lanes[i]) {
        assignedLane = i;
        lanes[i] = taskEnd; // lane의 마지막 종료일 업데이트
        break;
      }
    }
    
    // 5. 사용 가능한 lane이 없으면 새 lane 생성
    if (assignedLane === -1) {
      assignedLane = lanes.length;
      lanes.push(taskEnd);
    }
    
    result.push({
      ...task,
      laneIndex: assignedLane
    });
  }
  
  return result;
}
```

### 7.3 중요 규칙

- **PLAN 기준으로만 겹침 판단**
- ACTUAL은 배치 계산에 사용하지 않습니다
- ACTUAL은 PLAN과 같은 레인에 배치됩니다 (같은 task이므로)

### 7.4 예시

```
Task A: 2024-01-01 ~ 2024-01-10
Task B: 2024-01-05 ~ 2024-01-15  (겹침)
Task C: 2024-01-20 ~ 2024-01-25  (겹치지 않음)

결과:
Lane 0: Task A, Task C
Lane 1: Task B
```

---

## 8. Row 높이 계산

### 8.1 기본 높이

```typescript
const BASE_ROW_HEIGHT = 40; // 기본 row 높이 (픽셀)
const LANE_HEIGHT = 50;     // 각 레인 높이 (PLAN + ACTUAL 포함)
```

### 8.2 계산 공식

```typescript
const rowHeight = BASE_ROW_HEIGHT + (laneCount × LANE_HEIGHT);
```

⚠️ **중요: laneCount가 0인 경우에도 BASE_ROW_HEIGHT는 유지합니다.**
- task가 없는 작업 row도 최소 높이를 가집니다.

### 8.3 예시

- 레인이 1개인 경우: `40 + (1 × 50) = 90px`
- 레인이 2개인 경우: `40 + (2 × 50) = 140px`
- 레인이 3개인 경우: `40 + (3 × 50) = 190px`

### 8.4 LANE_HEIGHT 규칙

- `LANE_HEIGHT`는 PLAN + ACTUAL 두 줄을 담을 수 있어야 합니다
- PLAN 높이: 약 20px
- ACTUAL 높이: 약 20px
- 여백: 약 10px
- **총 50px 권장**

---

## 9. 레이아웃 요구사항

### 9.1 구조

```
┌─────────────────────────────────────────────┐
│  작업명 (sticky)  │  날짜 헤더 (sticky)     │
├──────────────────┼──────────────────────────┤
│                  │                          │
│  작업명 영역      │  날짜 영역 (가로 스크롤) │
│  (고정)           │  (스크롤 가능)          │
│                  │                          │
└──────────────────┴──────────────────────────┘
```

### 9.2 Sticky 영역

#### 왼쪽 트리(작업명)
- `position: sticky`
- `left: 0`
- `z-index: 10`
- 가로 스크롤 시에도 고정

#### 상단 날짜 헤더
- `position: sticky`
- `top: 0`
- `z-index: 10`
- 세로 스크롤 시에도 고정

### 9.3 오른쪽 날짜 영역

- 가로 스크롤 가능
- 날짜 컬럼 너비: 일정 (예: 30px 또는 40px)

### 9.4 작업명 표시

- 기본: `classification.name`
- 막대 라벨: `tasks.title` (없으면 `classification.name`)

---

## 10. 예외 케이스

### 10.1 계획이 없는 경우

- 프로젝트에 task가 하나도 없거나
- 모든 task의 `baseline_start`, `baseline_end`가 NULL인 경우

**처리:**
- 종료일 = `ordered_at + 30일`
- 작업 row는 표시하되 막대는 그리지 않음
- 또는 "계획 없음" 메시지 표시

### 10.2 ordered_at이 NULL인 경우

- 시작일 = 현재 날짜
- 종료일 = 현재 날짜 + 30일

### 10.3 baseline_start만 있고 baseline_end가 없는 경우

- `baseline_end = baseline_start`로 **자동 보정** (1일짜리 작업)
- MVP에서는 경고 메시지를 표시하지 않습니다

### 10.4 actual_start_date만 있고 actual_end_date가 없는 경우

- ACTUAL 막대를 그리지 않음 (둘 다 있어야 표시)

### 10.5 날짜 범위를 벗어나는 task

- 스케줄 범위 밖의 task는 표시하지 않음
- 또는 스케줄 범위를 자동 확장 (선택사항)

---

## 11. 구현 순서

### 11.1 권장 순서

1. ✅ **schedule_design.md 문서 작성** (현재 단계)
2. 날짜 축 생성 로직
3. classification 트리 + 작업 row 판별
4. task 그룹핑 + 레인 배치 함수
5. 막대 렌더링
6. sticky / 스크롤 레이아웃 정리

### 11.2 세부 작업

#### Step 1: 날짜 축 생성
- `ordered_at`부터 `max(baseline_end)`까지 날짜 배열 생성
- 월별 그룹핑 및 colspan 계산
- 주말 판별 함수

#### Step 2: Classification 트리 조회
- API: `GET /projects/{project_id}/classifications/tree`
- leaf 노드 판별 (자식이 없는 노드)
- depth ≥ 3 필터링

#### Step 3: Tasks 조회
- API: `GET /tasks?project_id={project_id}`
- classification_id별 그룹핑
- baseline_start, baseline_end date 변환

#### Step 4: 레인 배치
- Lane Algorithm 구현
- 각 task에 laneIndex 할당

#### Step 5: 막대 렌더링
- PLAN 막대 (파란색)
- ACTUAL 막대 (초록색)
- 날짜 → 픽셀 위치 계산

#### Step 6: 레이아웃
- Sticky 작업명 영역
- Sticky 날짜 헤더
- 가로 스크롤 영역

---

## 12. 검증 시나리오

### 12.1 기본 검증

1. ✅ **depth ≥ 3 leaf만 막대 표시**
   - depth=2인 노드는 막대 없음
   - depth=3인 leaf 노드는 막대 표시

2. ✅ **계획이 없는 프로젝트 → 수주일 + 30일 표시**
   - task가 없거나 baseline이 모두 NULL
   - 종료일 = ordered_at + 30일

3. ✅ **같은 날 작업 2개 → 서로 다른 레인**
   - Task A: 2024-01-01 ~ 2024-01-10
   - Task B: 2024-01-05 ~ 2024-01-15
   - 서로 다른 레인에 배치

4. ✅ **토/일만 회색**
   - 월~금: 흰색 배경
   - 토/일: 회색 배경

5. ✅ **계획 입력 시 오른쪽으로 자동 확장**
   - 새로운 task의 baseline_end가 현재 종료일보다 크면
   - 스케줄 범위 자동 확장

### 12.2 예외 검증

1. ✅ **ordered_at이 NULL**
   - 시작일 = 현재 날짜
   - 종료일 = 현재 날짜 + 30일

2. ✅ **actual_start_date만 있고 actual_end_date가 없음**
   - ACTUAL 막대 표시하지 않음

3. ✅ **baseline_start만 있고 baseline_end가 없음**
   - baseline_end = baseline_start (1일짜리 작업)

---

## 13. 중요 주의사항

### 13.1 계획 중심 스케줄

⚠️ **이 화면은 "계획 중심" 스케줄입니다.**

- ACTUAL은 시각적 비교용입니다
- 배치 기준은 항상 PLAN입니다
- 레인 배치는 PLAN 기준으로만 계산합니다

### 13.2 납기(due_at) 미사용

- MVP에서 `due_at`은 사용하지 않습니다
- 향후 기준선으로만 사용 예정

### 13.3 날짜 변환

- `baseline_start`, `baseline_end`는 `TIMESTAMPTZ`
- 렌더링 시 `date`로 변환 (시간 정보 제거)
- `actual_start_date`, `actual_end_date`는 이미 `DATE` 타입

### 13.4 구현 시 반드시 주의할 포인트

#### 1️⃣ 성능 (초기엔 괜찮지만)

- 날짜 범위가 길어지면 DOM 셀이 매우 많아집니다
- MVP에서는 OK
- **추후 고려:**
  - 가상 스크롤
  - 월 단위 lazy render

#### 2️⃣ Classification 트리 정렬

- 반드시 `sort_no` 또는 `path` 기준 정렬
- 그렇지 않으면 화면에서 작업 순서가 뒤죽박죽 보일 수 있습니다

#### 3️⃣ Task 여러 개인 경우 시각적 혼란

- 같은 classification에 task가 많아지면 row가 매우 커질 수 있습니다
- MVP에서는 허용
- **이후 고려:**
  - 접기/펼치기
  - "task 분리 보기" 옵션

---

## 14. API 요구사항

### 14.1 필요한 API

1. **프로젝트 정보 조회**
   - `GET /projects/{project_id}`
   - `ordered_at` 필수

2. **Classification 트리 조회**
   - `GET /projects/{project_id}/classifications/tree`
   - 또는 `GET /classifications/tree?project_id={project_id}`
   - leaf 노드 판별을 위해 children 정보 필요

3. **Tasks 조회**
   - `GET /tasks?project_id={project_id}`
   - `baseline_start`, `baseline_end`, `actual_start_date`, `actual_end_date` 포함

### 14.2 데이터 가공

- 프론트엔드에서 classification 트리를 순회하며 작업 row 판별
- tasks를 classification_id별로 그룹핑
- 각 classification의 tasks에 대해 레인 배치 알고리즘 적용

---

## 15. 변경 이력

| 날짜 | 내용 |
|------|------|
| 2025-01-XX | 최초 설계 문서 작성 |
| 2025-01-XX | 검토 후 수정: leaf 조건 우선 강조, 날짜 비교 기준 명확화, baseline_end NULL 처리 규칙 명확화, laneCount=0 케이스 추가, 구현 시 주의사항 추가 |

---

**이 문서를 기준으로 구현을 시작합니다.**

