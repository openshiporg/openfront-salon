import { redirect } from 'next/navigation';

/*
 * /dashboard/platform/staff had no page of its own, so the request fell through
 * to the generic `[listKey]/[id]` item route (list "platform", id "staff") and
 * crashed into "Something went wrong". The staff list lives on Staff & locations.
 */
export default function StaffIndexPage() {
  redirect('/dashboard/platform/administration#management-staff');
}
