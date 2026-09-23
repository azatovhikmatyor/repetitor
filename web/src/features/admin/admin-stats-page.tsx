import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'

import { PageHeader } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Stat } from '@/components/ui/stat'
import { ErrorState, Loading } from '@/components/ui/states'
import { adminStatsQuery } from '@/lib/api/queries'

/**
 * Super Admin bosh sahifasi — platforma sog'ligi.
 *
 * Bu yerda ataylab moliyaviy raqamlar yo'q: super admin alohida
 * o'qituvchining daromadini ko'rmaydi (talab 9). Backend ham bu ma'lumotni
 * bermaydi.
 */
export function AdminStatsPage() {
  const { data, isPending, error, refetch } = useQuery(adminStatsQuery())

  return (
    <>
      <PageHeader
        title="Platforma"
        description="Umumiy ko&rsquo;rsatkichlar"
        actions={
          <Link to="/admin/teachers">
            <Button variant="secondary">O&rsquo;qituvchilar</Button>
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
                  <span className="font-semibold">{data.pending_teacher_count} ta</span>{' '}
                  o&rsquo;qituvchi tasdiqlashingizni kutmoqda.
                </p>
                <Link to="/admin/teachers">
                  <Button size="sm">Ko&rsquo;rish</Button>
                </Link>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Foydalanuvchilar" />
            <CardBody className="grid gap-6 sm:grid-cols-3">
              <Stat
                label="O&rsquo;qituvchilar"
                value={data.teacher_count}
                caption={`${data.active_teacher_count} faol · ${data.pending_teacher_count} kutmoqda`}
              />
              <Stat label="O&rsquo;quvchilar" value={data.student_count} />
              <Stat
                label="Guruhlar"
                value={data.group_count}
                caption={`${data.active_group_count} ta faol`}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Faollik"
              description="Oxirgi 30 kun"
            />
            <CardBody className="grid gap-6 sm:grid-cols-3">
              <Stat label="Davomat sessiyalari" value={data.attendance_sessions_last_30_days} />
              <Stat label="Yangi o&rsquo;qituvchilar" value={data.new_teachers_last_30_days} />
              <Stat label="Yangi guruhlar" value={data.new_groups_last_30_days} />
            </CardBody>
          </Card>

          <Card className="border-slate-200 bg-slate-100">
            <CardBody>
              <p className="text-sm text-slate-600">
                O&rsquo;qituvchilarning moliyaviy ma&rsquo;lumoti (daromad, to&rsquo;lovlar,
                qarzdorlar) shaxsiy hisoblanadi va bu panelda ko&rsquo;rsatilmaydi.
              </p>
            </CardBody>
          </Card>
        </div>
      )}
    </>
  )
}
