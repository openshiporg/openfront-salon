// Services
export {
  getAllServices,
  getServiceById,
  getServicesGroupedByCategory,
  getFeaturedServices,
} from "./services"
export type { Service, ServiceCategory } from "./services"

// Stylists
export {
  getAllStylists,
  getStylistById,
  getFeaturedStylists,
  getStylistsForService,
} from "./stylists"
export type { Stylist } from "./stylists"

// Stylist helpers (client-side utilities)
export {
  calculateYearsExperience,
  getTierDisplayName,
  getAvailableDays,
} from "../utils/stylist-helpers"

// Appointments
export {
  createAppointment,
  getClientAppointments,
  getStylistAppointmentsForDate,
  cancelAppointment,
} from "./appointments"
export type { Appointment, CreateAppointmentInput } from "./appointments"

// Availability
export {
  getAvailableTimeSlots,
  getMultipleStylistAvailability,
  isTimeSlotAvailable,
  getNextAvailableDate,
} from "./availability"

// Clients
export {
  createGuestClient,
  getClientByEmail,
} from "./clients"
