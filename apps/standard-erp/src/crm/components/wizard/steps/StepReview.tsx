import type { ReactNode } from 'react'
import {
  AMENITY_KEYS,
  AMENITY_LABELS,
  DOCUMENT_KEYS,
  DOCUMENT_LABELS,
  type SchemeFormData,
} from '../../../types/scheme'
import { calcCommonArea, formatCurrency, formatNumber } from '../../../lib/schemes'
import { Card } from '../../ui/Form'

function Row({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-line py-2.5 last:border-0 sm:grid-cols-3">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="text-sm font-medium text-ink sm:col-span-2">
        {value || '—'}
      </dd>
    </div>
  )
}

export function StepReview({ form }: { form: SchemeFormData }) {
  const selectedAmenities = AMENITY_KEYS.filter((k) => form.amenities[k])
  const uploadedDocs = DOCUMENT_KEYS.filter((k) => form.documents[k])
  const common = calcCommonArea(form)

  return (
    <div className="space-y-4">
      <Card
        title="Final Review"
        description="Confirm all details before publishing. You can still save as draft."
      >
        <p className="rounded-xl bg-brand-soft px-4 py-3 text-sm text-ink">
          Publishing makes this scheme available as the parent for blocks, plots,
          leads, bookings, and payments.
        </p>
      </Card>

      <Card title="Basic Information">
        <dl>
          <Row label="Scheme Name" value={form.schemeName} />
          <Row label="Scheme Code" value={<span className="font-mono">{form.schemeCode}</span>} />
          <Row label="Developer" value={form.developerCompany} />
          <Row label="Status" value={form.projectStatus} />
          <Row label="Launch Date" value={form.launchDate} />
          <Row label="Description" value={form.description} />
        </dl>
      </Card>

      <Card title="Location">
        <dl>
          <Row
            label="Region"
            value={[form.village, form.taluka, form.district, form.state, form.country]
              .filter(Boolean)
              .join(', ')}
          />
          <Row label="Survey No." value={form.surveyNumbers} />
          <Row label="TP / FP" value={[form.tpNumber, form.fpNumber].filter(Boolean).join(' / ')} />
          <Row label="Address" value={form.fullAddress} />
          <Row label="Coordinates" value={[form.latitude, form.longitude].filter(Boolean).join(', ')} />
          <Row
            label="Maps"
            value={
              form.googleMapsLink ? (
                <a
                  href={form.googleMapsLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand underline-offset-2 hover:underline"
                >
                  Open link
                </a>
              ) : undefined
            }
          />
        </dl>
      </Card>

      <Card title="Land Details">
        <dl>
          <Row
            label="Total Area"
            value={
              form.totalLandArea
                ? `${formatNumber(form.totalLandArea)} ${form.areaUnit}`
                : undefined
            }
          />
          <Row
            label="Saleable"
            value={
              form.saleableArea
                ? `${formatNumber(form.saleableArea)} ${form.areaUnit}`
                : undefined
            }
          />
          <Row
            label="Common Area"
            value={
              common !== null
                ? `${formatNumber(common)} ${form.areaUnit}`
                : undefined
            }
          />
          <Row label="Blocks" value={form.numberOfBlocks} />
          <Row label="Plots" value={form.totalNumberOfPlots} />
        </dl>
      </Card>

      <Card title="Amenities">
        {selectedAmenities.length ? (
          <div className="flex flex-wrap gap-2">
            {selectedAmenities.map((k) => (
              <span
                key={k}
                className="rounded-lg bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand"
              >
                {AMENITY_LABELS[k]}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-faint">No amenities selected</p>
        )}
        <dl className="mt-3">
          <Row
            label="Road widths"
            value={
              [form.internalRoadWidth && `Internal ${form.internalRoadWidth} ft`, form.mainRoadWidth && `Main ${form.mainRoadWidth} ft`]
                .filter(Boolean)
                .join(' · ')
            }
          />
          <Row label="Other" value={form.otherAmenities} />
        </dl>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Pricing">
          <dl>
            <Row label="Base Rate" value={formatCurrency(form.baseRatePerSqYard)} />
            <Row label="13 m road premium" value={form.roadWidthPremiums?.road13m || '—'} />
            <Row label="12 m road premium" value={form.roadWidthPremiums?.road12m || '—'} />
            <Row label="9 m road premium" value={form.roadWidthPremiums?.road9m || '—'} />
            <Row label="Development Charge" value={form.developmentCharge} />
            <Row
              label="Construction units"
              value={
                form.constructionUnits
                  ? ['1bhk', '2bhk', '3bhk', '4bhk']
                      .map((k) => {
                        const u =
                          form.constructionUnits[
                            k as keyof typeof form.constructionUnits
                          ]
                        return `${u.label}: ${u.areaSqYards || '—'} sq.yd @ ${u.ratePerSqYard || '—'} ₹/sq.yd`
                      })
                      .join(' · ')
                  : undefined
              }
            />
            <Row label="Garden Premium" value={form.gardenFacingPremium} />
            <Row label="PLC" value={formatCurrency(form.plcCharges)} />
            <Row label="Maintenance" value={formatCurrency(form.maintenanceCharges)} />
            <Row label="GST" value={form.gstApplicable ? 'Yes' : 'No'} />
            <Row
              label="Club deposit"
              value={formatCurrency(form.clubDepositAmount)}
            />
            <Row
              label="One-time maint. rate"
              value={
                form.oneTimeMaintenanceRate
                  ? `${formatCurrency(form.oneTimeMaintenanceRate)} / sq.yd`
                  : undefined
              }
            />
            <Row
              label="Phases"
              value={
                form.totalPhases
                  ? `${form.totalPhases} total · current ${form.currentPhase || '1'}`
                  : undefined
              }
            />
            <Row
              label="Running maint."
              value={
                form.runningMaintenanceRates?.length
                  ? form.runningMaintenanceRates
                      .map((r, i) => {
                        const mo =
                          form.runningMaintenanceMonths?.[i] || '12'
                        return `P${i + 1}: ${
                          r
                            ? `${formatCurrency(r)}/mo/sq.yd × ${mo} mo`
                            : '—'
                        }`
                      })
                      .join(' · ')
                  : undefined
              }
            />
          </dl>
        </Card>
        <Card title="Booking">
          <dl>
            <Row label="Min Booking" value={formatCurrency(form.minimumBookingAmount)} />
            <Row label="Booking Validity" value={form.bookingValidityDays ? `${form.bookingValidityDays} days` : undefined} />
            <Row label="Reservation Validity" value={form.reservationValidity ? `${form.reservationValidity} days` : undefined} />
            <Row label="Cancellation" value={form.cancellationCharges} />
            <Row label="Installments" value={form.installmentAvailable ? 'Yes' : 'No'} />
            <Row
              label="Payment plans"
              value={
                form.paymentPlans?.length
                  ? form.paymentPlans
                      .map(
                        (p) =>
                          `${p.name}: ${p.months} mo · Cheque ${p.chequePaymentPercent}% (+5% GST)`,
                      )
                      .join(' · ')
                  : form.paymentPlanMonths
                    ? `${form.paymentPlanMonths} months`
                    : undefined
              }
            />
          </dl>
        </Card>
      </div>

      <Card title="Documents">
        {uploadedDocs.length ? (
          <ul className="space-y-2">
            {uploadedDocs.map((k) => (
              <li key={k} className="flex items-center justify-between text-sm">
                <span className="text-ink-muted">{DOCUMENT_LABELS[k]}</span>
                <span className="font-medium text-ink">{form.documents[k]?.name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-faint">No documents uploaded</p>
        )}
      </Card>
    </div>
  )
}
