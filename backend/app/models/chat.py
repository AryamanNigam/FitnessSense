from pydantic import BaseModel, Field
from datetime import datetime
from typing import Literal


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)


class ChatMessageResponse(BaseModel):
    id: str
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime
