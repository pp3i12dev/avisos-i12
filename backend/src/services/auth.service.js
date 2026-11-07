
import { hashPassword, comparePassword } from '../utils/password.js';
import { generateToken } from '../utils/jwt.js';
import { getRolesFromUser } from '../utils/rols.js';

import * as userRepository from '../repositories/user.repository.js';
import * as academicRepository from '../repositories/academic.repository.js';
import { registerPublicAccount } from './publicRegistration.service.js';

class ServiceError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}


export const loginService = async ({ email, dni, password }) => {
    if (!password || (!email && !dni)) {
        throw new ServiceError(
            'Debe ingresar email/DNI y contraseña',
            400
        );
    }

    const user = await userRepository.findUserByEmailOrDni({
        email,
        dni,
    });

    if (!user) {
        throw new ServiceError(
            'Credenciales incorrectas',
            401
        );
    }

    const isValidPassword = await comparePassword(
        password,
        user.passwordHash
    );

    if (!isValidPassword) {
        throw new ServiceError(
            'Credenciales incorrectas',
            401
        );
    }

    if (!user.isActive) {
        const message = user.signupStatus === 'REJECTED'
            ? 'Tu solicitud fue rechazada. Contactá a tu institución para consultar.'
            : user.signupStatus === 'PENDING'
              ? user.studentProfile ? 'Verificá tu correo para activar tu cuenta.' : 'Tu solicitud de personal está pendiente de aprobación institucional.'
              : 'Tu cuenta está desactivada. Contactá a tu institución.';
        throw new ServiceError(message, 403);
    }

    const isSuperAdmin = user.isSuperAdmin === true;

    const profileRoles = getRolesFromUser(user);

    const roles = isSuperAdmin
        ? [...new Set(['SUPER_ADMIN', ...profileRoles])]
        : profileRoles;

    const token = generateToken({
        id: user.id,
        email: user.email,
        institutionId: user.institutionId,
        isSuperAdmin,
        roles,
    });

    return {
        token,
        user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            institutionId: user.institutionId,
            isSuperAdmin,
            roles,
            directorProfile: user.directorProfile,
            teacherProfile: user.teacherProfile,
            preceptorProfile: user.preceptorProfile,
            studentProfile: user.studentProfile,
        },
    };
};



// El registro de alumnos se activa tras verificar el email, sin revisión administrativa.
export const registerStudentService = data => registerPublicAccount(data, 'STUDENT');
// Las solicitudes públicas de personal permanecen sin roles hasta su aprobación.
export const registerStaffService = data => registerPublicAccount(data, data?.role);
