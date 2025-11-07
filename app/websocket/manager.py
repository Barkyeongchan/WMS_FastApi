# app/websocket/manager.py
from typing import List
from fastapi import WebSocket
import json

active_connections: List[WebSocket] = []

async def register(websocket: WebSocket):
    active_connections.append(websocket)
    print(f"[EC2] WebSocket registered (total={len(active_connections)})")

async def unregister(websocket: WebSocket):
    if websocket in active_connections:
        active_connections.remove(websocket)
        print(f"[EC2] WebSocket unregistered (total={len(active_connections)})")

async def broadcast_text(text: str):
    """모든 연결된 WebSocket 클라이언트에 문자열 전송"""
    dead = []
    for ws in active_connections:
        try:
            await ws.send_text(text)
        except Exception:
            dead.append(ws)

    for ws in dead:
        if ws in active_connections:
            active_connections.remove(ws)
            print("[EC2] 죽은 WebSocket 제거")

async def broadcast_json(message: dict):
    """모든 연결된 WebSocket 클라이언트에 JSON 전송"""
    await broadcast_text(json.dumps(message))