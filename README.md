# SmartBreeds Identifier & Health Monitor
This application utilizes AI-powered computer vision to identify and classify images of dogs and cats. It leverages deep learning models to provide accurate recognition and categorization of various breeds. Additionally, the user can chat with an AI to provide information about his pet, including birth date or age, weight, and health conditions. Based on this information, the AI can offer health monitoring suggestions and recommend top-quality products tailored to the specific breed.

## Features
- Image upload functionality for users to submit pictures of dogs and cats.
- AI-powered image recognition to classify the breed of the animal in the image.
- Ai-generated descriptions and information about the identified breed.
- Ai-powered pedegree analisys and validation.
- Health monitoring suggestions based on breed characteristics.
- Top quality production suggestions for food, toys, and accessories tailored to the identified breed.

## Target Audience
- Luxury pet owners looking to identify and learn more about their pets.
- Veterinarians seeking quick breed identification and health monitoring tools.
- Luxury pet product retailers aiming to provide personalized recommendations.

## Technologies Used
- Docker for containerization and deployment.
- Nginx for reverse proxy.
- Redis for caching and session management.
- ollama backend server for AI model hosting.
  - multimodal model: qwen3-vl:8b for image recognition, analysis and description generation.
- React for frontend development.
- Tailwind CSS for styling and responsive design.
- Django for api-gateway routing.
- Django for backend micro-service.
- PostgreSQL for database management.
- Blockchain integration for pedigree validation and tracking. (backlog feature)