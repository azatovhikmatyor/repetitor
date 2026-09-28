import { PageHeader } from '@/components/layout/app-shell'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { useT } from '@/lib/i18n'

export function SettingsLanguagePage() {
  const t = useT()

  return (
    <>
      <PageHeader
        title={t.settings.hubLanguageRow}
        back={{ to: '/settings', label: t.settings.back }}
      />

      <div className="max-w-lg">
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
