import { getPrisma } from '../config/prisma.js';
import { isStudentDirectoryUser, canViewContactField, validateContactPrefs } from '../utils/contactDirectoryPolicy.js';

const DIRECTORY_ROLES = ['DIRECTOR','PRECEPTOR','TEACHER','STUDENT'];
const SHIFTS = ['MANANA','TARDE','NOCHE'];
const fail = (message, status=400) => { const e = new Error(message); e.status=status; throw e; };
const isSuper = u => Boolean(u?.isSuperAdmin || u?.roles?.includes('SUPER_ADMIN'));
const integer = v => { const n=Number(v); return Number.isSafeInteger(n) && n>0?n:null; };
function institutionFor(actor, requested) {
  if (!actor?.id) fail('Sesión inválida.',401);
  if (!isSuper(actor) && !(actor.roles||[]).some(r=>DIRECTORY_ROLES.includes(r))) fail('Tu cuenta no tiene un rol habilitado para el directorio.',403);
  if (isSuper(actor)) {
    const id=integer(requested || actor.institutionId);
    if (!id) fail('Seleccioná una institución.',400);
    return id;
  }
  if (!integer(actor.institutionId)) fail('No tenés institución asignada.',403);
  if (requested && Number(requested)!==Number(actor.institutionId)) fail('Institución no autorizada.',403);
  return Number(actor.institutionId);
}
const roleClause = role => ({
  DIRECTOR: { directorProfile: { isNot: null } },
  PRECEPTOR: { preceptorProfile: { isNot: null } },
  TEACHER: { teacherProfile: { isNot: null } },
  STUDENT: { studentProfile: { isNot: null } },
}[role]);
function directoryRole(u) { return [
  u.directorProfile&&'DIRECTOR',u.preceptorProfile&&'PRECEPTOR',
  u.teacherProfile&&'TEACHER',u.studentProfile&&'STUDENT',
].filter(Boolean); }
function searchWhere(search) {
  const words=String(search||'').trim().slice(0,100).split(/\s+/).filter(Boolean).slice(0,5);
  return words.length?{AND:words.map(t=>({OR:[
    {firstName:{contains:t,mode:'insensitive'}},{lastName:{contains:t,mode:'insensitive'}},
    {teacherProfile:{is:{teacherSubjects:{some:{subject:{nombre:{contains:t,mode:'insensitive'}}}}}}},
  ]}))}:{};
}
async function studentCareerIds(actor, db) {
  const profile=await db.studentProfile.findFirst({where:{userId:actor.id,user:{isActive:true,deletedAt:null}},select:{
    careerMemberships:{select:{careerId:true}},
  }});
  return profile?.careerMemberships.map(c=>c.careerId)||[];
}
export async function directoryOptions(actor, rawInstitutionId) {
  const db=getPrisma();
  // El superadministrador puede elegir institución; no se usa información externa del cliente para usuarios normales.
  const institutions=isSuper(actor)?await db.institution.findMany({where:{isActive:true},select:{id:true,nombre:true},orderBy:{nombre:'asc'}}):[];
  const institutionId=isSuper(actor) && !rawInstitutionId && !actor.institutionId
    ? null: institutionFor(actor,rawInstitutionId);
  const careers=institutionId ? await db.career.findMany({where:{institutionId},select:{id:true,nombre:true},orderBy:{nombre:'asc'}}):[];
  const studentOnly=isStudentDirectoryUser(actor);
  const allowed=studentOnly?await studentCareerIds(actor,db):null;
  const allowedCareers=studentOnly?careers.filter(c=>allowed.includes(c.id)):careers;
  const subjects=institutionId?await db.teacherSubject.findMany({where:{isActive:true,course:{institutionId,isActive:true,careerId:studentOnly?{in:allowed}:undefined},subject:{isActive:true}},select:{subject:{select:{id:true,nombre:true}},course:{select:{careerId:true,shift:true}}},take:3000}):[];
  const bySubject=new Map();
  for(const row of subjects){
    const item=bySubject.get(row.subject.id)||{id:row.subject.id,nombre:row.subject.nombre,careerIds:[],shifts:[]};
    if(row.course.careerId && !item.careerIds.includes(row.course.careerId)) item.careerIds.push(row.course.careerId);
    if(row.course.shift && !item.shifts.includes(row.course.shift)) item.shifts.push(row.course.shift);
    bySubject.set(item.id,item);
  }
  return {institutionId,institutions,careers:allowedCareers,subjects:[...bySubject.values()].sort((a,b)=>a.nombre.localeCompare(b.nombre,'es')),roles:studentOnly?DIRECTORY_ROLES.slice(0,3):DIRECTORY_ROLES};
}
export async function searchDirectory(actor,query={}) {
  const db=getPrisma();
  const institutionId=institutionFor(actor,query.institutionId);
  const studentOnly=isStudentDirectoryUser(actor);
  const allowedCareers=studentOnly?await studentCareerIds(actor,db):null;
  const careerId=integer(query.careerId);
  const subjectId=integer(query.subjectId);
  const shift=SHIFTS.includes(query.shift)?query.shift:null;
  const role=String(query.role||'ALL').toUpperCase();
  if (role!=='ALL' && !DIRECTORY_ROLES.includes(role)) fail('Categoría inválida.');
  if (studentOnly && role==='STUDENT') fail('Los alumnos no pueden consultar otros alumnos.',403);
  if (studentOnly && careerId && !allowedCareers.includes(careerId)) fail('No tenés esa carrera asociada.',403);
  // El personal de carrera/turno que se muestra a alumnos se limita a sus carreras declaradas.
  const careerScope=studentOnly?(careerId?[careerId]:allowedCareers):(careerId?[careerId]:null);
  const assignmentFilter={isActive:true,course:{institutionId,isActive:true,
    ...(careerScope?{careerId:{in:careerScope}}:{}),...(shift?{shift}:{})},
    ...(subjectId?{subjectId}:{})};
  const coverageFilter={...(careerScope?{careerId:{in:careerScope}}:{}),...(shift?{shift}:{})};
  const roleFilters=[];
  if (['ALL','DIRECTOR'].includes(role) && !subjectId && !shift) {
    // Las autoridades se muestran para su institución; el filtro carrera es relevante para alumnos.
    roleFilters.push(roleClause('DIRECTOR'));
  }
  if (['ALL','TEACHER'].includes(role)) roleFilters.push({teacherProfile:{is:{teacherSubjects:{some:assignmentFilter}}}});
  if (['ALL','PRECEPTOR'].includes(role) && !subjectId) roleFilters.push(
    !studentOnly && !careerId && !shift ? {preceptorProfile:{isNot:null}} :
      {preceptorProfile:{is:{coverages:{some:coverageFilter}}}});
  if (!studentOnly && ['ALL','STUDENT'].includes(role) && !subjectId && !shift) {
    roleFilters.push(careerScope ? {studentProfile:{is:{careerMemberships:{some:{careerId:{in:careerScope}}}}}} : {studentProfile:{isNot:null}});
  }
  if (!roleFilters.length) return {results:[],hasMore:false};
  const page=Math.min(50,Math.max(1,Number(query.page)||1));
  const take=25;
  const rows=await db.user.findMany({where:{institutionId,isActive:true,deletedAt:null,OR:roleFilters,...searchWhere(query.search)},
    select:{id:true,firstName:true,lastName:true,email:true,telefono:true,isSuperAdmin:true,
      contactPreference:{select:{contactEmail:true,emailVisibleTo:true,phoneVisibleTo:true}},
      directorProfile:{select:{position:true}},
      preceptorProfile:{select:{coverages:{select:{careerId:true,shift:true,career:{select:{nombre:true}}}}}},
      teacherProfile:{select:{specialty:true,teacherSubjects:{where:assignmentFilter,select:{
        course:{select:{careerId:true,career:{select:{nombre:true}},shift:true}},subject:{select:{id:true,nombre:true}}
      }}}},
      studentProfile: studentOnly?false:{select:{careerMemberships:{select:{careerId:true,career:{select:{nombre:true}}}}}},
    },orderBy:[{lastName:'asc'},{firstName:'asc'},{id:'asc'}],skip:(page-1)*take,take:take+1});
  const sliced=rows.slice(0,take);
  return {page,hasMore:rows.length>take,results:sliced.map(u=>({
    id:u.id,firstName:u.firstName,lastName:u.lastName,roles:directoryRole(u),
    position:u.directorProfile?.position||null,specialty:u.teacherProfile?.specialty||null,
    coverages:u.preceptorProfile?.coverages.map(x=>({careerId:x.careerId,career:x.career.nombre,shift:x.shift}))||[],
    teaching:u.teacherProfile?.teacherSubjects.map(x=>({careerId:x.course.careerId,career:x.course.career?.nombre,shift:x.course.shift,
      subjectId:x.subject.id,subject:x.subject.nombre}))||[],
    careers:u.studentProfile?.careerMemberships.map(x=>x.career.nombre)||[],
    email:canViewContactField(u.contactPreference?.emailVisibleTo,actor.roles)?u.contactPreference.contactEmail||u.email:null,
    phone:canViewContactField(u.contactPreference?.phoneVisibleTo,actor.roles)?u.telefono:null,
  }))};
}
export async function myContactPreferences(actor) {
  if (!actor?.id) fail('Sesión inválida.',401);
  const db=getPrisma();
  const user=await db.user.findUnique({where:{id:actor.id},select:{email:true,telefono:true,contactPreference:true}});
  if (!user) fail('Usuario no encontrado.',404);
  return {email:user.email,phone:user.telefono,
    contactEmail:user.contactPreference?.contactEmail||'',
    emailVisibleTo:user.contactPreference?.emailVisibleTo||[],
    phoneVisibleTo:user.contactPreference?.phoneVisibleTo||[]};
}
export async function saveContactPreferences(actor,body) {
  if (!actor?.id) fail('Sesión inválida.',401);
  const data=validateContactPrefs(body);
  const user=await getPrisma().user.findFirst({where:{id:actor.id,isActive:true,deletedAt:null},select:{id:true}});
  if (!user) fail('Cuenta no disponible.',403);
  await getPrisma().contactPreference.upsert({where:{userId:actor.id},create:{userId:actor.id,...data},update:data});
  return myContactPreferences(actor);
}
