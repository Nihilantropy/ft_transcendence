import { getFoodRecommendations } from '@/api/routes'
import type { Pet } from '@/api/types'
import { useQueries, useQuery } from '@tanstack/react-query'

export const recommendationKeys = {
  all: ['recommendations'] as const,
  food: (petId: string, limit?: number) =>
    [...recommendationKeys.all, 'food', petId, limit ?? 'default'] as const,
}

// the matches only change when a pet is edited
const RECOMMENDATIONS_QUERY_OPTIONS = { staleTime: 5 * 60_000, refetchOnWindowFocus: false }

export const useFoodRecommendations = (petId: string | undefined, limit?: number) =>
  useQuery({
    queryKey: recommendationKeys.food(petId ?? '', limit),
    queryFn: () => getFoodRecommendations(petId as string, limit),
    enabled: Boolean(petId),
    ...RECOMMENDATIONS_QUERY_OPTIONS,
  })

export const useFoodRecommendationsForPets = (pets: Pet[], limit?: number) =>
  useQueries({
    queries: pets.map((pet) => ({
      queryKey: recommendationKeys.food(pet.id, limit),
      queryFn: () => getFoodRecommendations(pet.id, limit),
      ...RECOMMENDATIONS_QUERY_OPTIONS,
    })),
  })
