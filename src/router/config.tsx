import type { RouteObject } from "react-router-dom";
import NotFound from "../pages/NotFound";
import Login from "../pages/login/page";
import Register from "../pages/register/page";
import ForgotPassword from "../pages/forgot-password/page";
import ResetPassword from "../pages/reset-password/page";
import Dashboard from "../pages/dashboard/page";
import LeaveApply from "../pages/leave/apply/page";
import LeaveRecords from "../pages/leave/records/page";
import AdminApproval from "../pages/admin/approval/page";
import AdminAnnouncements from "../pages/admin/announcements/page";
import Schedule from "../pages/schedule/page";
import Shift from "../pages/shift/page";
import Profile from "../pages/profile/page";
import AdminShift from "../pages/admin/shift/page";
import AdminEmployees from "../pages/admin/employees/page";

const routes: RouteObject[] = [
  {
    path: "/",
    element: <Login />,
  },
  {
    path: "/register",
    element: <Register />,
  },
  {
    path: "/forgot-password",
    element: <ForgotPassword />,
  },
  {
    path: "/reset-password",
    element: <ResetPassword />,
  },
  {
    path: "/dashboard",
    element: <Dashboard />,
  },
  {
    path: "/leave/apply",
    element: <LeaveApply />,
  },
  {
    path: "/leave/records",
    element: <LeaveRecords />,
  },
  {
    path: "/admin/approval",
    element: <AdminApproval />,
  },
  {
    path: "/admin/announcements",
    element: <AdminAnnouncements />,
  },
  {
    path: "/admin/shift",
    element: <AdminShift />,
  },
  {
    path: "/admin/employees",
    element: <AdminEmployees />,
  },
  {
    path: "/schedule",
    element: <Schedule />,
  },
  {
    path: "/shift",
    element: <Shift />,
  },
  {
    path: "/profile",
    element: <Profile />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;