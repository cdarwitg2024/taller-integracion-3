#!/usr/bin/env python3
"""
Punto de entrada compatible con README.md (ejecuta app.main).
"""
import uvicorn
from app.core.config import settings
from app.main import app

if __name__ == "__main__":
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=False)
