import { useEffect, useState } from 'react';

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel, confirmLabel = 'Confirmar', confirmationPhrase = '' }) {
    const [typed, setTyped] = useState('');
    useEffect(() => { if (!open) setTyped(''); }, [open]);
    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
            <div className="bg-white text-slate-900 border border-slate-200 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="text-slate-600 text-sm mt-3 leading-6">{message}</p>
                {confirmationPhrase && <label className="mt-4 block text-sm font-medium text-slate-800">Escribí <strong>{confirmationPhrase}</strong> para confirmar
                  <input autoComplete="off" value={typed} onChange={e=>setTyped(e.target.value)} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-rose-500 focus:outline-none" placeholder={confirmationPhrase}/>
                </label>}
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100">
                        Cancelar
                    </button>
                    <button onClick={onConfirm} disabled={Boolean(confirmationPhrase) && typed !== confirmationPhrase} className="px-4 py-2 rounded-lg bg-[#C61515] hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-40 text-white font-semibold">
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}