from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

DepartmentCode = Literal["CSE", "ECE", "EEE", "MECH", "CIVIL"]
SectionCode = Literal["A", "B"]
StudentStatus = Literal["ACTIVE", "GRADUATED", "INACTIVE"]
CreateMode = Literal["simulated", "manual"]
ResultStatusValue = Literal["PASS", "FAIL"]


class StudentIdentityInput(BaseModel):
    roll_number: str = Field(pattern=r"^[0-9]{2}(CSE|ECE|EEE|MECH|CIVIL)[0-9]{3}$")
    name: str = Field(min_length=2, max_length=100)
    department_code: DepartmentCode
    section: SectionCode = "A"
    admission_year: int = Field(default=2024, ge=2000, le=2100)
    current_semester: int = Field(default=4, ge=1, le=4)
    email: str | None = Field(default=None, max_length=120)
    status: StudentStatus = "ACTIVE"

    @field_validator("roll_number")
    @classmethod
    def normalise_roll(cls, value: str) -> str:
        return value.strip().upper()

    @field_validator("name")
    @classmethod
    def normalise_name(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if len(cleaned) < 2:
            raise ValueError("name must contain at least two characters")
        return cleaned

    @field_validator("email")
    @classmethod
    def normalise_email(cls, value: str | None) -> str | None:
        cleaned = value.strip() if value else ""
        return cleaned or None


class ManualResultInput(BaseModel):
    subject_code: str = Field(min_length=3, max_length=20)
    internal_marks: int = Field(ge=0, le=30)
    external_marks: int = Field(ge=0, le=70)

    @field_validator("subject_code")
    @classmethod
    def normalise_subject(cls, value: str) -> str:
        return value.strip().upper()


class ManualSemesterInput(BaseModel):
    semester: int = Field(ge=1, le=4)
    results: list[ManualResultInput] = Field(min_length=1, max_length=10)


class StudentCreateRequest(BaseModel):
    identity: StudentIdentityInput
    mode: CreateMode
    generation_seed: str | None = Field(default=None, min_length=8, max_length=80)
    semesters: list[ManualSemesterInput] | None = None

    @model_validator(mode="after")
    def validate_mode_payload(self):
        if self.mode == "manual" and not self.semesters:
            raise ValueError("manual creation requires all four semesters of results")
        return self


class StudentUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    section: SectionCode | None = None
    email: str | None = Field(default=None, max_length=120)
    admission_year: int | None = Field(default=None, ge=2000, le=2100)
    current_semester: int | None = Field(default=None, ge=1, le=4)
    status: StudentStatus | None = None

    @field_validator("name")
    @classmethod
    def normalise_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = " ".join(value.split())
        if len(cleaned) < 2:
            raise ValueError("name must contain at least two characters")
        return cleaned

    @field_validator("email")
    @classmethod
    def normalise_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @model_validator(mode="after")
    def require_change(self):
        if not self.model_fields_set:
            raise ValueError("at least one student field must be supplied")
        return self


class ResultUpdateRequest(BaseModel):
    internal_marks: int = Field(ge=0, le=30)
    external_marks: int = Field(ge=0, le=70)
    expected_status: ResultStatusValue | None = None


class BacklogItemInput(BaseModel):
    semester: int = Field(ge=1, le=4)
    subject_code: str = Field(min_length=3, max_length=20)
    internal_marks: int | None = Field(default=None, ge=0, le=30)
    external_marks: int | None = Field(default=None, ge=0, le=70)

    @field_validator("subject_code")
    @classmethod
    def normalise_subject(cls, value: str) -> str:
        return value.strip().upper()

    @model_validator(mode="after")
    def validate_marks(self):
        if (self.internal_marks is None) != (self.external_marks is None):
            raise ValueError(
                "internal_marks and external_marks must be supplied together"
            )
        return self


class BacklogClearRequest(BaseModel):
    items: list[BacklogItemInput] = Field(min_length=1, max_length=20)

    @model_validator(mode="after")
    def validate_unique_items(self):
        seen: set[tuple[int, str]] = set()
        for item in self.items:
            key = (item.semester, item.subject_code)
            if key in seen:
                raise ValueError(
                    f"Duplicate backlog selection for semester {item.semester} "
                    f"{item.subject_code}."
                )
            seen.add(key)
        return self
