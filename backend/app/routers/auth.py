import os
import json
import bcrypt
import jwt
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
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

# ── Pydantic Schemas for User CRUD ──

class UserCreate(BaseModel):
    email: str
    password: str
    role: str = "viewer"
    shift_scope: Optional[str] = None
    is_pro: bool = False
    allowed_pages: Optional[List[str]] = None

class UserUpdate(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    shift_scope: Optional[str] = None
    is_pro: Optional[bool] = None
    allowed_pages: Optional[List[str]] = None

class UserOut(BaseModel):
    id: int
    email: str
    role: str
    shift_scope: Optional[str] = None
    is_pro: bool = False
    allowed_pages: Optional[List[str]] = None

# ── Endpoints ──

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == form_data.username)).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Parse allowed_pages from JSON string
    allowed_pages = None
    if user.allowed_pages:
        try:
            allowed_pages = json.loads(user.allowed_pages)
        except (json.JSONDecodeError, TypeError):
            allowed_pages = None

    access_token = create_access_token(data={
        "sub": user.email,
        "role": user.role,
        "shift_scope": user.shift_scope,
        "is_pro": user.is_pro,
        "allowed_pages": allowed_pages
    }, expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    
    log_action(session, user, "login")
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "shift_scope": user.shift_scope,
        "allowed_pages": allowed_pages
    }

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    """Return current user's info."""
    allowed_pages = None
    if current_user.allowed_pages:
        try:
            allowed_pages = json.loads(current_user.allowed_pages)
        except (json.JSONDecodeError, TypeError):
            allowed_pages = None
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "shift_scope": current_user.shift_scope,
        "is_pro": current_user.is_pro,
        "allowed_pages": allowed_pages
    }

# ── Admin-Only User CRUD ──

@router.get("/users", response_model=List[UserOut])
def list_users(current_user: User = Depends(require_role("admin")), session: Session = Depends(get_session)):
    """List all users (admin only)."""
    users = session.exec(select(User)).all()
    result = []
    for u in users:
        pages = None
        if u.allowed_pages:
            try:
                pages = json.loads(u.allowed_pages)
            except (json.JSONDecodeError, TypeError):
                pages = None
        result.append(UserOut(
            id=u.id,
            email=u.email,
            role=u.role,
            shift_scope=u.shift_scope,
            is_pro=u.is_pro,
            allowed_pages=pages
        ))
    return result

@router.post("/users", response_model=UserOut)
def create_user(data: UserCreate, current_user: User = Depends(require_role("admin")), session: Session = Depends(get_session)):
    """Create a new user (admin only)."""
    existing = session.exec(select(User).where(User.email == data.email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="A user with this email already exists")
    
    pages_json = json.dumps(data.allowed_pages) if data.allowed_pages else None
    
    new_user = User(
        email=data.email,
        hashed_password=get_password_hash(data.password),
        role=data.role,
        shift_scope=data.shift_scope,
        is_pro=data.is_pro,
        allowed_pages=pages_json
    )
    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    
    log_action(session, current_user, "create_user", details=f"Created user {data.email} with role {data.role}")
    
    return UserOut(
        id=new_user.id,
        email=new_user.email,
        role=new_user.role,
        shift_scope=new_user.shift_scope,
        is_pro=new_user.is_pro,
        allowed_pages=data.allowed_pages
    )

@router.put("/users/{user_id}", response_model=UserOut)
def update_user(user_id: int, data: UserUpdate, current_user: User = Depends(require_role("admin")), session: Session = Depends(get_session)):
    """Update an existing user (admin only). Password is optional — only updated if provided."""
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if data.email is not None:
        dup = session.exec(select(User).where(User.email == data.email)).first()
        if dup and dup.id != user_id:
            raise HTTPException(status_code=400, detail="Email already in use by another user")
        user.email = data.email
    if data.role is not None:
        user.role = data.role
    if data.shift_scope is not None:
        user.shift_scope = data.shift_scope if data.shift_scope != "" else None
    if data.is_pro is not None:
        user.is_pro = data.is_pro
    if data.password is not None and data.password.strip() != "":
        user.hashed_password = get_password_hash(data.password)
    if data.allowed_pages is not None:
        user.allowed_pages = json.dumps(data.allowed_pages) if data.allowed_pages else None
    
    user.updated_at = datetime.utcnow()
    session.add(user)
    session.commit()
    session.refresh(user)
    
    log_action(session, current_user, "update_user", details=f"Updated user {user.email} (id={user_id})")
    
    pages = None
    if user.allowed_pages:
        try:
            pages = json.loads(user.allowed_pages)
        except (json.JSONDecodeError, TypeError):
            pages = None
    
    return UserOut(
        id=user.id,
        email=user.email,
        role=user.role,
        shift_scope=user.shift_scope,
        is_pro=user.is_pro,
        allowed_pages=pages
    )

@router.delete("/users/{user_id}")
def delete_user(user_id: int, current_user: User = Depends(require_role("admin")), session: Session = Depends(get_session)):
    """Delete a user (admin only). Cannot delete yourself."""
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    email = user.email
    session.delete(user)
    session.commit()
    
    log_action(session, current_user, "delete_user", details=f"Deleted user {email} (id={user_id})")
    
    return {"detail": f"User {email} deleted successfully"}
