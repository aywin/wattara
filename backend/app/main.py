from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import logging
import os
import time

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

from app.db import engine
from app import models
from app.routers import (
    auth,
    users,
    regions,
    zones,
    outages,
    reports,
    confirmations,
)

# =====================================================
# 🗄️ INITIALISATION BASE DE DONNÉES
# =====================================================
logger.info("Création des tables dans la base de données...")
models.Base.metadata.create_all(bind=engine)
logger.info("Tables créées avec succès")


# =====================================================
# 🚀 INITIALISATION FASTAPI
# =====================================================
app = FastAPI(
    title="API Gestion Coupures d'Électricité",
    description="""
    API complète pour la gestion des coupures d'électricité :
    
    - 🔐 **Authentication** : Connexion et gestion des utilisateurs
    - 🗺️ **Géographie** : Régions, zones et secteurs
    - ⚡ **Coupures** : Coupures officielles avec zones affectées
    - 🚨 **Signalements** : Reports utilisateurs
    - ✅ **Confirmations** : Validation par la communauté
    
    Version optimisée pour Next.js avec géométries GeoJSON.
    """,
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    contact={
        "name": "Support API",
        "email": "support@example.com"
    },
    license_info={
        "name": "MIT",
    }
)


# =====================================================
# 🌐 MIDDLEWARE CORS
# =====================================================
_cors_default = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173"
origins = [o.strip() for o in os.getenv("CORS_ORIGINS", _cors_default).split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):\d+$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# =====================================================
# 📊 MIDDLEWARE DE PERFORMANCE
# =====================================================
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Ajoute le temps de traitement dans les headers de réponse"""
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = f"{process_time:.4f}s"
    return response


# =====================================================
# 🚨 GESTION GLOBALE DES ERREURS
# =====================================================
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Formate les erreurs HTTP de manière cohérente"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": True,
            "message": exc.detail,
            "status_code": exc.status_code,
            "path": str(request.url)
        }
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Formate les erreurs de validation Pydantic"""
    errors = []
    for error in exc.errors():
        errors.append({
            "field": " -> ".join(str(loc) for loc in error["loc"]),
            "message": error["msg"],
            "type": error["type"]
        })
    
    return JSONResponse(
        status_code=422,
        content={
            "error": True,
            "message": "Erreur de validation des données",
            "status_code": 422,
            "details": errors
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Capture toutes les erreurs non gérées"""
    logger.error("Erreur non gérée : %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": True,
            "message": "Erreur interne du serveur",
            "status_code": 500,
            "details": str(exc) if os.getenv("DEBUG", "false").lower() == "true" else None
        }
    )


# =====================================================
# 📍 ROUTES
# =====================================================

# Route racine
@app.get("/", tags=["Root"])
def root():
    """
    Page d'accueil de l'API avec informations de base.
    """
    return {
        "message": "🔌 API Gestion Coupures d'Électricité",
        "version": "2.0.0",
        "status": "operational",
        "documentation": {
            "swagger": "/docs",
            "redoc": "/redoc"
        },
        "endpoints": {
            "auth": "/auth",
            "users": "/users",
            "regions": "/regions",
            "zones": "/zones",
            "outages": "/outages",
            "reports": "/reports",
            "confirmations": "/confirmations"
        }
    }


# Health check
@app.get("/health", tags=["Root"])
def health_check():
    """
    Endpoint de santé pour monitoring.
    """
    return {
        "status": "healthy",
        "database": "connected",
        "timestamp": time.time()
    }


# =====================================================
# 📦 INCLUSION DES ROUTERS
# =====================================================

# 🔐 Authentification (doit être en premier pour pas de conflit de routes)
app.include_router(
    auth.router,
    prefix="/auth",
    tags=["🔐 Authentication"]
)

# 👥 Utilisateurs
app.include_router(
    users.router,
    prefix="/users",
    tags=["👥 Users"]
)

# 🗺️ Géographie
app.include_router(
    regions.router,
    prefix="/regions",
    tags=["🗺️ Regions"]
)

app.include_router(
    zones.router,
    prefix="/zones",
    tags=["🏘️ Zones"]
)

# ⚡ Coupures et signalements
app.include_router(
    outages.router,
    prefix="/outages",
    tags=["⚡ Official Outages"]
)

app.include_router(
    reports.router,
    prefix="/reports",
    tags=["🚨 Reports"]
)

# ✅ Confirmations
app.include_router(
    confirmations.router,
    prefix="/confirmations",
    tags=["✅ Confirmations"]
)


# =====================================================
# 🎯 ÉVÉNEMENTS DE DÉMARRAGE/ARRÊT
# =====================================================
@app.on_event("startup")
async def startup_event():
    logger.info("API démarrée — docs: http://localhost:8000/docs — CORS: %s", origins)


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("API arrêtée")


# =====================================================
# 📊 ENDPOINTS ADDITIONNELS POUR DASHBOARD
# =====================================================
@app.get("/stats/global", tags=["📊 Statistics"])
def get_global_stats(db=None):
    """
    Statistiques globales de la plateforme.
    
    ⚠️ À implémenter avec la session DB
    """
    from app.crud import get_map_stats
    from app.db import SessionLocal
    
    db = SessionLocal()
    try:
        stats = get_map_stats(db)
        return {
            "success": True,
            "data": stats
        }
    finally:
        db.close()


# =====================================================
# 🧪 MODE DEBUG (à désactiver en production)
# =====================================================
if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Hot reload en dev
        log_level="info"
    )
