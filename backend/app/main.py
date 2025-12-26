from fastapi import FastAPI, Request
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from app.routers import projects, categories, schedules, dashboard, projects_new, tasks, classifications

app = FastAPI(title="MasterPlan API", version="0.1.0")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def force_json_utf8(request: Request, call_next):
    resp: Response = await call_next(request)
    ct = resp.headers.get("content-type", "")
    if ct.startswith("application/json") and "charset" not in ct:
        resp.headers["content-type"] = "application/json; charset=utf-8"
    return resp

# Health check
@app.get("/health")
async def health():
    return {"status": "ok"}

# 새로운 CRUD 라우터 (스키마 기반) - 먼저 등록하여 우선순위 확보
app.include_router(projects.router)  # Projects CRUD API (id 기반)
app.include_router(tasks.router)
app.include_router(classifications.router)

# 기존 라우터 (프로젝트별 API) - 하위 호환성 유지
app.include_router(projects_new.router)  # 프로젝트 코드 기반 API (프론트엔드 호환)
app.include_router(categories.router)
app.include_router(schedules.router)
app.include_router(dashboard.router)
