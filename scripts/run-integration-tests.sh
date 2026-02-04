#!/bin/sh

# integration tests require 1) migration 2) seed 3) superuser
docker exec ft_transcendence_recommendation_service python -m pytest tests/integration/ -v