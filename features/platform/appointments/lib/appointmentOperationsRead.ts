export interface AppointmentOperationsQueryData<TAppointment> {
  appointments: TAppointment[];
  allCount: number;
  pendingCount: number;
  confirmedCount: number;
  inProgressCount: number;
  completedCount: number;
  cancelledCount: number;
  noShowCount: number;
  todayCount: number;
}

export interface AppointmentOperationsData<TAppointment> {
  appointments: TAppointment[];
  counts: {
    all: number;
    today: number;
    pending: number;
    confirmed: number;
    in_progress: number;
    completed: number;
    cancelled: number;
    no_show: number;
  };
}

export type AppointmentOperationsReadResult<TAppointment> =
  | { status: 'available'; data: AppointmentOperationsData<TAppointment> }
  | { status: 'unavailable' };

export function resolveAppointmentOperationsResponse<TAppointment>(response: {
  success: boolean;
  data?: AppointmentOperationsQueryData<TAppointment>;
  error?: string;
}): AppointmentOperationsReadResult<TAppointment> {
  if (!response.success || !response.data) return { status: 'unavailable' };

  const data = response.data;
  const counts = [
    data.allCount,
    data.todayCount,
    data.pendingCount,
    data.confirmedCount,
    data.inProgressCount,
    data.completedCount,
    data.cancelledCount,
    data.noShowCount,
  ];
  if (
    !Array.isArray(data.appointments) ||
    counts.some((count) => typeof count !== 'number' || !Number.isFinite(count) || count < 0)
  ) return { status: 'unavailable' };

  return {
    status: 'available',
    data: {
      appointments: data.appointments,
      counts: {
        all: data.allCount,
        today: data.todayCount,
        pending: data.pendingCount,
        confirmed: data.confirmedCount,
        in_progress: data.inProgressCount,
        completed: data.completedCount,
        cancelled: data.cancelledCount,
        no_show: data.noShowCount,
      },
    },
  };
}
