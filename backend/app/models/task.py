"""
Task Pydantic Models
Based on actual schema: tasks table
"""
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator


class TaskCreate(BaseModel):
    """Task creation input model"""
    project_id: int = Field(..., ge=1, description="Project ID (required)")
    classification_id: int = Field(..., ge=1, description="Classification ID (required)")
    title: str = Field(..., min_length=1, max_length=500, description="Task title (required)")
    description: Optional[str] = Field(None, max_length=2000, description="Task description")
    status: str = Field(default="open", description="Task status (default: 'open')")
    baseline_start: Optional[datetime] = Field(None, description="Baseline start date/time")
    baseline_end: Optional[datetime] = Field(None, description="Baseline end date/time")
    actual_start_date: Optional[date] = Field(None, description="Actual start date")
    actual_end_date: Optional[date] = Field(None, description="Actual end date")

    @field_validator('baseline_end')
    @classmethod
    def validate_baseline_dates(cls, v, info):
        """Validate baseline_end >= baseline_start"""
        if v and 'baseline_start' in info.data and info.data['baseline_start']:
            if v < info.data['baseline_start']:
                raise ValueError('baseline_end must be >= baseline_start')
        return v

    @field_validator('actual_end_date')
    @classmethod
    def validate_actual_dates(cls, v, info):
        """Validate actual_end_date >= actual_start_date"""
        if v and 'actual_start_date' in info.data and info.data['actual_start_date']:
            if v < info.data['actual_start_date']:
                raise ValueError('actual_end_date must be >= actual_start_date')
        return v


class TaskUpdate(BaseModel):
    """Task update input model (all fields optional)"""
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = Field(None, max_length=2000)
    status: Optional[str] = Field(None)
    classification_id: Optional[int] = Field(None, ge=1)
    baseline_start: Optional[datetime] = None
    baseline_end: Optional[datetime] = None
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None

    @field_validator('baseline_end')
    @classmethod
    def validate_baseline_dates(cls, v, info):
        """Validate baseline_end >= baseline_start"""
        if v and 'baseline_start' in info.data and info.data.get('baseline_start'):
            if v < info.data['baseline_start']:
                raise ValueError('baseline_end must be >= baseline_start')
        return v

    @field_validator('actual_end_date')
    @classmethod
    def validate_actual_dates(cls, v, info):
        """Validate actual_end_date >= actual_start_date"""
        if v and 'actual_start_date' in info.data and info.data.get('actual_start_date'):
            if v < info.data['actual_start_date']:
                raise ValueError('actual_end_date must be >= actual_start_date')
        return v


class TaskOut(BaseModel):
    """Task output model"""
    id: int
    project_id: int
    project_name: Optional[str] = None  # JOIN from projects.name
    classification_id: int
    title: str
    description: Optional[str] = None
    status: str
    baseline_start: Optional[datetime] = None
    baseline_end: Optional[datetime] = None
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

