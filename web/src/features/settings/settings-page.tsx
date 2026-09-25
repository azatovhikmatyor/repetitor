import { PageHeader } from '@/components/layout/app-shell'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { ThemeSwitcher } from '@/components/ui/theme-switcher'
import { useT } from '@/lib/i18n'

/**
 * Sozlamalar — foydalanuvchi ilovani qanday ko'rishini tanlaydigan joy.
 *
 * Til va tema bor, lekin karta tuzilmasi shu maqsadda: keyinchalik shrift
 * o'lchami va shunga o'xshash sozlamalar shu yerga alohida karta bo'lib
 * qo'shiladi.
 */
export function SettingsPage() {
  const t = useT()

  return (
    <>
      <PageHeader title={t.settings.title} back={{ to: '/profile', label: t.settings.back }} />

      <div className="max-w-lg space-y-6">
        <Card>
          <CardHeader title={t.settings.themeTitle} description={t.settings.themeDesc} />
          <CardBody>
            <ThemeSwitcher />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t.settings.languageTitle} description={t.settings.languageDesc} />
          <CardBody>
            <LanguageSwitcher />
          </CardBody>
        </Card>
      </div>
    </>
  )
}
