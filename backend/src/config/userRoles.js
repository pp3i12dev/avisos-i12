export const ROLE_CONFIG = {
    student: {
        profileField: 'studentProfile',
        permissions: {
            list: 'student:list',
            create: 'student:create',
            edit: 'student:edit',
            toggle: 'student:deactivate',
            reactivate: 'student:reactivate',
            delete: 'student:delete',
        },
        requiredCreateFields: [],
        buildProfileCreate: (body) => ({ legajoStudent: String(body.legajoStudent || '').trim() || null }),
        allowedProfileEdit: ['legajoStudent'],
    },
    director: {
        profileField: 'directorProfile',
        permissions: {
            list: 'director:list',
            create: 'director:create',
            edit: 'director:edit',
            toggle: 'director:deactivate',
            delete: 'director:delete',
        },
        requiredCreateFields: [],
        buildProfileCreate: (body) => ({ position: body.position ?? null }),
        allowedProfileEdit: ['position'],
    },
    preceptor: {
        profileField: 'preceptorProfile',
        permissions: {
            list: 'preceptor:list',
            create: 'preceptor:create',
            edit: 'preceptor:edit',
            toggle: 'preceptor:deactivate',
            delete: 'preceptor:delete',
        },
        requiredCreateFields: [],
        buildProfileCreate: (body) => ({ legajoPreceptor: String(body.legajoPreceptor || '').trim() || null, shift: body.shift ?? null }),
        allowedProfileEdit: ['shift', 'legajoPreceptor'], // La cobertura múltiple se valida en users.service.js
    },
    teacher: {
        profileField: 'teacherProfile',
        permissions: {
            list: 'teacher:list',
            create: 'teacher:create',
            edit: 'teacher:edit',
            toggle: 'teacher:deactivate',
            delete: 'teacher:delete',
        },
        requiredCreateFields: [],
        buildProfileCreate: (body) => ({ legajoTeacher: String(body.legajoTeacher || '').trim() || null, specialty: body.specialty ?? null }),
        allowedProfileEdit: ['specialty', 'legajoTeacher'],
    },
};

export function getRoleConfig(role) {
    return ROLE_CONFIG[role] ?? null;
}