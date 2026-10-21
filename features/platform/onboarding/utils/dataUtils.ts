import { SALON_TEMPLATES } from '../config/templates';

export function getItemsFromJsonData(jsonData: any, sectionType: string): string[] {
  if (!jsonData) return [];

  switch (sectionType) {
    case 'salonInfo':
      return jsonData.salonInfo ? [jsonData.salonInfo.name || 'Salon Location'] : ['Salon Location'];
    case 'categories':
      return (jsonData.categories || []).map((category: any) => category.name || 'Unknown Category');
    case 'services':
      return (jsonData.services || []).map((service: any) => service.name || 'Unknown Service');
    case 'staff':
      return (jsonData.staff || jsonData.stylists || []).map((staff: any) => staff.name || 'Unknown Staff');
    case 'clients':
      return (jsonData.clients || []).map((client: any) => client.name || 'Unknown Client');
    case 'intakeForms':
      return [
        ...(jsonData.intakeForms || []).map((form: any) => form.name || 'Unknown Intake Form'),
        ...(jsonData.formTemplates || []).map((form: any) => form.name || 'Unknown Form Template'),
      ];
    case 'memberships':
      return [
        ...(jsonData.memberships || []).map((membership: any) => membership.name || 'Unknown Membership'),
        ...(jsonData.packages || []).map((pkg: any) => pkg.name || 'Unknown Package'),
      ];
    case 'retail':
      return [
        ...(jsonData.products || []).map((product: any) => product.name || 'Unknown Product'),
        ...(jsonData.messageTemplates || []).map((template: any) => template.name || 'Unknown Message Template'),
      ];
    case 'appointments':
      return (jsonData.appointments || []).map(
        (appointment: any) => appointment.displayName || appointment.key || 'Unknown Appointment'
      );
    default:
      return [];
  }
}

export function getSeedForTemplate(template: 'full' | 'minimal' | 'custom', seedData: any) {
  const templateToUse = template === 'custom' ? 'minimal' : template;
  const displayNames = SALON_TEMPLATES[templateToUse].displayNames;

  const selectedCategories = new Set(displayNames.categories);
  const selectedServices = new Set(displayNames.services);
  const selectedStaff = new Set(displayNames.staff);
  const selectedClients = new Set(displayNames.clients);
  const selectedIntake = new Set(displayNames.intakeForms);
  const selectedMemberships = new Set(displayNames.memberships);
  const selectedRetail = new Set(displayNames.retail);
  const selectedAppointments = new Set(displayNames.appointments);

  const selectedServiceKeys = new Set(
    (seedData.services || [])
      .filter((service: any) => selectedServices.has(service.name))
      .map((service: any) => service.key)
  );

  return {
    salonInfo: seedData.salonInfo,
    categories: (seedData.categories || []).filter((category: any) => selectedCategories.has(category.name)),
    services: (seedData.services || []).filter((service: any) => selectedServices.has(service.name)),
    resources: seedData.resources || [],
    stylists: (seedData.stylists || seedData.staff || [])
      .filter((staff: any) => selectedStaff.has(staff.name))
      .map((staff: any) => ({
        ...staff,
        specializations: (staff.specializations || []).filter(
          (serviceRef: string) => selectedServices.has(serviceRef) || selectedServiceKeys.has(serviceRef)
        ),
      })),
    scheduleBlocks: (seedData.scheduleBlocks || []).filter((block: any) =>
      (seedData.stylists || seedData.staff || [])
        .filter((staff: any) => selectedStaff.has(staff.name))
        .some((staff: any) => staff.key === block.stylist)
    ),
    clients: (seedData.clients || []).filter((client: any) => selectedClients.has(client.name)),
    intakeForms: (seedData.intakeForms || []).filter((form: any) => selectedIntake.has(form.name)),
    formTemplates: (seedData.formTemplates || []).filter((form: any) => selectedIntake.has(form.name)),
    memberships: (seedData.memberships || []).filter((membership: any) => selectedMemberships.has(membership.name)),
    packages: (seedData.packages || []).filter((pkg: any) => selectedMemberships.has(pkg.name)),
    products: (seedData.products || []).filter((product: any) => selectedRetail.has(product.name)),
    messageTemplates: (seedData.messageTemplates || []).filter((template: any) => selectedRetail.has(template.name)),
    appointments: (seedData.appointments || []).filter((appointment: any) =>
      selectedAppointments.has(appointment.displayName || appointment.key)
    ),
    gallery: (seedData.gallery || []).filter(
      (image: any) => !image.service || selectedServiceKeys.has(image.service)
    ),
    paymentProviders: seedData.paymentProviders || [],
  };
}
