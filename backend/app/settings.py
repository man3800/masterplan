import os
from dotenv import load_dotenv

load_dotenv()

# 데이터베이스 설정
DB_USER = os.getenv("DB_USER", "hnkerp")
DB_PASSWORD = os.getenv("DB_PASSWORD", "admin1234")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "masterplan")

# PostgreSQL asyncpg 연결 문자열
DATABASE_URL = f"postgresql+asyncpg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

