// Límite básico del alta pública por IP (200 altas cada 15 minutos).
// El correo debe verificarse; para uso público considerar WAF/rate-limit distribuido.
const buckets = new Map();
export function publicRegistrationLimit(req,res,next) {
  const ip=String(req.ip||req.socket.remoteAddress||'unknown');
  const now=Date.now();
  if (buckets.size>10000) for (const [key,value] of buckets) if (value.until<now) buckets.delete(key);
  const entry=buckets.get(ip);
  const value=!entry||entry.until<=now?{ count: 0, until: now+15*60_000 }:entry;
  value.count+=1; buckets.set(ip,value);
  if (value.count>200) return res.status(429).json({message:'Demasiados registros desde esta conexión. Probá de nuevo más tarde.'});
  next();
}
