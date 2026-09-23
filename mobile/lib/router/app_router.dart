import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/l10n/strings.dart';
import '../features/attendance/ui/attendance_screen.dart';
import '../features/attendance/ui/monthly_attendance_screen.dart';
import '../features/auth/state/auth_controller.dart';
import '../features/auth/ui/change_password_screen.dart';
import '../features/auth/ui/forgot_password_screen.dart';
import '../features/auth/ui/login_screen.dart';
import '../features/auth/ui/register_screen.dart';
import '../features/dashboard/ui/dashboard_screen.dart';
import '../features/groups/ui/group_detail_screen.dart';
import '../features/groups/ui/groups_screen.dart';
import '../features/payments/ui/group_payments_screen.dart';
import '../features/profile/ui/profile_screen.dart';
import '../features/reports/ui/reports_screen.dart';
import '../features/students/ui/student_detail_screen.dart';
import '../features/students/ui/students_screen.dart';

class Routes {
  const Routes._();

  static const login = '/login';
  static const register = '/register';
  static const forgotPassword = '/forgot-password';
  static const changePassword = '/change-password';

  // Pastki menyudagi beshta bo'lim.
  static const dashboard = '/dashboard';
  static const groups = '/groups';
  static const students = '/students';
  static const reports = '/reports';
  static const profile = '/profile';

  static String group(int id) => '/group/$id';
  static String attendance(int id) => '/group/$id/attendance';
  static String monthlyAttendance(int id) => '/group/$id/attendance/monthly';
  static String payments(int id) => '/group/$id/payments';
  static String student(int id) => '/student/$id';
}

final _rootKey = GlobalKey<NavigatorState>();

final appRouterProvider = Provider<GoRouter>((ref) {
  // Auth holati o'zgarganda router yo'naltirishni qayta hisoblaydi.
  final notifier = ValueNotifier(ref.read(authControllerProvider));
  ref.listen(authControllerProvider, (_, next) => notifier.value = next);
  ref.onDispose(notifier.dispose);

  return GoRouter(
    navigatorKey: _rootKey,
    initialLocation: Routes.dashboard,
    refreshListenable: notifier,
    redirect: (context, state) {
      final auth = notifier.value;
      final location = state.matchedLocation;

      // Saqlangan sessiya hali tekshirilmagan — splash ushlab turadi.
      if (!auth.isResolved) return null;

      const publicRoutes = [
        Routes.login,
        Routes.register,
        Routes.forgotPassword,
      ];
      final isPublic = publicRoutes.contains(location);

      if (!auth.isAuthenticated) {
        return isPublic ? null : Routes.login;
      }

      // Vaqtinchalik parol bilan kirgan foydalanuvchi boshqa ekranga
      // o'tolmaydi (talab 3).
      if (auth.status == AuthStatus.mustChangePassword) {
        return location == Routes.changePassword
            ? null
            : Routes.changePassword;
      }

      if (isPublic) return Routes.dashboard;
      return null;
    },
    routes: [
      GoRoute(
        path: Routes.login,
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: Routes.register,
        builder: (context, state) => const RegisterScreen(),
      ),
      GoRoute(
        path: Routes.forgotPassword,
        builder: (context, state) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: Routes.changePassword,
        builder: (context, state) => const ChangePasswordScreen(forced: true),
      ),

      // Detal ekranlari ataylab shell'dan tashqarida: ular bir nechta
      // bo'limdan ochiladi (masalan guruh kartasi ham bosh sahifada, ham
      // guruhlar ro'yxatida), shuning uchun ular butun ekranni egallaydi
      // va pastki menyu ko'rinmaydi.
      GoRoute(
        path: '/group/:groupId',
        builder: (context, state) => GroupDetailScreen(
          groupId: _id(state, 'groupId'),
        ),
        routes: [
          GoRoute(
            path: 'attendance',
            builder: (context, state) => AttendanceScreen(
              groupId: _id(state, 'groupId'),
            ),
            routes: [
              GoRoute(
                path: 'monthly',
                builder: (context, state) => MonthlyAttendanceScreen(
                  groupId: _id(state, 'groupId'),
                ),
              ),
            ],
          ),
          GoRoute(
            path: 'payments',
            builder: (context, state) => GroupPaymentsScreen(
              groupId: _id(state, 'groupId'),
            ),
          ),
        ],
      ),
      GoRoute(
        path: '/student/:studentId',
        builder: (context, state) => StudentDetailScreen(
          studentId: _id(state, 'studentId'),
        ),
      ),

      StatefulShellRoute.indexedStack(
        parentNavigatorKey: _rootKey,
        builder: (context, state, shell) => _HomeShell(shell: shell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Routes.dashboard,
                builder: (context, state) => const DashboardScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Routes.groups,
                builder: (context, state) => const GroupsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Routes.students,
                builder: (context, state) => const StudentsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Routes.reports,
                builder: (context, state) => const ReportsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Routes.profile,
                builder: (context, state) => const ProfileScreen(),
                routes: [
                  GoRoute(
                    path: 'password',
                    parentNavigatorKey: _rootKey,
                    builder: (context, state) =>
                        const ChangePasswordScreen(forced: false),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  );
});

int _id(GoRouterState state, String name) =>
    int.parse(state.pathParameters[name]!);

class _HomeShell extends StatelessWidget {
  const _HomeShell({required this.shell});

  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: shell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: shell.currentIndex,
        // Xuddi shu tabni qayta bosish o'sha bo'limning ildiziga qaytaradi.
        onDestinationSelected: (index) => shell.goBranch(
          index,
          initialLocation: index == shell.currentIndex,
        ),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home_rounded),
            label: S.home,
          ),
          NavigationDestination(
            icon: Icon(Icons.groups_outlined),
            selectedIcon: Icon(Icons.groups_rounded),
            label: S.groups,
          ),
          NavigationDestination(
            icon: Icon(Icons.person_search_outlined),
            selectedIcon: Icon(Icons.person_search_rounded),
            label: S.students,
          ),
          NavigationDestination(
            icon: Icon(Icons.bar_chart_outlined),
            selectedIcon: Icon(Icons.bar_chart_rounded),
            label: S.reports,
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline_rounded),
            selectedIcon: Icon(Icons.person_rounded),
            label: S.profile,
          ),
        ],
      ),
    );
  }
}
