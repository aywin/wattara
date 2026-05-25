from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import crud
from app.db import get_db
from app.routers.core.rate_limit import check_login_rate
from app.routers.core.security import create_access_token, verify_password

router = APIRouter()


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login")
def login(
    request: Request,
    login_data: LoginRequest,
    db: Session = Depends(get_db),
    _: None = Depends(check_login_rate),
):
    user = crud.get_user_by_email(db, email=login_data.email)
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect.",
        )

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role.value})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "username": user.username,
            "role": user.role.value,
        },
    }
