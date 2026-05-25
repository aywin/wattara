from datetime import timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.db import get_db
from app.routers.core.security import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    hash_password,
    require_admin,
)

router = APIRouter()


@router.get("/", response_model=list[schemas.UserRead])
def get_users(
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    return crud.get_users(db)


@router.get("/{user_id}", response_model=schemas.UserRead)
def get_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    db_user = crud.get_user(db, user_id=user_id)
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur introuvable",
        )
    return db_user


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cette adresse email est deja utilisee.",
        )

    db_user = crud.get_user_by_username(db, username=user.username)
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ce nom d'utilisateur est deja utilise.",
        )

    user.role = models.UserRole.user
    new_user = crud.create_user(db=db, user=user, hashed_password=hash_password(user.password))

    access_token = create_access_token(
        data={"sub": str(new_user.id), "role": new_user.role.value},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(new_user.id),
            "email": new_user.email,
            "username": new_user.username,
            "role": new_user.role.value,
        },
    }


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    success = crud.delete_user(db, user_id=user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur introuvable",
        )
    return None
