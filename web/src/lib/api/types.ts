/**
 * Backend javoblarining tiplari.
 *
 * Maydonlar API'dagidek `snake_case` da qoldirilgan — shunda javobni
 * qayta nomlash qatlami kerak bo'lmaydi va Swagger bilan taqqoslash oson.
 */

export type UserRole = 'super_admin' | 'teacher' | 'student'

/** `pending` — ro'yxatdan o'tgan, lekin admin hali tasdiqlamagan. */
export type UserStatus = 'pending' | 'active' | 'blocked'

export interface User {
  id: number
  role: UserRole
  status: UserStatus
  first_name: string
  last_name: string | null
  /** Sharifi (otasining ismi) — profildan to'ldiriladi. */
  middle_name: string | null
  username: string | null
  phone: string | null
  email: string | null
  avatar_url: string | null
  must_change_password: boolean
  created_at: string
  last_login_at?: string | null
  /** Serverda hisoblanadi: `first_name last_name`. */
  full_name: string
  is_active: boolean
  /** False bo'lsa (email ham, telefon ham yo'q) parolni faqat admin tiklaydi. */
  can_reset_password_alone?: boolean
}

export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: string
  expires_at: string
  must_change_password: boolean
}

export interface LoginResponse extends TokenPair {
  user: User
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}

/** Backend'ning yagona xatolik shakli. */
export interface ApiErrorBody {
  code: string
  detail: string
  details?: unknown
}

export interface FieldError {
  field: string
  message: string
}

// --- Guruhlar ---

export type GroupStatus = 'active' | 'archived'

export interface Group {
  id: number
  name: string
  description: string | null
  monthly_fee: number
  /** Amaldagi jadvalning qisqa matni — jadvaldan hosil bo'ladi. */
  schedule: string | null
  /** Alohida narxlar hisobga olingan holda oylik kutilma. */
  expected_monthly: number
  status: GroupStatus
  archived_at: string | null
  created_at: string
  student_count: number
}

export interface StudentSummary {
  id: number
  first_name: string
  last_name: string | null
  phone: string | null
  username: string | null
  avatar_url: string | null
  status: UserStatus
  full_name: string
  is_active: boolean
  /** True — o'quvchi appga kirolmay o'qituvchisidan parol so'ragan. */
  password_reset_requested: boolean
}

export type EnrollmentStatus = 'active' | 'inactive'

/** Guruhdagi o'quvchi. "Enrollment" atamasi UI'da ko'rinmaydi. */
export interface GroupStudent {
  enrollment_id: number
  student: StudentSummary
  /** null — guruh narxi, 0 — bepul o'qiydi. */
  custom_fee: number | null
  fee_note: string | null
  monthly_fee: number
  /** Guruh narxidan qancha kam to'laydi. */
  discount: number
  status: EnrollmentStatus
  joined_on: string
  left_on: string | null
}

export interface AddStudentResponse {
  student: GroupStudent
  temporary_password: string | null
}

/** Ro'yxatdan o'tish javobi — token yo'q, hisob tasdiqlashni kutadi. */
export interface RegisterResponse {
  user_id: number
  username: string
  detail: string
}

export interface ForgotPasswordResponse {
  detail: string
  channel: 'email' | 'sms' | null
}

export interface StudentGroupRef {
  group_id: number
  group_name: string
  status: EnrollmentStatus
  monthly_fee: number
  joined_on: string
}

/** Ro'yxatdagi o'quvchi — kartada ko'rsatiladigan qo'shimchalar bilan. */
export interface StudentListItem extends StudentSummary {
  group_count: number
  group_names: string[]
  debt: number
  parent_name: string | null
  parent_phone: string | null
  school: string | null
}

export interface StudentDetail extends StudentSummary {
  middle_name: string | null
  birth_date: string | null
  parent_name: string | null
  parent_phone: string | null
  school: string | null
  note: string | null
  must_change_password: boolean
  last_login_at: string | null
  created_at: string
  groups: StudentGroupRef[]
}

// --- Davomat ---

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'

export interface AttendanceStudent {
  student_id: number
  full_name: string
  status: AttendanceStatus
}

/** Kundagi bitta dars — bir kunda ikkitasi bo'lishi mumkin. */
export interface DayLesson {
  start_time: string | null
  end_time: string | null
  session_id: number | null
  is_saved: boolean
  is_cancelled: boolean
}

export interface AttendanceSession {
  group_id: number
  session_date: string
  start_time: string | null
  day_lessons: DayLesson[]
  session_id: number | null
  is_saved: boolean
  is_cancelled: boolean
  is_editable: boolean
  note: string | null
  students: AttendanceStudent[]
  present_count: number
  absent_count: number
}

export interface MonthlyAttendanceRow {
  student_id: number
  full_name: string
  marks: Record<string, AttendanceStatus>
  present_count: number
  absent_count: number
  attendance_rate: number
}

/** Oylik jadvaldagi bitta ustun — bir dars. */
export interface MonthlyColumn {
  key: string
  lesson_date: string
  start_time: string | null
  is_planned: boolean
  is_saved: boolean
  is_cancelled: boolean
}

export interface MonthlyAttendance {
  group_id: number
  year: number
  month: number
  columns: MonthlyColumn[]
  students: MonthlyAttendanceRow[]
}

// --- Jadval ---

export interface ScheduleSlot {
  id: number
  weekday: number
  weekday_name: string
  start_time: string
  end_time: string | null
}

export interface ScheduleVersion {
  id: number
  effective_from: string
  effective_to: string | null
  note: string | null
  is_current: boolean
  display: string | null
  slots: ScheduleSlot[]
}

export interface GroupSchedule {
  group_id: number
  current: ScheduleVersion | null
  history: ScheduleVersion[]
}

export interface SlotInput {
  weekday: number
  start_time: string
  end_time?: string | null
}

export interface StudentGroupAttendance {
  group_id: number
  group_name: string
  total_sessions: number
  present_count: number
  absent_count: number
  late_count: number
  excused_count: number
  attendance_rate: number
}

/** O'quvchi kartasidagi davomat tarixi — bitta dars. */
export interface StudentAttendanceEntry {
  lesson_date: string
  start_time: string | null
  group_id: number
  group_name: string
  status: AttendanceStatus
}

export interface StudentAttendance {
  student_id: number
  full_name: string
  groups: StudentGroupAttendance[]
  recent: StudentAttendanceEntry[]
}

// --- To'lovlar ---

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other'
export type ChargeStatus = 'unpaid' | 'partial' | 'paid' | 'overpaid'

export interface Charge {
  charge_id: number
  student_id: number
  full_name: string
  amount_due: number
  amount_paid: number
  balance: number
  status: ChargeStatus
  note: string | null
}

export interface GroupMonth {
  group_id: number
  group_name: string
  year: number
  month: number
  total_due: number
  total_paid: number
  total_debt: number
  students: Charge[]
}

/** Qarzi bor bitta hisob — bosh sahifadagi "Qarz" raqamining tafsiloti. */
export interface Debtor extends GroupRef {
  charge_id: number
  student_id: number
  full_name: string
  phone: string | null
  amount_due: number
  amount_paid: number
  balance: number
}

export interface Debtors {
  year: number
  month: number
  total_debt: number
  items: Debtor[]
}

export interface Payment {
  id: number
  charge_id: number
  group_id: number
  group_name: string
  student_id: number
  full_name: string
  year: number
  month: number
  /** Musbat — to'lov, manfiy — bekor qilish yozuvi. */
  amount: number
  method: PaymentMethod
  paid_at: string
  note: string | null
  is_reversal: boolean
  reverses_id: number | null
  created_at: string
}

export interface StudentCharge extends Charge {
  group_id: number
  group_name: string
  year: number
  month: number
  payments: Payment[]
}

// --- Hisobotlar ---

export interface GroupRef {
  group_id: number
  group_name: string
}

/** Bugungi dars — bosh sahifadagi jadval uchun. */
export interface TodayLesson extends GroupRef {
  start_time: string | null
  end_time: string | null
  is_saved: boolean
  is_cancelled: boolean
  student_count: number
}

export interface DashboardGroupCard extends GroupRef {
  student_count: number
  total_due: number
  total_paid: number
  total_debt: number
  attendance_taken_today: boolean
}

export interface Dashboard {
  year: number
  month: number
  collected: number
  expected: number
  debt: number
  collection_rate: number
  debtor_count: number
  expenses: number
  profit: number
  active_group_count: number
  active_student_count: number
  groups: DashboardGroupCard[]
  today_lessons: TodayLesson[]
  groups_without_attendance_today: GroupRef[]
}

export interface MonthlyGroupSummary extends GroupRef {
  student_count: number
  total_due: number
  total_paid: number
  total_debt: number
  paid_count: number
  partial_count: number
  unpaid_count: number
}

export interface MonthlyReport {
  year: number
  month: number
  total_due: number
  total_paid: number
  total_debt: number
  total_expenses: number
  profit: number
  groups: MonthlyGroupSummary[]
}

export interface RevenuePoint {
  year: number
  month: number
  collected: number
  expected: number
  expenses: number
  profit: number
}

export interface GroupAttendanceRate extends GroupRef {
  session_count: number
  attendance_rate: number
}

export interface FrequentAbsentee {
  student_id: number
  full_name: string
  absent_count: number
  total_sessions: number
  attendance_rate: number
}

export interface AttendanceReport {
  groups: GroupAttendanceRate[]
  frequent_absentees: FrequentAbsentee[]
}

/** Ro'yxatni bir yo'la qo'shish natijasi. */
export interface ImportResultRow {
  line: number
  full_name: string
  student_id: number | null
  temporary_password: string | null
  error: string | null
}

export interface ImportResult {
  added: number
  failed: number
  rows: ImportResultRow[]
}

// --- Xarajatlar ---

export type ExpenseCategory =
  | 'rent'
  | 'salary'
  | 'utilities'
  | 'marketing'
  | 'supplies'
  | 'other'

export interface Expense {
  id: number
  title: string
  amount: number
  category: ExpenseCategory
  spent_on: string
  note: string | null
  is_recurring: boolean
}

export interface CategoryTotal {
  category: ExpenseCategory
  total: number
  count: number
}

export interface ExpenseMonth {
  year: number
  month: number
  total: number
  collected: number
  /** collected − total. Manfiy bo'lishi mumkin. */
  profit: number
  by_category: CategoryTotal[]
  items: Expense[]
}

export interface CopyPreviousResult {
  copied: number
  skipped: number
}

// --- Admin ---

export interface Teacher {
  id: number
  first_name: string
  last_name: string | null
  middle_name: string | null
  username: string | null
  email: string | null
  phone: string | null
  avatar_url: string | null
  status: UserStatus
  created_at: string
  approved_at: string | null
  last_login_at: string | null
  active_group_count: number
  student_count: number
  full_name: string
  can_reset_password_alone: boolean
}

/** O'chirishdan oldin nima yo'qolishi. */
export interface TeacherDeletePreview {
  teacher_id: number
  full_name: string
  group_count: number
  student_count: number
  attendance_session_count: number
  payment_count: number
  total_collected: number
}

export interface AdminStats {
  teacher_count: number
  active_teacher_count: number
  pending_teacher_count: number
  student_count: number
  group_count: number
  active_group_count: number
  attendance_sessions_last_30_days: number
  new_teachers_last_30_days: number
  new_groups_last_30_days: number
}

// --- Kvizlar ---

export type QuestionType = 'single_choice' | 'multi_choice' | 'text' | 'essay'
export type QuizMode = 'practice' | 'exam'
export type ScoreRule = 'best' | 'average' | 'latest'
export type AttemptStatus = 'in_progress' | 'submitted' | 'graded'

export interface QuestionOption {
  id: string
  text: string
}

/** O'qituvchi ko'rinishi — to'g'ri javob bilan. */
export interface Question {
  id: number
  order_index: number
  type: QuestionType
  prompt: string
  media_url: string | null
  options: QuestionOption[] | null
  correct_answer: unknown
  points: number
}

/** O'quvchi test yechayotgandagi ko'rinish — to'g'ri javobsiz. */
export interface QuestionPlay {
  id: number
  order_index: number
  type: QuestionType
  prompt: string
  media_url: string | null
  options: QuestionOption[] | null
  points: number
}

export interface QuizSection {
  id: number
  order_index: number
  title: string
  instructions: string | null
  questions: Question[]
}

export interface QuizSectionPlay {
  id: number
  order_index: number
  title: string
  instructions: string | null
  questions: QuestionPlay[]
}

export interface QuizSummary {
  id: number
  subject: string
  title: string
  description: string | null
  is_catalog: boolean
  time_limit_minutes: number | null
  question_count: number
  /** Katalog ro'yxatida: shu o'qituvchi obuna bo'lganmi. */
  is_subscribed: boolean
}

export interface Quiz extends QuizSummary {
  sections: QuizSection[]
}

export interface QuizPlay {
  id: number
  title: string
  time_limit_minutes: number | null
  sections: QuizSectionPlay[]
}

export interface QuizAssignment {
  id: number
  quiz_id: number
  quiz_title: string
  group_id: number
  group_name: string
  mode: QuizMode
  max_attempts: number | null
  score_rule: ScoreRule
  deadline: string | null
  notified_at: string | null
  created_at: string
}

export interface StudentAssignment extends QuizAssignment {
  attempts_used: number
}

export interface AttemptStart {
  attempt_id: number
  attempt_no: number
  max_attempts: number | null
  started_at: string
  quiz: QuizPlay
}

export interface AttemptResult {
  attempt_id: number
  status: AttemptStatus
  auto_score: number | null
  manual_score: number | null
  total_score: number | null
  max_score: number | null
  pending_manual_grading: boolean
}

export interface AttemptHistoryItem {
  attempt_id: number
  assignment_id: number
  quiz_title: string
  mode: QuizMode
  attempt_no: number
  status: AttemptStatus
  total_score: number | null
  max_score: number | null
  submitted_at: string | null
}

export interface PendingQuestion {
  question_id: number
  prompt: string
  student_answer: unknown
  max_points: number
}

export interface PendingGradingItem {
  attempt_id: number
  student_id: number
  student_name: string
  submitted_at: string | null
  questions: PendingQuestion[]
}

export interface RankingEntry {
  student_id: number
  student_name: string
  score: number
  rank: number
  out_of: number
}

export interface AssignmentResults {
  assignment_id: number
  fully_graded: boolean
  entries: RankingEntry[]
}
