import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'

import { PageHeader } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Stat } from '@/components/ui/stat'
import { ErrorState, Loading } from '@/components/ui/states'
import { adminStatsQuery } from '@/lib/api/queries'
import { useT } from '@/lib/i18n'

/**
 * Super Admin bosh sahifasi — platforma sog'ligi.
 *
 * Bu yerda ataylab moliyaviy raqamlar yo'q: super admin alohida
 * o'qituvchining daromadini ko'rmaydi (talab 9). Backend ham bu ma'lumotni
 * bermaydi.
 */
export function AdminStatsPage() {
  const t = useT()
  const { data, isPending, error, refetch } = useQuery(adminStatsQuery())

  return (
    <>
      <PageHeader
        title={t.admin.statsTitle}
        description={t.admin.statsDesc}
        actions={
          <Link to="/admin/teachers">
            <Button variant="secondary">{t.admin.teachersBtn}</Button>
          </Link>
        }
      />

      {isPending && <Loading rows={3} />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && (
        <div className="space-y-6">
          {data.pending_teacher_count > 0 && (
            <Card className="border-partial/40 bg-partial/5">
              <CardBody className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-700">
                  {t.admin.pendingNotice(data.pending_teacher_count)}
                </p>
                <Link to="/admin/teachers">
                  <Button size="sm">{t.admin.view}</Button>
                </Link>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title={t.admin.usersTitle} />
            <CardBody className="grid gap-6 sm:grid-cols-3">
              <Stat
                label={t.admin.teachersLabel}
                value={data.teacher_count}
                caption={t.admin.teachersCaption(
                  data.active_teacher_count,
                  data.pending_teacher_count,
                )}
              />
              <Stat label={t.admin.studentsLabel} value={data.student_count} />
              <Stat
                label={t.admin.groupsLabel}
                value={data.group_count}
                caption={t.admin.groupsCaption(data.active_group_count)}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t.admin.activityTitle} description={t.admin.activityDesc} />
            <CardBody className="grid gap-6 sm:grid-cols-3">
              <Stat
                label={t.admin.attendanceSessions}
                value={data.attendance_sessions_last_30_days}
              />
              <Stat label={t.admin.newTeachers} value={data.new_teachers_last_30_days} />
              <Stat label={t.admin.newGroups} value={data.new_groups_last_30_days} />
            </CardBody>
          </Card>

          <Card className="border-slate-200 bg-slate-100">
            <CardBody>
              <p className="text-sm text-slate-600">{t.admin.privacyNotice}</p>
            </CardBody>
          </Card>
        </div>
      )}
    </>
  )
}
