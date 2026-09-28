import { Link } from 'react-router'

import { PageHeader } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { useT } from '@/lib/i18n'

export function SettingsSecurityPage() {
  const t = useT()

  return (
    <>
      <PageHeader
        title={t.settings.hubSecurityRow}
        back={{ to: '/settings', label: t.settings.back }}
      />

      <div className="max-w-lg">
        <Card>
          <CardHeader title={t.profile.changePassword} />
          <CardBody>
            <Link to="/change-password">
              <Button variant="secondary">{t.profile.changePassword}</Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    </>
  )
}
