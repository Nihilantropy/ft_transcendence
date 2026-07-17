-- Set search path
SET search_path TO recommendation_schema;

-- Products table
CREATE TABLE IF NOT EXISTS recommendation_schema.products (
    -- Primary Key
    id SERIAL PRIMARY KEY,

    -- Basic Information
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2),
    product_url VARCHAR(500),
    image_url VARCHAR(500),

    -- Target Specifications
    target_species VARCHAR(20) NOT NULL CHECK (target_species IN ('dog', 'cat')),
    min_age_months INT CHECK (min_age_months >= 0),
    max_age_months INT CHECK (max_age_months >= 0),
    min_weight_kg DECIMAL(5,2) CHECK (min_weight_kg >= 0),
    max_weight_kg DECIMAL(5,2) CHECK (max_weight_kg >= 0),
    suitable_breeds TEXT[],

    -- Nutritional Profile (0-100 percentages)
    protein_percentage DECIMAL(5,2) CHECK (protein_percentage >= 0 AND protein_percentage <= 100),
    fat_percentage DECIMAL(5,2) CHECK (fat_percentage >= 0 AND fat_percentage <= 100),
    fiber_percentage DECIMAL(5,2) CHECK (fiber_percentage >= 0 AND fiber_percentage <= 100),
    calories_per_100g INT CHECK (calories_per_100g > 0),

    -- Ingredient Flags
    grain_free BOOLEAN DEFAULT false NOT NULL,
    organic BOOLEAN DEFAULT false NOT NULL,
    hypoallergenic BOOLEAN DEFAULT false NOT NULL,
    limited_ingredient BOOLEAN DEFAULT false NOT NULL,
    raw_food BOOLEAN DEFAULT false NOT NULL,

    -- Health Condition Targeting
    for_sensitive_stomach BOOLEAN DEFAULT false NOT NULL,
    for_weight_management BOOLEAN DEFAULT false NOT NULL,
    for_joint_health BOOLEAN DEFAULT false NOT NULL,
    for_skin_allergies BOOLEAN DEFAULT false NOT NULL,
    for_dental_health BOOLEAN DEFAULT false NOT NULL,
    for_kidney_health BOOLEAN DEFAULT false NOT NULL,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,

    -- Constraints
    CONSTRAINT valid_age_range CHECK (
        (min_age_months IS NULL AND max_age_months IS NULL) OR
        (min_age_months IS NULL) OR
        (max_age_months IS NULL) OR
        (min_age_months <= max_age_months)
    ),
    CONSTRAINT valid_weight_range CHECK (
        (min_weight_kg IS NULL AND max_weight_kg IS NULL) OR
        (min_weight_kg IS NULL) OR
        (max_weight_kg IS NULL) OR
        (min_weight_kg <= max_weight_kg)
    )
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_products_species ON recommendation_schema.products(target_species);
CREATE INDEX IF NOT EXISTS idx_products_active ON recommendation_schema.products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_brand ON recommendation_schema.products(brand);
CREATE INDEX IF NOT EXISTS idx_products_suitable_breeds ON recommendation_schema.products USING GIN(suitable_breeds);

-- Recommendations table (history tracking)
CREATE TABLE IF NOT EXISTS recommendation_schema.recommendations (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    pet_id INT NOT NULL,
    product_id INT NOT NULL REFERENCES recommendation_schema.products(id),
    similarity_score DECIMAL(5,4) NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
    rank_position INT NOT NULL CHECK (rank_position > 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recommendations_user_pet ON recommendation_schema.recommendations(user_id, pet_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_created ON recommendation_schema.recommendations(created_at);

-- User feedback table (backlog - future supervised learning)
CREATE TABLE IF NOT EXISTS recommendation_schema.user_feedback (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    pet_id INT NOT NULL,
    product_id INT NOT NULL REFERENCES recommendation_schema.products(id),
    interaction_type VARCHAR(20) NOT NULL CHECK (interaction_type IN ('click', 'view', 'purchase', 'rating')),
    interaction_value DECIMAL(3,2),
    similarity_score DECIMAL(5,4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT valid_interaction_value CHECK (
        (interaction_type = 'rating' AND interaction_value BETWEEN 1.0 AND 5.0) OR
        (interaction_type != 'rating' AND interaction_value >= 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_user_feedback_product ON recommendation_schema.user_feedback(product_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_created ON recommendation_schema.user_feedback(created_at);
