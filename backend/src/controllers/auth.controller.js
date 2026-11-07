import { requestPasswordReset, resetPassword } from '../services/passwordReset.service.js';
import { loginService, registerStudentService, registerStaffService } from '../services/auth.service.js';
import { verifyRegistrationEmail, resendVerification } from '../services/publicRegistration.service.js';
import { handleServiceError } from '../utils/handleServiceError.js';



export const login = async (req, res) => {
    try {
        const result = await loginService(req.body);
        return res.status(200).json(result);
    } catch (error) {
        return handleServiceError(error, res);
    }
};



export const registerStudent = async (req, res) => {
    try {
        const result = await registerStudentService(req.body);
        return res.status(201).json(result);
    } catch (error) {
        return handleServiceError(error, res);
    }
};

export const registerTeacher = async (req, res) => {
    try { return res.status(201).json(await registerStaffService(req.body)); }
    catch (error) { return handleServiceError(error, res); }
};
export const verifyEmail = async (req, res) => {
    try { return res.json(await verifyRegistrationEmail(req.body?.token)); }
    catch (error) { return handleServiceError(error, res); }
};
export const resendEmail = async (req, res) => {
    try { return res.json(await resendVerification(req.body?.email)); }
    catch (error) { return handleServiceError(error, res); }
};
export const forgotPassword = async (req, res) => {
  try { return res.status(200).json(await requestPasswordReset(req.body)); }
  catch (error) { return handleServiceError(error, res); }
};
export const confirmPasswordReset = async (req, res) => {
  try { return res.status(200).json(await resetPassword(req.body)); }
  catch (error) { return handleServiceError(error, res); }
};
