from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from sqlmodel import Session, select
import bcrypt
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional, List

from ..db import User, AuditLog
from ..database import get_session

router = APIRouter()

# Security settings
import os
SECRET_KEY = os.environ.get("SECRET_KEY", "supersecretkey-dev-only")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 day

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except ValueError:
        return False

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


# ── Core auth dependencies ──

def get_optional_user(token: Optional[str] = Depends(oauth2_scheme), session: Session = Depends(get_session)) -> Optional[User]:
    """Returns the authenticated user, or None if no valid token.
    Used for endpoints that should work for everyone but may behave differently based on role."""
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            return None
    except JWTError:
        return None

    user = session.exec(select(User).where(User.email == email)).first()
    return user


def get_current_user(token: Optional[str] = Depends(oauth2_scheme), session: Session = Depends(get_session)) -> User:
    """Returns authenticated user or raises 401."""
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated", headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = session.exec(select(User).where(User.email == email)).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def get_current_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    return current_user


# ── Role-checking dependency factories ──

def require_role(*allowed_roles: str):
    """Factory: returns a dependency that checks the user has one of the allowed roles."""
    def checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role}' is not authorized. Required: {', '.join(allowed_roles)}"
            )
        return current_user
    return checker


def require_shift_scope(shift: str, current_user: User = Depends(get_current_user)):
    """Validates that a supervisor's shift_scope matches the target shift.
    Admin/manager always pass. Supervisors must match."""
    if current_user.role in ("admin", "manager"):
        return current_user
    if current_user.role == "supervisor" and current_user.shift_scope != shift:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You can only modify '{current_user.shift_scope}', not '{shift}'"
        )
    if current_user.role == "viewer":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Viewer accounts are read-only")
    return current_user


# ── Audit helper ──

def log_action(session: Session, user: Optional[User], action: str, **kwargs):
    """Write an entry to the audit log."""
    entry = AuditLog(
        user_email=user.email if user else "anonymous",
        user_role=user.role if user else "viewer",
        shift=kwargs.get("shift"),
        action=action,
        machine_id=kwargs.get("machine_id"),
        category_id=kwargs.get("category_id"),
        before_value=kwargs.get("before_value"),
        after_value=kwargs.get("after_value"),
        details=kwargs.get("details"),
        timestamp=datetime.utcnow()
    )
    session.add(entry)
    session.commit()


# ── Endpoints ──

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == form_data.username)).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    access_token = create_access_token(data={
        "sub": user.email,
        "role": user.role,
        "shift_scope": user.shift_scope,
        "is_pro": user.is_pro
    })
    log_action(session, user, "login")
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "shift_scope": user.shift_scope
    }


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    """Return current user's info (decoded from token + DB lookup)."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "shift_scope": current_user.shift_scope,
        "is_pro": current_user.is_pro
    }


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(email: str, password: str, role: str = "viewer", session: Session = Depends(get_session)):
    existing = session.exec(select(User).where(User.email == email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=email,
        hashed_password=get_password_hash(password),
        role=role,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return {"msg": "User registered successfully"}


@router.get("/users", dependencies=[Depends(get_current_admin)], response_model=list[User])
def get_users(session: Session = Depends(get_session)):
    """List all users (Admin only)"""
    return session.exec(select(User)).all()


@router.post("/users", dependencies=[Depends(get_current_admin)], response_model=User)
def create_user(user: User, session: Session = Depends(get_session)):
    """Create a new user (Admin only)"""
    existing = session.exec(select(User).where(User.email == user.email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user.hashed_password = get_password_hash(user.hashed_password)
    user.created_at = datetime.utcnow()
    user.updated_at = datetime.utcnow()
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@router.post("/impersonate", dependencies=[Depends(get_current_admin)])
def impersonate_user(email: str, session: Session = Depends(get_session)):
    """Generate a token for a specific user (Admin only)"""
    user = session.exec(select(User).where(User.email == email)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    access_token = create_access_token(data={
        "sub": user.email,
        "role": user.role,
        "shift_scope": user.shift_scope,
        "is_pro": user.is_pro
    })
    return {"access_token": access_token, "token_type": "bearer", "impersonated_user": user.email}


@router.put("/users/{user_id}", dependencies=[Depends(get_current_admin)], response_model=User)
def update_user(user_id: int, user_update: dict, session: Session = Depends(get_session)):
    """Update user details (Admin only)"""
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    for key, value in user_update.items():
        if key == "password":
            user.hashed_password = get_password_hash(value)
        elif key in ["email", "role", "is_pro", "shift_scope"]:
            setattr(user, key, value)

    user.updated_at = datetime.utcnow()
    session.add(user)
    try:
        session.commit()
        session.refresh(user)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    return user
