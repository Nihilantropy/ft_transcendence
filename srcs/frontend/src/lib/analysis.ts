import {
  ANALYSIS_IMAGE_PLACEHOLDER,
  type AnalysisPayload,
  type PetPayload,
  type Species,
  type VisionAnalysisData,
} from '@/api/types'

// what the chat hands to /pets/new when there is no pet to save the analysis to yet
export interface NewPetFromAnalysisState {
  analysis: VisionAnalysisData
  // the analyzed photo, as a data URL
  photo?: string
}

// the AI only answers for dogs and cats
export const detectedSpecies = (data: VisionAnalysisData): Species | null =>
  data.species === 'cat' || data.species === 'dog' ? data.species : null

// the record that saves an analysis on a pet
export const toAnalysisPayload = (
  data: VisionAnalysisData,
  petId: string,
  userId: string,
): AnalysisPayload => ({
  pet_id: petId,
  user_id: userId,
  image_url: ANALYSIS_IMAGE_PLACEHOLDER,
  breed_detected: data.breed_analysis.primary_breed,
  confidence: data.breed_analysis.confidence,
  traits: data.traits,
  raw_response: data,
})

// a pet created for an analysis: its species and breed are the ones the analysis found, whatever was picked in the form
// without a photo of its own it gets the analyzed one
export function applyAnalysisToPet(
  payload: PetPayload,
  { analysis, photo }: NewPetFromAnalysisState,
): PetPayload {
  const species = detectedSpecies(analysis)
  return {
    ...payload,
    ...(species && {
      species,
      breed: analysis.breed_analysis.primary_breed,
      breed_confidence: analysis.breed_analysis.confidence,
    }),
    photo: payload.photo || photo || '',
  }
}
