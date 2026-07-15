"""
CareAudit AI - Conversational Q&A API Endpoints
Chat interface with RAG-powered responses.
"""
from fastapi import APIRouter, Depends, HTTPException
import uuid
import json
import duckdb
from datetime import datetime
from app.database import get_db
from app.api.deps import get_current_user, get_optional_user
from app.services.chat_engine import generate_chat_response

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.post("/")
async def send_message(
    body: dict,
    user: dict = Depends(get_current_user),
    db: duckdb.DuckDBPyConnection = Depends(get_db)
):
    """Send a message to the conversational AI assistant."""
    message = body.get("message", "")
    conversation_id = body.get("conversation_id")
    
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")
    
    # Create new conversation if needed
    if not conversation_id:
        conversation_id = str(uuid.uuid4())
        title = message[:50] + "..." if len(message) > 50 else message
        db.execute("""
            INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)
        """, [conversation_id, user["id"], title])
    
    # Save user message
    user_msg_id = str(uuid.uuid4())
    db.execute("""
        INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, 'user', ?)
    """, [user_msg_id, conversation_id, message])
    
    # Generate AI response using the real chat engine
    ai_response = generate_chat_response(message, db)
    
    # Save AI message
    ai_msg_id = str(uuid.uuid4())
    db.execute("""
        INSERT INTO messages (id, conversation_id, role, content, structured_data) VALUES (?, ?, 'assistant', ?, ?)
    """, [ai_msg_id, conversation_id, ai_response["content"], json.dumps(ai_response.get("structured_data"))])
    
    # Update conversation timestamp
    db.execute("UPDATE conversations SET updated_at = ? WHERE id = ?", [datetime.utcnow(), conversation_id])
    
    return {
        "conversation_id": conversation_id,
        "message": {
            "id": ai_msg_id,
            "role": "assistant",
            "content": ai_response["content"],
            "structured_data": ai_response.get("structured_data"),
            "created_at": datetime.utcnow().isoformat()
        }
    }


@router.get("/history")
async def get_chat_history(
    user: dict = Depends(get_current_user),
    db: duckdb.DuckDBPyConnection = Depends(get_db)
):
    """Get conversation history for current user."""
    results = db.execute("""
        SELECT id, title, created_at, updated_at 
        FROM conversations 
        WHERE user_id = ? 
        ORDER BY updated_at DESC
    """, [user["id"]]).fetchall()
    columns = [desc[0] for desc in db.description]
    
    return [dict(zip(columns, row)) for row in results]


@router.get("/{conversation_id}/messages")
async def get_conversation_messages(
    conversation_id: str,
    user: dict = Depends(get_current_user),
    db: duckdb.DuckDBPyConnection = Depends(get_db)
):
    """Get all messages in a conversation."""
    results = db.execute("""
        SELECT id, role, content, structured_data, created_at
        FROM messages 
        WHERE conversation_id = ? 
        ORDER BY created_at ASC
    """, [conversation_id]).fetchall()
    columns = [desc[0] for desc in db.description]
    
    messages = []
    for row in results:
        msg = dict(zip(columns, row))
        if isinstance(msg.get("structured_data"), str):
            msg["structured_data"] = json.loads(msg["structured_data"])
        messages.append(msg)
    
    return messages


@router.delete("/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    user: dict = Depends(get_current_user),
    db: duckdb.DuckDBPyConnection = Depends(get_db)
):
    """Delete a conversation."""
    db.execute("DELETE FROM messages WHERE conversation_id = ?", [conversation_id])
    db.execute("DELETE FROM conversations WHERE id = ? AND user_id = ?", [conversation_id, user["id"]])
    return {"message": "Conversation deleted"}


