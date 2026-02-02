from sqlalchemy import Column, Integer, Numeric, TIMESTAMP, CheckConstraint, Index, ForeignKey
from sqlalchemy.sql import func
from src.models.product import Base

class Recommendation(Base):
    """Recommendation history tracking."""

    __tablename__ = "recommendations"
    __table_args__ = (
        CheckConstraint(
            "similarity_score >= 0 AND similarity_score <= 1",
            name="check_valid_similarity_score"
        ),
        CheckConstraint("rank_position > 0", name="check_valid_rank"),
        Index("idx_recommendations_user_pet", "user_id", "pet_id"),
        Index("idx_recommendations_created", "created_at"),
        {"schema": "recommendation_schema"}
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    pet_id = Column(Integer, nullable=False)
    product_id = Column(Integer, ForeignKey("recommendation_schema.products.id"), nullable=False)
    similarity_score = Column(Numeric(5, 4), nullable=False)
    rank_position = Column(Integer, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)

    def __repr__(self):
        return f"<Recommendation(id={self.id}, pet_id={self.pet_id}, product_id={self.product_id})>"
