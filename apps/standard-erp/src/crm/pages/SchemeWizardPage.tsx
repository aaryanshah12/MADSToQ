import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from '@/crm/router'
import { ArrowLeft, ArrowRight, Save, Send } from 'lucide-react'
import { useSchemes } from '../context/SchemeContext'
import {
  type FieldErrors,
  validateStep,
} from '../lib/schemes'
import {
  createDefaultConstructionUnits,
  createEmptyScheme,
  DEFAULT_ROAD_WIDTH_PREMIUMS,
  normalizeOtherPaymentFields,
  normalizePaymentPlans,
  syncLegacyPaymentPlanFields,
  type SchemeFormData,
} from '../types/scheme'

function hydrateSchemeForm(source: SchemeFormData): SchemeFormData {
  const defaults = createDefaultConstructionUnits()
  const paymentPlans = normalizePaymentPlans(source)
  return {
    ...source,
    roadWidthPremiums: {
      ...DEFAULT_ROAD_WIDTH_PREMIUMS,
      ...source.roadWidthPremiums,
    },
    constructionUnits: {
      ...defaults,
      ...source.constructionUnits,
      '1bhk': { ...defaults['1bhk'], ...source.constructionUnits?.['1bhk'] },
      '2bhk': { ...defaults['2bhk'], ...source.constructionUnits?.['2bhk'] },
      '3bhk': { ...defaults['3bhk'], ...source.constructionUnits?.['3bhk'] },
      '4bhk': { ...defaults['4bhk'], ...source.constructionUnits?.['4bhk'] },
    },
    paymentPlans,
    ...syncLegacyPaymentPlanFields(paymentPlans),
    ...normalizeOtherPaymentFields(source),
  }
}
import { Button } from '../components/ui/Form'
import { WizardProgress } from '../components/wizard/WizardProgress'
import { StepBasicInfo } from '../components/wizard/steps/StepBasicInfo'
import { StepLocation } from '../components/wizard/steps/StepLocation'
import { StepLandDetails } from '../components/wizard/steps/StepLandDetails'
import { StepAmenities } from '../components/wizard/steps/StepAmenities'
import { StepPricing } from '../components/wizard/steps/StepPricing'
import { StepBooking } from '../components/wizard/steps/StepBooking'
import { StepDocuments } from '../components/wizard/steps/StepDocuments'
import { StepReview } from '../components/wizard/steps/StepReview'

const LAST_STEP = 7

export function SchemeWizardPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getScheme, saveScheme, nextSchemeCode } = useSchemes()
  const existing = id ? getScheme(id) : undefined

  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [toast, setToast] = useState<string | null>(null)
  const [form, setForm] = useState<SchemeFormData>(() =>
    existing
      ? hydrateSchemeForm(existing)
      : createEmptyScheme(nextSchemeCode()),
  )

  useEffect(() => {
    if (id && existing) {
      setForm(hydrateSchemeForm(existing))
    }
  }, [id, existing])

  const title = useMemo(
    () => form.schemeName.trim() || (existing ? 'Edit Scheme' : 'New Scheme'),
    [form.schemeName, existing],
  )

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2200)
  }

  const runValidate = (mode: 'next' | 'publish' | 'draft') => {
    const nextErrors = validateStep(step, form, mode)
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const goNext = () => {
    if (!runValidate('next')) return
    setStep((s) => Math.min(LAST_STEP, s + 1))
  }

  const goPrev = () => setStep((s) => Math.max(0, s - 1))

  const handleDraft = () => {
    if (!runValidate('draft')) {
      setStep(0)
      return
    }
    const record = saveScheme(form, 'draft', existing?.id)
    showToast('Draft saved')
    if (!existing) navigate(`/schemes/${record.id}/edit`, { replace: true })
  }

  const handlePublish = () => {
    const publishErrors = validateStep(step, form, 'publish')
    setErrors(publishErrors)
    if (Object.keys(publishErrors).length > 0) {
      const jump =
        publishErrors.schemeName || publishErrors.developerCompany
          ? 0
          : publishErrors.state || publishErrors.district
            ? 1
            : publishErrors.totalLandArea || publishErrors.totalNumberOfPlots
              ? 2
              : publishErrors.baseRatePerSqYard
                ? 4
                : publishErrors.minimumBookingAmount
                  ? 5
                  : step
      setStep(jump)
      showToast('Fix required fields to publish')
      return
    }

    const record = saveScheme(form, 'published', existing?.id)
    navigate(`/schemes/${record.id}/success`)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            All schemes
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="truncate font-display text-3xl tracking-tight text-ink">
              {title}
            </h1>
            <span
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize ${
                existing?.publishStatus === 'published'
                  ? 'bg-success-soft text-success'
                  : 'bg-warn-soft text-warn'
              }`}
            >
              {existing?.publishStatus ?? 'draft'}
            </span>
            <span className="rounded-lg bg-surface-2 px-2.5 py-1 font-mono text-xs text-ink-muted">
              {form.schemeCode}
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            Multi-step scheme setup · Step {step + 1} of {LAST_STEP + 1}
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-line bg-surface p-4">
        <WizardProgress current={step} onJump={setStep} />
      </div>

      {step === 0 && (
        <StepBasicInfo form={form} setForm={setForm} errors={errors} />
      )}
      {step === 1 && (
        <StepLocation form={form} setForm={setForm} errors={errors} />
      )}
      {step === 2 && (
        <StepLandDetails form={form} setForm={setForm} errors={errors} />
      )}
      {step === 3 && <StepAmenities form={form} setForm={setForm} />}
      {step === 4 && (
        <StepPricing form={form} setForm={setForm} errors={errors} />
      )}
      {step === 5 && (
        <StepBooking form={form} setForm={setForm} errors={errors} />
      )}
      {step === 6 && <StepDocuments form={form} setForm={setForm} />}
      {step === 7 && <StepReview form={form} />}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={goPrev}
              disabled={step === 0}
            >
              <ArrowLeft className="h-4 w-4" />
              Previous
            </Button>
            {step < LAST_STEP && (
              <Button type="button" variant="secondary" onClick={goNext}>
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handleDraft}>
              <Save className="h-4 w-4" />
              Save Draft
            </Button>
            <Button type="button" onClick={handlePublish}>
              <Send className="h-4 w-4" />
              Publish Scheme
            </Button>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-canvas shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
