from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from sqlmodel import Session, select
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional

from ..db import User
from ..database import get_session

router = APIRouter()

# Security settings (for demo purposes)
SECRET_KEY = "supersecretkey"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 day

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme), session: Session = Depends(get_session)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    statement = select(User).where(User.email == email)
    user = session.exec(statement).first()
    if user is None:
        raise credentials_exception
    return user

def get_current_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="The user doesn't have enough privileges"
        )
    return current_user

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(email: str, password: str, role: str = "analyst", session: Session = Depends(get_session)):
    # Check if user exists
    statement = select(User).where(User.email == email)
    existing_user = session.exec(statement).first()
    if existing_user:
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

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    statement = select(User).where(User.email == form_data.username)
    user = session.exec(statement).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    access_token = create_access_token(data={"sub": user.email, "role": user.role, "is_pro": user.is_pro})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/users", dependencies=[Depends(get_current_admin)], response_model=list[User])
def get_users(session: Session = Depends(get_session)):
    """List all users (Admin only)"""
    users = session.exec(select(User)).all()
    return users

@router.post("/users", dependencies=[Depends(get_current_admin)], response_model=User)
def create_user(user: User, session: Session = Depends(get_session)):
    """Create a new user manually (Admin only)"""
    # Check if user exists
    existing = session.exec(select(User).where(User.email == user.email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
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
        
    access_token = create_access_token(data={"sub": user.email, "role": user.role, "is_pro": user.is_pro})
    return {"access_token": access_token, "token_type": "bearer", "impersonated_user": user.email}

@router.put("/users/{user_id}", dependencies=[Depends(get_current_admin)], response_model=User)
def update_user(user_id: int, user_update: dict, session: Session = Depends(get_session)):
    """Update a user details (Admin only)"""
    print(f"DTO Update Received for user {user_id}: {user_update}")
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    for key, value in user_update.items():
        if key == "password":
            user.hashed_password = get_password_hash(value)
        elif key in ["email", "role", "is_pro"]:
            setattr(user, key, value)
            
    user.updated_at = datetime.utcnow()
    session.add(user)
    try:
        session.commit()
        session.refresh(user)
        print(f"User {user_id} updated successfully. Is Pro: {user.is_pro}")
    except Exception as e:
        print(f"DB Update Error: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
        
    return user
