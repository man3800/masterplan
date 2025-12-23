"""
Classification Pydantic Models
Based on actual schema: classifications table
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class ClassificationCreate(BaseModel):
    """Classification creation input model"""
    project_id: int = Field(..., ge=1, description="Project ID (required)")
    parent_id: Optional[int] = Field(None, ge=1, description="Parent classification ID (NULL for ROOT)")
    name: str = Field(..., min_length=1, max_length=200, description="Classification name (required)")
    sort_no: int = Field(default=0, description="Sort order (default: 0)")
    is_active: bool = Field(default=True, description="Active status (default: true)")
    owner_dept_id: Optional[int] = Field(None, description="Owner department ID")

    # Note: path and depth are auto-managed by DB triggers, do not include in Create


class ClassificationUpdate(BaseModel):
    """Classification update input model (all fields optional)"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    parent_id: Optional[int] = Field(None, ge=1)
    sort_no: Optional[int] = None
    is_active: Optional[bool] = None
    owner_dept_id: Optional[int] = None

    # Note: path and depth are auto-managed by DB triggers, do not include in Update


class ClassificationOut(BaseModel):
    """Classification output model"""
    id: int
    project_id: int
    parent_id: Optional[int] = None
    name: str
    depth: int
    path: str
    sort_no: int
    is_active: bool
    owner_dept_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ClassificationTreeNode(ClassificationOut):
    """Classification tree node with children"""
    children: List['ClassificationTreeNode'] = Field(default_factory=list)

    class Config:
        from_attributes = True


# Forward reference resolution
ClassificationTreeNode.model_rebuild()

