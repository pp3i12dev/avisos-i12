import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { directoryOptions,searchDirectory,myContactPreferences,saveContactPreferences } from '../services/contactDirectory.service.js';
const router=Router();
router.use(authenticate);
const respond=async(res,fn)=>{try{return res.json(await fn());}catch(e){if(!e.status)console.error('[Avisos I12][Directorio]',e);return res.status(e.status||500).json({message:e.status?e.message:'No se pudo completar la operación.'});}};
router.get('/preferences', (req,res)=>respond(res,()=>myContactPreferences(req.user)));
router.put('/preferences', (req,res)=>respond(res,()=>saveContactPreferences(req.user,req.body)));
router.get('/options', (req,res)=>respond(res,()=>directoryOptions(req.user,req.query.institutionId)));
// Límite por usuario para dificultar la extracción automatizada del directorio.
// Complementario: en producción conviene aplicar un rate limit compartido en el proxy/API.
const windows=new Map();
router.get('/', (req,res)=>{
  const id=req.user.id,now=Date.now();
  if(windows.size>3000) for(const [key,v] of windows){if(now-v.start>60_000) windows.delete(key)}
  let state=windows.get(id);
  if(!state||now-state.start>=60_000) state={start:now,count:0};
  state.count+=1;windows.set(id,state);
  if(state.count>60) return res.status(429).json({message:'Demasiadas búsquedas. Volvé a intentar en un minuto.'});
  return respond(res,()=>searchDirectory(req.user,req.query));
});
export default router;
