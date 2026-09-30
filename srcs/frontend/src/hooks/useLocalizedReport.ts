import { saveReportTranslation, translateReport } from '@/api/routes'
import type { ReportTranslation, VisionAnalysisData } from '@/api/types'
import type { Language } from '@/i18n/i18n'
import { petKeys } from '@/queries/pets'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

export function useLocalizedReport(
  data: VisionAnalysisData,
  // the saved analysis, to store the translation on
  // absent for a fresh result in the chat
  analysisId?: string,
): { report: VisionAnalysisData; isTranslating: boolean } {
  const { i18n } = useTranslation()
  const queryClient = useQueryClient()
  const target = (i18n.resolvedLanguage ?? 'it') as Language
  const stored = data.translations?.[target]
  // reports saved before the language was stored have none: translated too, the LLM reads the source itself (and returns a text already in the target unchanged)
  const needsTranslation = data.language !== target && !stored

  const { data: translated, isFetching } = useQuery({
    queryKey: ['reportTranslation', analysisId ?? data.description, target],
    queryFn: async (): Promise<ReportTranslation> => {
      const observations = data.health_observations ?? []
      const [description = '', temperament = '', ...health] = await translateReport(
        [data.description, data.traits.temperament ?? '', ...observations],
        target,
      )
      const translation = { description, temperament, health_observations: health }
      if (analysisId) {
        // storing only saves the next call: if it fails the translation is still shown, and it is simply requested again next time
        await saveReportTranslation(analysisId, target, translation).then(
          () => queryClient.invalidateQueries({ queryKey: [...petKeys.all, 'analyses'] }),
          () => undefined,
        )
      }
      return translation
    },
    enabled: needsTranslation,
    staleTime: Infinity,
    retry: false,
  })

  const translation = stored ?? translated
  if (!translation) return { report: data, isTranslating: isFetching }
  return {
    report: {
      ...data,
      description: translation.description,
      traits: { ...data.traits, temperament: translation.temperament },
      health_observations: translation.health_observations,
    },
    isTranslating: false,
  }
}
