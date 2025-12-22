📘 API Contract (MVP)

docs/02_api_contract.md

1. 목적 (Purpose)

본 문서는 MasterPlan MVP에서 제공하는 API의
요청/응답 형식을 명확히 정의하여,

프론트엔드

백엔드

AI 코드 생성(Cursor AI)

모두가 동일한 계약(API Contract) 을 기준으로 개발하도록 하는 것을 목표로 한다.

2. 공통 규칙 (Common Rules)
2.1 Base URL
http://localhost:8081

2.2 응답 공통 형식

모든 응답은 JSON

에러 시 HTTP Status Code로 의미 전달

3. 프로젝트 API
3.1 프로젝트 목록 조회

GET

/projects

Response (200)
[
  {
    "id": 1,
    "code": "HB-130X-1035",
    "name": "HB-130X(#1035)"
  }
]

4. 분류(Classification) API
4.1 분류 트리 조회 (대/중/소)

GET

/projects/{project_code}/classifications/tree

Path Parameter
이름	설명
project_code	프로젝트 코드
Response (200)
[
  {
    "id": 10,
    "name": "X축",
    "depth": 0,
    "path": "/X축",
    "children": [
      {
        "id": 20,
        "name": "TABLE BED",
        "depth": 1,
        "path": "/X축/TABLE BED",
        "children": [
          {
            "id": 30,
            "name": "설계",
            "depth": 2,
            "path": "/X축/TABLE BED/설계"
          }
        ]
      }
    ]
  }
]

규칙

depth는 0 → 1 → 2 순서

children은 없으면 빈 배열([])

정렬 기준

sort_no ASC

name ASC

4.2 분류 평면 리스트 조회 (대/중/소)

GET

/projects/{project_code}/classifications/flat

Response (200)
[
  {
    "l1": "X축",
    "l2": "TABLE BED",
    "l3": "설계",
    "path": "/X축/TABLE BED/설계",
    "sort_no": 1
  }
]

용도

엑셀 다운로드

리포트

공정 목록 화면

5. 에러 규칙
5.1 프로젝트 없음

Response (404)

{
  "detail": "Project not found"
}

6. MVP 범위 제외 API

분류 생성/수정/삭제 API

Task CRUD API

사용자/권한 API

8. 변경 이력
날짜	내용
2025-12-22	MVP API Contract 최초 정의