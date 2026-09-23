import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { Icon } from '@/components/ui/icon'
import { Modal } from '@/components/ui/modal'
import { ErrorState, Loading } from '@/components/ui/states'
import { useToast } from '@/components/ui/toast'
import { api, ApiError } from '@/lib/api/client'
import { groupScheduleQuery } from '@/lib/api/queries'
import type { GroupSchedule, ScheduleVersion, SlotInput } from '@/lib/api/types'
import { cn } from '@/lib/cn'
import { formatDate, isoDate } from '@/lib/format'

const WEEKDAYS = [
  'Dushanba',
  'Seshanba',
  'Chorshanba',
  'Payshanba',
  'Juma',
  'Shanba',
  'Yakshanba',
]

/** `08:00:00` → `08:00` (HTML `type=time` shu ko'rinishni kutadi). */
function hhmm(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : ''
}

interface DraftSlot {
  weekday: number
  start_time: string
  end_time: string
}

function toDraft(version: ScheduleVersion | null): DraftSlot[] {
  if (!version) return []
  return version.slots.map((slot) => ({
    weekday: slot.weekday,
    start_time: hhmm(slot.start_time),
    end_time: hhmm(slot.end_time),
  }))
}

/**
 * Guruh jadvalini tahrirlash.
 *
 * Jadval versiyalangan: saqlash eskisini o'chirmaydi, balki ko'rsatilgan
 * sanadan boshlab yangisini ochadi. Shu sababli o'tgan oylarning darslari
 * va hisobotlari o'zgarmaydi — pastda o'zgarishlar tarixi ko'rinadi.
 */
export function ScheduleModal({
  groupId,
  onClose,
}: {
  groupId: number
  onClose: () => void
}) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const schedule = useQuery(groupScheduleQuery(groupId))

  if (schedule.isPending) {
    return (
      <Modal open onClose={onClose} title="Dars jadvali">
        <Loading rows={3} />
      </Modal>
    )
  }

  if (schedule.error) {
    return (
      <Modal open onClose={onClose} title="Dars jadvali">
        <ErrorState error={schedule.error} onRetry={() => void schedule.refetch()} />
      </Modal>
    )
  }

  return (
    <ScheduleForm
      groupId={groupId}
      schedule={schedule.data}
      onClose={onClose}
      onSaved={async () => {
        await queryClient.invalidateQueries({ queryKey: ['group', groupId] })
        await queryClient.invalidateQueries({ queryKey: ['groups'] })
        toast.success('Jadval saqlandi')
        onClose()
      }}
    />
  )
}

function ScheduleForm({
  groupId,
  schedule,
  onClose,
  onSaved,
}: {
  groupId: number
  schedule: GroupSchedule
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const toast = useToast()
  const [slots, setSlots] = useState<DraftSlot[]>(() => toDraft(schedule.current))
  const [effectiveFrom, setEffectiveFrom] = useState(isoDate(new Date()))
  const [showHistory, setShowHistory] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: () => {
      const payload: { effective_from: string; slots: SlotInput[] } = {
        effective_from: effectiveFrom,
        slots: slots.map((slot) => ({
          weekday: slot.weekday,
          start_time: slot.start_time,
          end_time: slot.end_time || null,
        })),
      }
      return api.put<GroupSchedule>(`/groups/${groupId}/schedule`, payload)
    },
    onSuccess: onSaved,
    onError: (issue) => {
      setError(issue instanceof ApiError ? issue.message : 'Xatolik')
      toast.error(issue)
    },
  })

  const addSlot = (weekday: number) =>
    setSlots((current) => [
      ...current,
      { weekday, start_time: '09:00', end_time: '' },
    ])

  const patch = (index: number, change: Partial<DraftSlot>) =>
    setSlots((current) =>
      current.map((slot, position) =>
        position === index ? { ...slot, ...change } : slot,
      ),
    )

  const remove = (index: number) =>
    setSlots((current) => current.filter((_, position) => position !== index))

  const incomplete = slots.some((slot) => !slot.start_time)

  return (
    <Modal
      open
      onClose={onClose}
      title="Dars jadvali"
      width="max-w-2xl"
      description="Bir kunda bir nechta dars bo'lishi mumkin — kunga yana qo'shing"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button
            loading={save.isPending}
            disabled={incomplete}
            onClick={() => save.mutate()}
          >
            Saqlash
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {WEEKDAYS.map((name, weekday) => {
          const dayslots = slots
            .map((slot, index) => ({ slot, index }))
            .filter((item) => item.slot.weekday === weekday)

          return (
            <div
              key={weekday}
              className={cn(
                'rounded-lg border p-3',
                dayslots.length > 0
                  ? 'border-brand-200 bg-brand-50/30'
                  : 'border-slate-200',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'text-sm font-medium',
                    dayslots.length > 0 ? 'text-slate-900' : 'text-slate-500',
                  )}
                >
                  {name}
                </span>
                <Button variant="ghost" size="sm" onClick={() => addSlot(weekday)}>
                  + Dars
                </Button>
              </div>

              {dayslots.map(({ slot, index }) => (
                <div key={index} className="mt-2 flex flex-wrap items-end gap-2">
                  <div className="w-28">
                    <Input
                      label="Boshlanish"
                      type="time"
                      value={slot.start_time}
                      onChange={(event) =>
                        patch(index, { start_time: event.target.value })
                      }
                    />
                  </div>
                  <div className="w-28">
                    <Input
                      label="Tugash"
                      type="time"
                      value={slot.end_time}
                      onChange={(event) =>
                        patch(index, { end_time: event.target.value })
                      }
                    />
                  </div>
                  <Button
                    variant="danger-ghost"
                    size="sm"
                    onClick={() => remove(index)}
                    aria-label="Darsni olib tashlash"
                  >
                    O&rsquo;chirish
                  </Button>
                </div>
              ))}
            </div>
          )
        })}

        <div className="rounded-lg border border-slate-200 p-3">
          <div className="w-44">
            <Input
              label="Qaysi sanadan"
              type="date"
              value={effectiveFrom}
              onChange={(event) => setEffectiveFrom(event.target.value)}
            />
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
            <Icon name="warning" className="mt-px size-4 shrink-0 text-partial" />
            Eski jadval o&rsquo;chmaydi: shu sanagacha bo&rsquo;lgan darslar va
            hisobotlar o&rsquo;zgarmaydi.
          </p>
        </div>

        {error && <p className="text-sm text-unpaid">{error}</p>}

        {schedule.history.length > 0 && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory((open) => !open)}
            >
              {showHistory ? 'Tarixni yashirish' : `Tarix (${schedule.history.length})`}
            </Button>

            {showHistory && (
              <ul className="mt-2 space-y-1 text-sm">
                {schedule.history.map((version) => (
                  <li
                    key={version.id}
                    className="flex flex-wrap justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"
                  >
                    <span className="text-slate-700">{version.display ?? '—'}</span>
                    <span className="text-xs text-slate-500">
                      {formatDate(version.effective_from)} &mdash;{' '}
                      {version.effective_to
                        ? formatDate(version.effective_to)
                        : 'hozirgacha'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
