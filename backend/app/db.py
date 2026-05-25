import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# Engine SQLAlchemy
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,   # vérifie la connexion avant usage
    pool_recycle=300,     # recycle les connexions toutes les 5 min
    pool_size=5,
    max_overflow=10,
)

# Session locale
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base pour les modèles
Base = declarative_base()

# Dépendance FastAPI pour ouvrir/fermer une session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


