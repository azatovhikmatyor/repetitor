import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { api } from '@/lib/api/client'
import { qk } from '@/lib/api/queries'
import type { ImportResult } from '@/lib/api/types'
import { money } from '@/lib/format'

interface ParsedRow {
  first_name: string
  last_name?: string
  phone?: string
  custom_fee?: number
}

/**
 * Bitta qatorni ajratadi.
 *
 * Kutilgan ko'rinish: `Ism Familiya, +998901234567, 350000`. Ajratgich
 * vergul ham, tabulyatsiya ham bo'lishi mumkin — Excel'dan nusxa
 * ko'chirilganda tab bilan keladi.
 */
function parseLine(line: string): ParsedRow | null {
  const parts = line
    .split(/[\t;,]/)
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length === 0) return null

  const [name, ...rest] = parts
  const words = name.split(/\s+/)
  const row: ParsedRow = {
    first_name: words[0],
    last_name: words.slice(1).join(' ') || undefined,
  }

  for (const value of rest) {
    const digits = value.replace(/[^\d+]/g, '')
    // Telefon "+" bilan yoki 7 ta raqamdan uzun; qolgani — narx.
    if (digits.startsWith('+') || digits.length >= 7) {
      row.phone ??= digits
    } else if (digits) {
      row.custom_fee = Number(digits)
    }
  }

  // Narx alohida ustunda katta son bo'lib kelishi mumkin.
  const fee = rest.find((value) => /^\d{4,7}$/.test(value.replace(/\s/g, '')))
  if (fee && !row.phone?.includes(fee)) {
    row.custom_fee ??= Number(fee.replace(/\s/g, ''))
  }

  return row.first_name.length >= 2 ? row : null
}

/**
 * O'quvchilar ro'yxatini bir yo'la qo'shish.
 *
 * 20 kishilik guruhni bittalab kiritish zerikarli — bu yerda ro'yxat
 * Excel yoki bloknotdan nusxa ko'chiriladi. Yuborishdan oldin nima
 * tushunilgani jadval bo'lib ko'rsatiladi.
 */
export function ImportStudentsModal({
  groupId,
  groupFee,
  onClose,
}: {
  groupId: number
  groupFee: number
  onClose: () => void
}) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)

  const rows = text
    .split('\n')
    .map(parseLine)
    .filter((row): row is ParsedRow => row !== null)

  const skipped = text.split('\n').filter((line) => line.trim()).length - rows.length

  const upload = useMutation({
    mutationFn: () =>
      api.post<ImportResult>(`/groups/${groupId}/students/import`, { rows }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['group', groupId] })
      await queryClient.invalidateQueries({ queryKey: ['groups'] })
      await queryClient.invalidateQueries({ queryKey: ['students'] })
      await queryClient.invalidateQueries({ queryKey: qk.dashboard })
      setResult(data)
    },
    onError: (error) => toast.error(error),
  })

  if (result) {
    return (
      <Modal
        open
        onClose={onClose}
        title="Import natijasi"
        width="max-w-2xl"
        footer={<Button onClick={onClose}>Yopish</Button>}
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            <span className="font-medium text-paid">{result.added} ta qo&rsquo;shildi</span>
            {result.failed > 0 && (
              <>
                {' · '}
                <span className="font-medium text-unpaid">
                  {result.failed} ta o&rsquo;tkazib yuborildi
                </span>
              </>
            )}
          </p>

          {/*
            Vaqtinchalik parollar faqat shu yerda ko'rinadi — keyin
            ularni tiklashdan boshqa yo'l yo'q, shuning uchun nusxa
            olish tugmasi bor.
          */}
          <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {result.rows.map((row) => (
                  <tr key={row.line}>
                    <td className="px-3 py-2 text-slate-400">{row.line}</td>
                    <td className="px-3 py-2 font-medium text-slate-800">
                      {row.full_name}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {row.error ? (
                        <span className="text-xs text-unpaid">{row.error}</span>
                      ) : (
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                          {row.temporary_password}
                        </code>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result.added > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const lines = result.rows
                  .filter((row) => row.temporary_password)
                  .map((row) => `${row.full_name}: ${row.temporary_password}`)
                void navigator.clipboard.writeText(lines.join('\n'))
                toast.success('Parollar nusxalandi')
              }}
            >
              Parollarni nusxalash
            </Button>
          )}
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Ro&rsquo;yxatni qo&rsquo;shish"
      description="Excel yoki bloknotdan nusxa ko'chiring — har bir o'quvchi alohida qatorda"
      width="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button
            loading={upload.isPending}
            disabled={rows.length === 0}
            onClick={() => upload.mutate()}
          >
            {rows.length > 0 ? `${rows.length} tasini qo'shish` : "Qo'shish"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Textarea
          label="Ro&rsquo;yxat"
          rows={7}
          value={text}
          placeholder={
            'Aziza Rahimova, +998901234567\n' +
            'Bekzod To‘rayev, +998901234568, 350000\n' +
            'Dilnoza Yusupova, +998901234569'
          }
          hint="Ism Familiya, telefon, (ixtiyoriy) oylik narx"
          onChange={setText}
        />

        {rows.length > 0 && (
          <div className="rounded-lg border border-slate-200">
            <p className="border-b border-slate-100 px-3 py-2 text-xs text-slate-500">
              Shunday tushunildi:
            </p>
            <div className="max-h-56 overflow-y-auto">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, index) => (
                    <tr key={index}>
                      <td className="px-3 py-1.5 font-medium text-slate-800">
                        {row.first_name} {row.last_name ?? ''}
                      </td>
                      <td className="px-3 py-1.5 text-slate-500">
                        {row.phone ?? (
                          <span className="text-unpaid">telefon yo&rsquo;q</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-500">
                        {row.custom_fee === undefined ? (
                          money(groupFee)
                        ) : row.custom_fee === 0 ? (
                          <Badge tone="brand">Bepul</Badge>
                        ) : (
                          money(row.custom_fee)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {skipped > 0 && (
          <p className="text-xs text-partial">
            {skipped} ta qator tushunilmadi &mdash; ism kamida 2 harf bo&rsquo;lsin.
          </p>
        )}
      </div>
    </Modal>
  )
}
