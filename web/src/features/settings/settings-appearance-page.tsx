import { PageHeader } from '@/components/layout/app-shell'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { ThemeSwitcher } from '@/components/ui/theme-switcher'
import { useT } from '@/lib/i18n'

export function SettingsAppearancePage() {
  const t = useT()

  return (
    <>
      <PageHeader
        title={t.settings.hubAppearanceRow}
        back={{ to: '/settings', label: t.settings.back }}
      />

      <div className="max-w-lg">
        <Card>
          <CardHeader title={t.settings.themeTitle} description={t.settings.themeDesc} />
          <CardBody>
            <ThemeSwitcher />
          </CardBody>
        </Card>
      </div>
    </>
  )
}
