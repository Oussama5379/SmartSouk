from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import health, image, captions

app = FastAPI(title="Aurea Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "https://smartsouk.onrender.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(image.router, prefix="/api")
app.include_router(captions.router, prefix="/api")
