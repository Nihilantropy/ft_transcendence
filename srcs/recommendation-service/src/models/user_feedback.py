from sqlalchemy import Column, Integer, String, Numeric, TIMESTAMP, CheckConstraint, Index, ForeignKey
from sqlalchemy.sql import func
from src.models.product import Base

class UserFeedback(Base):
    """User interaction tracking for future supervised learning."""

    __tablename__ = "user_feedback"
    __table_args__ = (
        CheckConstraint(
            "interaction_type IN ('click', 'view', 'purchase', 'rating')",
            name="check_valid_interaction_type"
        ),
        CheckConstraint(
            "(interaction_type = 'rating' AND interaction_value BETWEEN 1.0 AND 5.0) OR "
            "(interaction_type != 'rating' AND interaction_value >= 0)",
            name="check_valid_interaction_value"
        ),
        Index("idx_user_feedback_product", "product_id"),
        Index("idx_user_feedback_created", "created_at"),
        {"schema": "recommendation_schema"}
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    pet_id = Column(Integer, nullable=False)
    product_id = Column(Integer, ForeignKey("recommendation_schema.products.id"), nullable=False)
    interaction_type = Column(String(20), nullable=False)
    interaction_value = Column(Numeric(3, 2), nullable=True)
    similarity_score = Column(Numeric(5, 4), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)

    def __repr__(self):
        return f"<UserFeedback(id={self.id}, type='{self.interaction_type}')>"
