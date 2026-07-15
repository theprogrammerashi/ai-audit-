"""
CareAudit AI - Custom Exceptions
"""
from fastapi import HTTPException, status


class CaseNotFoundError(HTTPException):
    def __init__(self, case_id: str):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case {case_id} not found"
        )


class UserNotFoundError(HTTPException):
    def __init__(self, user_id: str = ""):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User not found: {user_id}" if user_id else "User not found"
        )


class UnauthorizedError(HTTPException):
    def __init__(self, detail: str = "Not authenticated"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"}
        )


class ForbiddenError(HTTPException):
    def __init__(self, detail: str = "Insufficient permissions"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail
        )


class ValidationError(HTTPException):
    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=detail
        )


class AgentError(Exception):
    """Raised when a LangGraph agent encounters an error."""
    def __init__(self, agent_name: str, message: str):
        self.agent_name = agent_name
        self.message = message
        super().__init__(f"Agent '{agent_name}' error: {message}")


class PolicyNotFoundError(HTTPException):
    def __init__(self, policy_code: str):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Policy {policy_code} not found"
        )
