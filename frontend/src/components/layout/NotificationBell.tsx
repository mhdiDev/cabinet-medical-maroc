'use client';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

interface Notification {
  id: string;
  message: string;
  type: string;
  lu: boolean;
  createdAt: string;
  patientId?: string;
  patient?: { id: string; nom: string; prenom: string };
}

export function NotificationBell() {
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: () => apiClient.get('/notifications').then((r) => r.data),
    refetchInterval: 30_000,
    enabled: user?.role === 'SECRETAIRE' || user?.role === 'ADMIN',
  });

  const unread = notifications.filter((n) => !n.lu).length;

  const markOne = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/notifications/${id}/lue`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAll = useMutation({
    mutationFn: () => apiClient.patch('/notifications/tout-lire', {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (user?.role !== 'SECRETAIRE' && user?.role !== 'ADMIN') return null;

  return (
    <div ref={dropRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold px-0.5">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-sm text-gray-900">
              Notifications {unread > 0 && <span className="ml-1 text-blue-600">({unread})</span>}
            </span>
            {unread > 0 && (
              <button
                onClick={() => markAll.mutate()}
                className="text-xs text-blue-600 hover:underline"
              >
                Tout marquer lu
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Aucune notification</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.lu && markOne.mutate(n.id)}
                  className={`px-4 py-3 cursor-pointer hover:bg-gray-50 transition ${!n.lu ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-base shrink-0 mt-0.5">💰</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 leading-snug">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(n.createdAt).toLocaleString('fr-MA', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      {n.patientId && (
                        <Link
                          href={`/paiements?patientId=${n.patientId}`}
                          className="mt-1 text-xs text-blue-600 hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!n.lu) markOne.mutate(n.id);
                            setOpen(false);
                          }}
                        >
                          Aller à la caisse →
                        </Link>
                      )}
                    </div>
                    {!n.lu && (
                      <span className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 shrink-0" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
