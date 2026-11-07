// El acceso automático está permitido ÚNICAMENTE si hay una solicitud pública pendiente
// del mismo correo, DNI, cargo e institución. Otros casos requieren intervención humana.
export function canActivatePendingStaff(existing, userData, requestedRole) {
  return Boolean(existing && !existing.isActive && !existing.deletedAt && !existing.isSuperAdmin &&
    existing.email?.toLowerCase()===userData.email?.toLowerCase() &&
    existing.dni===userData.dni && existing.institutionId===userData.institutionId &&
    existing.signupStatus==='PENDING' && existing.staffSignup?.status==='PENDING' &&
    existing.staffSignup?.role===requestedRole &&
    !existing.studentProfile && !existing.teacherProfile && !existing.preceptorProfile && !existing.directorProfile);
}
