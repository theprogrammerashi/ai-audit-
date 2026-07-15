"""
CareAudit AI - WebSocket Endpoints
Real-time agent pipeline status streaming.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import json
import asyncio

router = APIRouter(tags=["WebSocket"])


class ConnectionManager:
    """Manages WebSocket connections for live agent pipeline updates."""
    
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, case_id: str):
        await websocket.accept()
        if case_id not in self.active_connections:
            self.active_connections[case_id] = []
        self.active_connections[case_id].append(websocket)
    
    def disconnect(self, websocket: WebSocket, case_id: str):
        if case_id in self.active_connections:
            self.active_connections[case_id].remove(websocket)
            if not self.active_connections[case_id]:
                del self.active_connections[case_id]
    
    async def broadcast(self, case_id: str, message: dict):
        if case_id in self.active_connections:
            for connection in self.active_connections[case_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass


manager = ConnectionManager()


@router.websocket("/ws/agent-pipeline/{case_id}")
async def agent_pipeline_ws(websocket: WebSocket, case_id: str):
    """WebSocket endpoint for live agent pipeline status updates."""
    await manager.connect(websocket, case_id)
    
    try:
        # Send initial pipeline status
        await websocket.send_json({
            "type": "pipeline_status",
            "case_id": case_id,
            "agents": [
                {"name": "Clinical Intake", "status": "PENDING", "confidence": None, "output": None},
                {"name": "Policy Retrieval", "status": "PENDING", "confidence": None, "output": None},
                {"name": "Reviewer Assistant", "status": "PENDING", "confidence": None, "output": None},
                {"name": "QA Audit", "status": "PENDING", "confidence": None, "output": None},
                {"name": "Appeal Risk", "status": "PENDING", "confidence": None, "output": None},
                {"name": "Training", "status": "PENDING", "confidence": None, "output": None},
            ]
        })
        
        while True:
            # Wait for messages from the client (keep-alive)
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, case_id)
