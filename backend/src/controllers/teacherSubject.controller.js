import { getTeacherSubjects, getTeacherSubjectDetail } from '../services/teacherSubject.service.js';
import { handleServiceError } from '../utils/handleServiceError.js';
export async function listMine(req, res) {
  try { return res.json(await getTeacherSubjects(req.user)); }
  catch (err) { return handleServiceError(err, res); }
}
export async function getDetail(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({message:'ID inválido'});
    return res.json(await getTeacherSubjectDetail(req.user, id));
  } catch (err) { return handleServiceError(err, res); }
}
