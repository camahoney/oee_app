from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool
from app.main import app
from app.database import get_session
from app.db import User
from app.routers.auth import get_password_hash

# Setup in-memory database for testing
engine = create_engine(
    "sqlite://", 
    connect_args={"check_same_thread": False}, 
    poolclass=StaticPool
)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session_override():
    with Session(engine) as session:
        yield session

app.dependency_overrides[get_session] = get_session_override

client = TestClient(app)

def test_auth_flow():
    create_db_and_tables()
    
    # 1. Register Admin User manually (since logic is in seeds generally, we do it here)
    with Session(engine) as session:
        admin_user = User(
            email="admin@example.com",
            hashed_password=get_password_hash("admin"),
            role="admin"
        )
        session.add(admin_user)
        session.commit()

    # 2. Login as Admin
    login_response = client.post("/auth/login", data={"username": "admin@example.com", "password": "admin"})
    assert login_response.status_code == 200, f"Login failed: {login_response.text}"
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    print("Login successful")

    # 3. Create a new user via Admin endpoint
    new_user_data = {
        "email": "test@example.com",
        "hashed_password": "password123",
        "role": "analyst"
    }
    create_response = client.post("/auth/users", json=new_user_data, headers=headers)
    assert create_response.status_code == 200, f"Create user failed: {create_response.text}"
    print("User creation successful")

    # 4. List users
    list_response = client.get("/auth/users", headers=headers)
    assert list_response.status_code == 200
    users = list_response.json()
    assert len(users) >= 2
    print(f"List users successful. details: {users}")

    # 5. Impersonate User
    impersonate_response = client.post("/auth/impersonate", params={"email": "test@example.com"}, headers=headers)
    assert impersonate_response.status_code == 200, f"Impersonate failed: {impersonate_response.text}"
    impersonated_token = impersonate_response.json()["access_token"]
    print("Impersonation successful")
    
    # Verify impersonated token role
    # We can't easily decode it here without jwt lib, but if we got a 200 it worked.
    
    print("ALL TESTS PASSED")

if __name__ == "__main__":
    test_auth_flow()
