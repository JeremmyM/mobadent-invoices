import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Si existe una variable de entorno la usa, de lo contrario crea/usa SQLite local
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./mobadent.db")

# Ajuste necesario para SQLite en FastAPI/Uvicorn
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL, connect_args={"check_same_thread": False}
    )
else:
    # Por si alguna vez vuelves a conectar una base PostgreSQL externa
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()