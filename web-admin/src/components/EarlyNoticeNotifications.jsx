import { useCallback, useEffect, useState } from 'react';
import { Bell, Check, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { notificationApi } from '../services/notification.service';
import { NOTIFICATIONS_CHANGED, notifyNotificationsChanged } from '../hooks/useNotifications';

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires',
});

export default function EarlyNoticeNotifications({ enabled = true }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [workingId, setWorkingId] = useState(null);

    const load = useCallback(async (showLoading = false) => {
        if (!enabled) return;
        if (showLoading) setLoading(true);
        try {
            const response = await notificationApi.list({ limit: 50 });
            setItems(Array.isArray(response?.data) ? response.data : []);
            setError('');
        } catch (err) {
            setError(err?.response?.data?.message || 'No se pudieron cargar las notificaciones.');
        } finally {
            setLoading(false);
        }
    }, [enabled]);

    useEffect(() => {
        if (!enabled) return;
        load();
        const timer = window.setInterval(() => load(), 30000);
        const refresh = () => load();
        window.addEventListener('focus', refresh);
        window.addEventListener(NOTIFICATIONS_CHANGED, refresh);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener('focus', refresh);
            window.removeEventListener(NOTIFICATIONS_CHANGED, refresh);
        };
    }, [enabled, load]);

    const markRead = async (item) => {
        if (item.isRead || workingId !== null) return;
        setWorkingId(item.id);
        try {
            await notificationApi.markRead(item.id);
            setItems(prev => prev.map(n => n.id === item.id ? { ...n, isRead: true } : n));
            setError('');
            notifyNotificationsChanged();
        } catch (err) {
            setError(err?.response?.data?.message || 'No se pudo marcar como leída.');
        } finally {
            setWorkingId(null);
        }
    };

    const unread = items.filter(n => !n.isRead).length;
    return (
        <section className="overflow-hidden rounded-2xl border border-[#D8DDE3] bg-white shadow-xl shadow-black/10">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D8DDE3] px-5 py-4">
                <div className="flex items-center gap-3">
                    <Bell size={20} className="text-[#C61515]" />
                    <div>
                        <h2 className="font-semibold text-[#22252B]">Mis notificaciones</h2>
                        <p className="text-xs text-[#64748B]">{unread} sin leer en los últimos {items.length} registros mostrados</p>
                    </div>
                </div>
                <button type="button" onClick={() => load(true)} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#D8DDE3] px-3 py-2 text-xs text-[#374151] hover:bg-[#E5E7EB]">
                    <RefreshCw size={14} /> Actualizar
                </button>
            </div>
            {error && <p role="alert" className="flex items-center gap-2 px-5 py-3 text-sm text-rose-300"><AlertCircle size={16} />{error}</p>}
            {loading ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin text-[#C61515]" /></div>
            ) : items.length === 0 ? (
                <p className="px-5 py-7 text-sm text-[#64748B]">Todavía no tenés notificaciones.</p>
            ) : (
                <div className="max-h-[380px] divide-y divide-[#E5E7EB] overflow-y-auto">
                    {items.map(item => (
                        <article key={item.id} className={`flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between ${!item.isRead ? 'bg-[#FFF8F8]' : ''}`}>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-semibold text-[#22252B]">{item.title}</p>
                                    {!item.isRead && <span className="rounded-full bg-[#FCEAEA] px-2 py-0.5 text-[10px] font-semibold text-[#B31212]">Nueva</span>}
                                </div>
                                <p className="mt-1 whitespace-pre-wrap text-sm text-[#475569]">{item.message}</p>
                                <p className="mt-2 text-xs text-[#64748B]">{item.createdAt ? dateFormatter.format(new Date(item.createdAt)) : ''}</p>
                            </div>
                            {!item.isRead && (
                                <button type="button" disabled={workingId !== null} onClick={() => markRead(item)} className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 self-start rounded-lg border border-[#E9A6A6] px-3 py-2 text-xs font-medium text-[#B31212] hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50">
                                    <Check size={14} /> Marcar leída
                                </button>
                            )}
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}
