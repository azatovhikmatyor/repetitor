from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    """ORM obyektidan to'g'ridan-to'g'ri o'qiladigan javob sxemasi."""

    model_config = ConfigDict(from_attributes=True)


class Message(BaseModel):
    detail: str


class ErrorResponse(BaseModel):
    code: str
    detail: str
    details: object | None = None
