"""
Project Pydantic Models
Based on actual schema: projects table
"""
from datetime import date, datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field, field_validator, model_validator

ProjectStatus = Literal["pending", "in_progress", "paused", "done"]


class ProjectCreate(BaseModel):
    """Project creation input model"""
    code: Optional[str] = Field(None, max_length=100, description="Project code (unique)")
    name: str = Field(..., min_length=1, max_length=500, description="Project name (required)")
    customer_code: Optional[str] = Field(None, max_length=100, description="Customer code")
    customer_name: Optional[str] = Field(None, max_length=200, description="Customer name")
    status: ProjectStatus = Field(default="pending", description="Project status (default: 'pending')")
    ordered_at: Optional[date] = Field(None, description="Order date")
    paused_at: Optional[date] = Field(None, description="Paused date")
    completed_at: Optional[date] = Field(None, description="Completed date")
    due_at: Optional[date] = Field(None, description="Due date")

    @model_validator(mode="after")
    def validate_status_dates(self):
        """Validate status-date constraints (DB constraints)"""
        # status = 'paused' → paused_at IS NOT NULL
        if self.status == "paused" and self.paused_at is None:
            raise ValueError("paused_at is required when status is 'paused'")
        
        # status = 'done' → completed_at IS NOT NULL
        if self.status == "done" and self.completed_at is None:
            raise ValueError("completed_at is required when status is 'done'")
        
        # completed_at IS NOT NULL → status = 'done'
        if self.completed_at is not None and self.status != "done":
            raise ValueError("status must be 'done' when completed_at is set")
        
        return self


class ProjectUpdate(BaseModel):
    """Project update input model (all fields optional)"""
    code: Optional[str] = Field(None, max_length=100)
    name: Optional[str] = Field(None, min_length=1, max_length=500)
    customer_code: Optional[str] = Field(None, max_length=100)
    customer_name: Optional[str] = Field(None, max_length=200)
    status: Optional[ProjectStatus] = None
    ordered_at: Optional[date] = None
    paused_at: Optional[date] = None
    completed_at: Optional[date] = None
    due_at: Optional[date] = None

    @model_validator(mode="after")
    def validate_status_dates(self):
        """Validate status-date constraints (DB constraints)"""
        # status = 'paused' → paused_at IS NOT NULL
        if self.status == "paused" and self.paused_at is None:
            raise ValueError("paused_at is required when status is 'paused'")
        
        # status = 'done' → completed_at IS NOT NULL
        if self.status == "done" and self.completed_at is None:
            raise ValueError("completed_at is required when status is 'done'")
        
        # completed_at IS NOT NULL → status = 'done'
        if self.completed_at is not None and self.status != "done":
            raise ValueError("status must be 'done' when completed_at is set")
        
        return self


class ProjectOut(BaseModel):
    """Project output model"""
    id: int
    code: Optional[str] = None
    name: str
    customer_code: Optional[str] = None
    customer_name: Optional[str] = None
    status: ProjectStatus
    ordered_at: Optional[date] = None
    paused_at: Optional[date] = None
    completed_at: Optional[date] = None
    due_at: Optional[date] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

