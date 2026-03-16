import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import { RoleProvider } from "./contexts/RoleContext";
import { PermissionProvider } from "./contexts/PermissionContext";
import Home from "./pages/Home";
import LabRoomList from "./pages/LabRoomList";
import LabRoomManage from "./pages/LabRoomManage";
import DeviceManage from "./pages/DeviceManage";
import MyReservations from "./pages/MyReservations";
import ReservationManage from "./pages/ReservationManage";
import RuleManage from "./pages/RuleManage";
import StatisticsDashboard from "./pages/StatisticsDashboard";
import NotificationCenter from "./pages/NotificationCenter";
import ApprovalConfig from "./pages/ApprovalConfig";
import ViolationManage from "./pages/ViolationManage";
import AuditLog from "./pages/AuditLog";
import CourseManage from "./pages/CourseManage";
import StudentCourses from "./pages/StudentCourses";
import CalendarDashboard from "./pages/CalendarDashboard";
import ClassCheckin from "./pages/ClassCheckin";
import StudentCheckin from "./pages/StudentCheckin";
import CheckinScan from "./pages/CheckinScan";
import BlockedPeriodManage from "./pages/BlockedPeriodManage";
import ScheduleBoard from "./pages/ScheduleBoard";
import OpeningRuleManage from "./pages/OpeningRuleManage";
import GeofenceManage from "./pages/GeofenceManage";
import SystemSettings from "./pages/SystemSettings";
import PermissionManage from "./pages/PermissionManage";
import RoleUpgradeRequest from "./pages/RoleUpgradeRequest";
import RoleRequestReview from "./pages/RoleRequestReview";
import WhitelistManage from "./pages/WhitelistManage";
import Login from "./pages/Login";
import AccountBindings from "./pages/AccountBindings";
import AccountProfile from "./pages/AccountProfile";
import AccountDelete from "./pages/AccountDelete";
import OAuthDebug from "./pages/OAuthDebug";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/labs"} component={LabRoomList} />
      <Route path={"/my-reservations"} component={MyReservations} />
      <Route path={"/notifications"} component={NotificationCenter} />
      <Route path={"/courses"} component={CourseManage} />
      <Route path={"/class-checkin"} component={ClassCheckin} />
      <Route path={"/student/courses"} component={StudentCourses} />
      <Route path={"/student/checkin"} component={StudentCheckin} />
      <Route path={"/calendar"} component={CalendarDashboard} />
      <Route path={"/schedule-board"} component={ScheduleBoard} />
      <Route path={"/account/profile"} component={AccountProfile} />
      <Route path={"/account/bindings"} component={AccountBindings} />
      <Route path={"/account/role-request"} component={RoleUpgradeRequest} />
      <Route path={"/account/delete"} component={AccountDelete} />
      {import.meta.env.DEV && <Route path={"/oauth/debug"} component={OAuthDebug} />}
      <Route path={"/admin/labs"} component={LabRoomManage} />
      <Route path={"/admin/devices"} component={DeviceManage} />
      <Route path={"/admin/reservations"} component={ReservationManage} />
      <Route path={"/admin/rules"} component={RuleManage} />
      <Route path={"/admin/statistics"} component={StatisticsDashboard} />
      <Route path={"/admin/approval-config"} component={ApprovalConfig} />
      <Route path={"/admin/violations"} component={ViolationManage} />
      <Route path={"/admin/audit-logs"} component={AuditLog} />
      <Route path={"/admin/opening-rules"} component={OpeningRuleManage} />
      <Route path={"/admin/blocked-periods"} component={BlockedPeriodManage} />
      <Route path={"/admin/geofences"} component={GeofenceManage} />
      <Route path={"/admin/settings"} component={SystemSettings} />
      <Route path={"/admin/permissions"} component={PermissionManage} />
      <Route path={"/admin/role-requests"} component={RoleRequestReview} />
      <Route path={"/admin/whitelist"} component={WhitelistManage} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <RoleProvider>
          <PermissionProvider>
            <TooltipProvider>
              <Toaster />
              <Switch>
                {/* 独立页面（不需要DashboardLayout） */}
                <Route path="/login" component={Login} />
                <Route path="/checkin" component={CheckinScan} />
                {/* 需要DashboardLayout的页面 */}
                <Route>
                  <DashboardLayout>
                    <Router />
                  </DashboardLayout>
                </Route>
              </Switch>
            </TooltipProvider>
          </PermissionProvider>
        </RoleProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
