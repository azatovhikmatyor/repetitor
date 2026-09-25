import { useMutation } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { api } from '@/lib/api/client'
import { useT } from '@/lib/i18n'

const ACCEPT = 'image/jpeg,image/png,image/webp'
const MAX_BYTES = 5 * 1024 * 1024

/**
 * Rasm yuklash — profil uchun ham, o'quvchi kartasi uchun ham.
 *
 * Tanlangan zahoti yuboriladi (alohida "saqlash" kerak emas). Server
 * rasmni 512×512 gacha kichraytiradi va eskisini o'chiradi.
 */
export function AvatarUploader<T>({
  src,
  name,
  path,
  onChange,
  size = 'size-20',
  label,
}: {
  src: string | null | undefined
  name: string | null | undefined
  /** Yuklash va o'chirish manzili, masalan `/students/12/avatar`. */
  path: string
  onChange: (updated: T) => void
  size?: string
  label?: string
}) {
  const toast = useToast()
  const t = useT()
  const inputRef = useRef<HTMLInputElement>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const upload = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return api.upload<T>(path, formData)
    },
    onSuccess: (updated) => {
      onChange(updated)
      toast.success(t.avatarUploader.uploadedToast)
    },
    onError: (error) => toast.error(error),
  })

  const remove = useMutation({
    mutationFn: () => api.delete<T>(path),
    onSuccess: (updated) => {
      onChange(updated)
      setConfirmRemove(false)
      toast.success(t.avatarUploader.deletedToast)
    },
    onError: (error) => {
      toast.error(error)
      setConfirmRemove(false)
    },
  })

  function pick(file: File | undefined) {
    if (!file) return
    // Server ham tekshiradi, lekin katta faylni bekorga yubormaymiz.
    if (file.size > MAX_BYTES) {
      toast.error(new Error(t.avatarUploader.sizeError))
      return
    }
    upload.mutate(file)
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar src={src} name={name} className={`${size} text-2xl`} />

      <div className="space-y-2">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(event) => {
            pick(event.target.files?.[0])
            // Bir xil faylni qayta tanlash ham hodisa bersin.
            event.target.value = ''
          }}
        />

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={upload.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {src ? t.avatarUploader.replace : (label ?? t.avatarUploader.upload)}
          </Button>
          {src && (
            <Button
              variant="danger-ghost"
              size="sm"
              onClick={() => setConfirmRemove(true)}
            >
              {t.common.delete}
            </Button>
          )}
        </div>
        <p className="text-xs text-slate-500">{t.avatarUploader.hint}</p>
      </div>

      <ConfirmModal
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        destructive
        title={t.avatarUploader.deleteConfirmTitle}
        message={t.avatarUploader.deleteConfirmMessage}
        confirmLabel={t.common.delete}
      />
    </div>
  )
}
