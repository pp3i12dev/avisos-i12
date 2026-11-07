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
  const rolesFor=name=>{
    const values=body[name];
    if(!Array.isArray(values)||values.length>CONTACT_ROLES.length||values.some(x=>!CONTACT_ROLES.includes(x))||new Set(values).size!==values.length)
      fail(`Roles inválidos para ${name}.`);
    return values;
  };
  return {contactEmail:contactEmail||null,emailVisibleTo:rolesFor('emailVisibleTo'),phoneVisibleTo:rolesFor('phoneVisibleTo')};
}
