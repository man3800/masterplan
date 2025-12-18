from fastapi import FastAPI, Request
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from app.routers import projects, categories, schedules

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

app.include_router(projects.router)
app.include_router(categories.router)
app.include_router(schedules.router)
