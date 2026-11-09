// Validaciones sin acceso a DB, compartidas por el servicio y sus pruebas.
export const CONTACT_ROLES = Object.freeze(['SUPER_ADMIN','DIRECTOR','PRECEPTOR','TEACHER','STUDENT']);
export const isStudentDirectoryUser = user => Boolean(user?.roles?.includes('STUDENT') &&
  !user?.isSuperAdmin && !user.roles.some(r=>['SUPER_ADMIN','DIRECTOR','PRECEPTOR','TEACHER'].includes(r)));
export function canViewContactField(allowed, roles=[]) {
  return Array.isArray(allowed) && Array.isArray(roles) && roles.some(role=>allowed.includes(role));
}
export function validateContactPrefs(body={}) {
  const fail=message=>{const e=new Error(message);e.status=400;throw e;};
  const contactEmail=typeof body.contactEmail==='string'?body.contactEmail.trim().toLowerCase():'';
  if(contactEmail.length>200 || (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)))
    fail('Correo de contacto inválido.');
  const contactPhone=typeof body.contactPhone==='string'?body.contactPhone.trim():'';
  if(contactPhone.length>35 || (contactPhone && !/^\+?[\d\s().-]+$/.test(contactPhone))) fail('Teléfono de contacto inválido.');
  const rolesFor=name=>{
    const values=body[name];
    if(!Array.isArray(values)||values.length>CONTACT_ROLES.length||values.some(x=>!CONTACT_ROLES.includes(x))||new Set(values).size!==values.length)
      fail(`Roles inválidos para ${name}.`);
    return values;
  };
  return {contactEmail:contactEmail||null,contactPhone:contactPhone||null,emailVisibleTo:rolesFor('emailVisibleTo'),phoneVisibleTo:rolesFor('phoneVisibleTo')};
}


// Un contacto aparece en el directorio SOLO cuando quien consulta puede ver
// por lo menos un dato existente. El filtro se aplica ANTES de paginar en Prisma
// para no devolver tarjetas vacías ni saltos de página por contactos privados.
export function visibleContactWhere(viewerRoles = []) {
  const roles = Array.isArray(viewerRoles) ? viewerRoles.filter(role => CONTACT_ROLES.includes(role)) : [];
  if (!roles.length) return { id: { equals: -1 } }; // Ningún rol de consulta autorizado.
  return {
    OR: [
      {
        AND: [
          { contactPreference: { is: { emailVisibleTo: { hasSome: roles } } } },
          { OR: [
            { email: { not: '' } },
            { contactPreference: { is: { contactEmail: { not: null } } } },
          ] },
        ],
      },
      {
        AND: [
          { contactPreference: { is: { phoneVisibleTo: { hasSome: roles } } } },
          { OR: [
            { AND: [{ telefono: { not: null } }, { telefono: { not: '' } }] },
            { contactPreference: { is: { contactPhone: { not: null } } } },
          ] },
        ],
      },
    ],
  };
}

// Segunda validación sobre el resultado seleccionado: solo devolver la
// información visible para el visitante, nunca listas de permisos ajenos.
export function visibleContactData(user, viewerRoles = []) {
  const pref = user?.contactPreference;
  const email = canViewContactField(pref?.emailVisibleTo, viewerRoles)
    ? (pref?.contactEmail?.trim() || user?.email?.trim() || null) : null;
  const phone = canViewContactField(pref?.phoneVisibleTo, viewerRoles)
    ? (pref?.contactPhone?.trim() || user?.telefono?.trim() || null) : null;
  return { email, phone };
}
