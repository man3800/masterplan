# AI_DB_CONTEXT.md

## 0. 목적

당신은 MasterPlan MVP의 DB 관련 코드/SQL/마이그레이션을 작성하는 AI입니다.
아래 규칙을 반드시 준수해서 코드를 생성합니다.

**참고 문서:**
- `MVP_DB_RULES.md`: 전체 DB 구조와 규칙 (상세)
- `docs/01_business_rules.md`: 비즈니스 규칙
- `docs/02_api_contract.md`: API 계약서

---

## 1. 핵심 테이블

**DB:** PostgreSQL, schema `public`

**핵심 테이블:**
- `projects`: 프로젝트
- `classifications`: 분류 (재귀 구조)
- `tasks`: 작업

---

## 2. 관계 (절대 고정)

```
projects (1) ─── (N) classifications
projects (1) ─── (N) tasks
classifications (1) ─── (N) tasks
```

**중요:**
- 분류(`classifications`)에도 `project_id`가 있습니다
- 작업(`tasks`)에도 `project_id`가 있습니다

---

## 3. ROOT 규칙 (중요 ⭐)

### 3.1 ROOT 정의

각 프로젝트는 ROOT 분류를 정확히 1개 가집니다.

**ROOT 조건:**
- `name = 'ROOT'`
- `parent_id IS NULL`
- `path = '/ROOT'`

### 3.2 ROOT 제약

- ROOT는 삭제/이름변경 금지 (시스템 기준점)
- 프로젝트당 ROOT는 정확히 1개

### 3.3 대분류 정의

**대분류 = ROOT의 직계 자식** (`parent_id = ROOT.id`)

---

## 4. 분류 트리 무결성 규칙

### 4.1 이름 중복 규칙

- 같은 프로젝트에서 같은 부모 아래 분류명(`name`)은 중복 불가
- **UNIQUE:** `(project_id, parent_id, name)`

### 4.2 경로 유일성

- 같은 프로젝트에서 `path`는 유일
- **UNIQUE:** `(project_id, path)`

### 4.3 삭제 제약

- 자식이 있으면 삭제 불가
- **ON DELETE RESTRICT**

### 4.4 순환 방지

- 자기 자신/자손을 부모로 지정 불가
- 트리거로 자동 차단

---

## 5. path / depth 관리 규칙 (중요 ⭐)

### 5.1 자동 관리

`classifications.path`, `classifications.depth`는 **DB 트리거가 자동 관리**합니다.

### 5.2 금지 사항

❌ **앱/SQL에서 직접 계산하거나 직접 업데이트하지 말 것**

### 5.3 자동 갱신

- 이름 변경/부모 이동 시에도 자손 `path`/`depth`까지 DB가 자동 갱신합니다

---

## 6. tasks 기본 분류 규칙 (중요 ⭐)

### 6.1 classification_id 자동 세팅

`tasks.classification_id`는 `NOT NULL`이지만,
**INSERT 시 `classification_id`를 생략하면 DB 트리거가 프로젝트의 ROOT로 자동 세팅합니다.**

### 6.2 API 설계

따라서 MVP API는 task 생성 시 `classification_id`를 강제하지 않아도 됩니다.

---

## 7. 공식 조회 뷰(View) (가능하면 이것을 사용)

### 7.1 ROOT 포함 트리 전체

```sql
SELECT *
FROM v_classifications_under_root
WHERE project_id = :project_id
ORDER BY level, sort_no, name, id;
```

### 7.2 ROOT의 직계 자식 (=대분류 목록)

```sql
SELECT *
FROM v_classifications_root_children
WHERE project_id = :project_id
ORDER BY sort_no, name, id;
```

---

## 8. 권장 SQL 패턴 (AI는 이 패턴을 우선 사용)

### 8.1 분류 추가

**입력:** `project_id`, `parent_id`, `name`, `sort_no`(optional)

**주의:** `path`/`depth`는 넣지 않습니다.

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

## 9. 마이그레이션 작성 규칙 (실무 ⭐)

### 9.1 인코딩

- 마이그레이션 SQL은 **ASCII-only**로 작성 (인코딩 이슈 방지)
- 파일 저장은 **UTF-8 without BOM** 사용

### 9.2 Idempotent 설계

- 마이그레이션은 가능하면 **idempotent** (`IF NOT EXISTS`)하게 만듭니다
- 동일 마이그레이션을 여러 번 실행해도 안전해야 합니다

### 9.3 트랜잭션

- 마이그레이션은 `BEGIN`/`COMMIT`으로 감싸서 원자성 보장

### 9.4 예시

```sql
-- 005_example.sql
BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'tasks' 
          AND column_name = 'new_column'
    ) THEN
        ALTER TABLE public.tasks 
        ADD COLUMN new_column TEXT;
        RAISE NOTICE 'Added column tasks.new_column';
    END IF;
END $$;

COMMIT;
```

---

## 10. 절대 하지 말 것

- ❌ ROOT 삭제/이름 변경
- ❌ `path`/`depth` 수동 계산/수정
- ❌ 트리거 제거/비활성화
- ❌ 같은 부모 아래 이름 중복 생성
- ❌ `tasks` INSERT 시 `classification_id` 강제

---

## 11. 체크리스트 (코드 생성 전 확인)

코드를 생성하기 전에 다음을 확인하세요:

- [ ] `path`/`depth`를 직접 계산/수정하지 않았는가?
- [ ] ROOT를 삭제/변경하지 않았는가?
- [ ] 마이그레이션은 idempotent한가?
- [ ] 마이그레이션은 ASCII-only인가?
- [ ] 트랜잭션(`BEGIN`/`COMMIT`)을 사용했는가?
- [ ] `tasks` INSERT 시 `classification_id`를 강제하지 않았는가?

---

## 12. 참고

더 자세한 내용은 `MVP_DB_RULES.md`를 참고하세요.
