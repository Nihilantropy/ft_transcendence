import {
  createAnalysis,
  createPet,
  deletePet,
  getPet,
  listPetAnalyses,
  listPets,
  updatePet,
} from '@/api/routes'
import type { Pet, PetAnalysis, PetPayload } from '@/api/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

// query key factory
export const petKeys = {
  all: ['pets'] as const,
  list: () => [...petKeys.all, 'list'] as const,
  detail: (id: string) => [...petKeys.all, 'detail', id] as const,
  analyses: (petId: string) => [...petKeys.all, 'analyses', petId] as const,
}

export const useListPets = () =>
  useQuery({
    queryKey: petKeys.list(),
    queryFn: listPets,
  })

export const useGetPet = (id: string | undefined) =>
  useQuery({
    queryKey: petKeys.detail(id ?? ''),
    queryFn: () => getPet(id as string),
    enabled: Boolean(id),
  })

export const useListPetAnalyses = (petId: string | undefined) =>
  useQuery({
    queryKey: petKeys.analyses(petId ?? ''),
    queryFn: () => listPetAnalyses(petId as string),
    enabled: Boolean(petId),
  })

// Mutations write the server's answer straight into the cache
export const useCreatePetMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createPet,
    onSuccess: (created) => {
      queryClient.setQueryData(petKeys.detail(created.id), created)
      queryClient.setQueryData<Pet[]>(petKeys.list(), (pets) => pets && [...pets, created])
      void queryClient.invalidateQueries({ queryKey: petKeys.list() })
    },
  })
}

export const useUpdatePetMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<PetPayload> }) =>
      updatePet(id, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(petKeys.detail(updated.id), updated)
      queryClient.setQueryData<Pet[]>(petKeys.list(), (pets) =>
        pets?.map((p) => (p.id === updated.id ? updated : p)),
      )
      void queryClient.invalidateQueries({ queryKey: petKeys.list() })
    },
  })
}

export const useDeletePetMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deletePet,
    onSuccess: (_, id) => {
      queryClient.setQueryData<Pet[]>(petKeys.list(), (pets) => pets?.filter((p) => p.id !== id))
      queryClient.removeQueries({ queryKey: petKeys.detail(id) })
      queryClient.removeQueries({ queryKey: petKeys.analyses(id) })
      void queryClient.invalidateQueries({ queryKey: petKeys.list() })
    },
  })
}

export const useCreateAnalysisMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createAnalysis,
    onSuccess: (analysis) => {
      // the backend lists analyses newest first
      queryClient.setQueryData<PetAnalysis[]>(
        petKeys.analyses(analysis.pet_id),
        (analyses) => analyses && [analysis, ...analyses],
      )
      void queryClient.invalidateQueries({ queryKey: petKeys.analyses(analysis.pet_id) })
    },
  })
}
