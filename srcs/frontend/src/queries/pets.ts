import { createPet, deletePet, getPet, listPetAnalyses, listPets, updatePet } from '@/api/routes'
import type { PetPayload } from '@/api/types'
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

export const useCreatePetMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createPet,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: petKeys.list() })
    },
  })
}

export const useUpdatePetMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<PetPayload> }) =>
      updatePet(id, payload),
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: petKeys.list() })
      void queryClient.invalidateQueries({ queryKey: petKeys.detail(id) })
    },
  })
}

export const useDeletePetMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deletePet,
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: petKeys.list() })
      queryClient.removeQueries({ queryKey: petKeys.detail(id) })
    },
  })
}
