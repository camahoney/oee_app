import os
import bcrypt
import jwt
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlmodel import Session, select
from app.database import get_session
from app.db import User, AuditLog

router = APIRouter(tags=["auth"])

SECRET_KEY = os.environ.get("SECRET_KEY", "supersecretkey-dev-only")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 7 days

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

# ── Password Hashing Helpers ──

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        # bcrypt can only handle passwords up to 72 bytes. Truncate as a safeguard.
        pw_bytes = plain_password.encode('utf-8')[:72]
        hash_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(pw_bytes, hash_bytes)
    except ValueError as e:
        print(f"Bcrypt verification error: {e}")
        return False

def get_password_hash(password: str) -> str:
    pw_bytes = password.encode('utf-8')[:72]
    return bcrypt.hashpw(pw_bytes, bcrypt.gensalt()).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# ── Dependency Guards ──

def get_optional_user(token: Optional[str] = Depends(oauth2_scheme), session: Session = Depends(get_session)) -> Optional[User]:
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            return None
    except jwt.PyJWTError:
        return None
    user = session.exec(select(User).where(User.email == email)).first()
    return user

def get_current_user(token: Optional[str] = Depends(oauth2_scheme), session: Session = Depends(get_session)) -> User:
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated", headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = session.exec(select(User).where(User.email == email)).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user

def require_role(*allowed_roles: str):
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
            detail=f"You can only modify scope: '{current_user.shift_scope}'"
        )
    if current_user.role == "viewer":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Viewer accounts are read-only")
    return current_user

# ── Audit Helper ──

def log_action(session: Session, user: Optional[User], action: str, **kwargs):
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
    }, expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    
    log_action(session, user, "login")
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "shift_scope": user.shift_scope
    }

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    """Return current user's info."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "shift_scope": current_user.shift_scope,
        "is_pro": current_user.is_pro
    }
