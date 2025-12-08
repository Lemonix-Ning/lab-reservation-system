import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
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

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/labs"} component={LabRoomList} />
      <Route path={"/my-reservations"} component={MyReservations} />
      <Route path={"/notifications"} component={NotificationCenter} />
      <Route path={"/courses"} component={CourseManage} />
      <Route path={"/student/courses"} component={StudentCourses} />
      <Route path={"/admin/labs"} component={LabRoomManage} />
      <Route path={"/admin/devices"} component={DeviceManage} />
      <Route path={"/admin/reservations"} component={ReservationManage} />
      <Route path={"/admin/rules"} component={RuleManage} />
      <Route path={"/admin/statistics"} component={StatisticsDashboard} />
      <Route path={"/admin/approval-config"} component={ApprovalConfig} />
      <Route path={"/admin/violations"} component={ViolationManage} />
      <Route path={"/admin/audit-logs"} component={AuditLog} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <DashboardLayout>
            <Router />
          </DashboardLayout>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
