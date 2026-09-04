import { baseApi } from "./baseApi";

export type DashboardArgs = {
  dateFrom?: string;
  dateTo?: string;
};

export type DashboardStats = {
  total_jobs: number;
  by_status: Record<string, number>;
  overdue: number;
  due_7: number;
  service_revenue: number;
  sales_revenue: number;
  total_revenue: number;
  pipeline_value: number;
  total_km: number;
  active_staff: number;
  total_staff: number;
  plans_count: number;
  installs_completed: number;
  completions_count: number;
};

export type DashboardTopProduct = {
  product_id: string;
  product_name: string;
  qty: number;
  revenue: number;
};

export type DashboardUpcomingJob = {
  id: string;
  name: string;
  address: string;
  service_date: string;
  service_time: string | null;
};

export type DashboardRecentCompletion = {
  id: string;
  name: string;
  service_date: string;
  service_value: number;
};

export type DashboardData = {
  stats: DashboardStats;
  top_products: DashboardTopProduct[];
  upcoming_jobs: DashboardUpcomingJob[];
  recent_completions: DashboardRecentCompletion[];
};

export type StaffReportArgs = {
  staffId: string;
  dateFrom?: string;
  dateTo?: string;
};

export type StaffReportPlan = {
  id: string;
  plan_date: string;
  name: string;
  base_name: string | null;
  stops: number;
  road_km: number | null;
  road_minutes: number | null;
  completed_value: number;
  completed_count: number;
};

export type StaffReportJob = {
  id: string;
  service_date: string;
  service_time: string | null;
  name: string;
  address: string;
  service_type: string;
  status: string;
  service_value: number;
  actual_time: string | null;
  travel_km: number | null;
  travel_min: number | null;
  actual_km: number | null;
  is_completed: boolean;
};

export type StaffReportTotals = {
  plans_count: number;
  jobs_count: number;
  completed_count: number;
  allocated_km: number;
  allocated_min: number;
  actual_km: number;
  service_revenue: number;
  service_count: number;
  install_revenue: number;
  install_count: number;
  workshop_count: number;
  workshop_hours: number;
};

export type StaffReportData = {
  plans: StaffReportPlan[];
  jobs: StaffReportJob[];
  totals: StaffReportTotals;
};

export type StaffReportSummaryArgs = {
  dateFrom?: string;
  dateTo?: string;
};

export type StaffReportSummaryRow = StaffReportTotals & {
  id: string;
  name: string;
  active: boolean;
  total_revenue: number;
};

export type StaffReportSummaryData = {
  staff: StaffReportSummaryRow[];
};

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getDashboard: build.query<DashboardData, DashboardArgs | void>({
      query: (args) => {
        const params = new URLSearchParams();
        if (args?.dateFrom) params.set("date_from", args.dateFrom);
        if (args?.dateTo) params.set("date_to", args.dateTo);
        return `/dashboard/?${params.toString()}`;
      },
    }),
    getStaffReport: build.query<StaffReportData, StaffReportArgs>({
      query: ({ staffId, dateFrom, dateTo }) => {
        const params = new URLSearchParams({ staff_id: staffId });
        if (dateFrom) params.set("date_from", dateFrom);
        if (dateTo) params.set("date_to", dateTo);
        return `/dashboard/staff-report/?${params.toString()}`;
      },
    }),
    getStaffReportSummary: build.query<StaffReportSummaryData, StaffReportSummaryArgs | void>({
      query: (args) => {
        const params = new URLSearchParams();
        if (args?.dateFrom) params.set("date_from", args.dateFrom);
        if (args?.dateTo) params.set("date_to", args.dateTo);
        return `/dashboard/staff-report/summary/?${params.toString()}`;
      },
    }),
  }),
});

export const { useGetDashboardQuery, useGetStaffReportQuery, useGetStaffReportSummaryQuery } = dashboardApi;
