/**
 * MeiiShop POS - Realtime Order Synchronization Hook
 * Dual-event listener for 'sale_transactions' table (INSERT & UPDATE)
 * Prevents desync on order edits and new orders across multiple POS terminals.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { fetchTransactionByIdFromSupabase } from '../services/supabase';
import { playOrderDingSound } from '../utils/audioFeedback';

export function useOrderRealtime({
  enabled = true,
  onNewOrder,
  onUpdateOrder,
  onDeleteOrder,
  localEchoIdsRef,
}) {
  // Highlight state: { [orderId]: 'new' | 'updated' }
  const [realtimeHighlights, setRealtimeHighlights] = useState({});
  const highlightTimersRef = useRef(new Map());

  // Safe highlight trigger with auto-cleanup after 7 seconds
  const triggerHighlight = useCallback((orderId, type = 'new') => {
    if (!orderId) return;

    // Clear existing timer if any to avoid premature clearing on rapid updates
    if (highlightTimersRef.current.has(orderId)) {
      clearTimeout(highlightTimersRef.current.get(orderId));
    }

    setRealtimeHighlights((prev) => ({
      ...prev,
      [orderId]: type,
    }));

    // Auto fadeout after 7 seconds
    const timer = setTimeout(() => {
      setRealtimeHighlights((prev) => {
        if (!prev[orderId]) return prev;
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
      highlightTimersRef.current.delete(orderId);
    }, 7000);

    highlightTimersRef.current.set(orderId, timer);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    console.log('[Realtime] Initializing channel for sale_transactions...');

    const channel = supabase
      .channel('realtime_sale_transactions')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sale_transactions',
        },
        async (payload) => {
          const newId = payload.new?.id;
          if (!newId) return;

          // Local Echo Suppression: If created by this terminal, ignore remote notification
          if (localEchoIdsRef?.current && localEchoIdsRef.current.has(newId)) {
            localEchoIdsRef.current.delete(newId);
            return;
          }

          console.log('[Realtime] New sale transaction detected on another terminal:', newId);

          // Fetch full transaction with child items (with retry if items are still writing)
          const fullTx = await fetchTransactionByIdFromSupabase(newId, true);
          if (fullTx) {
            onNewOrder?.(fullTx);
            triggerHighlight(fullTx.id, 'new');
            playOrderDingSound('history');
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sale_transactions',
        },
        async (payload) => {
          const updatedId = payload.new?.id;
          if (!updatedId) return;

          // Local Echo Suppression: If edited by this terminal, skip remote notification
          if (localEchoIdsRef?.current && localEchoIdsRef.current.has(updatedId)) {
            localEchoIdsRef.current.delete(updatedId);
            return;
          }

          console.log('[Realtime] Sale transaction updated on another terminal:', updatedId);

          // Fetch fresh order with child items to replace outdated cache
          const fullTx = await fetchTransactionByIdFromSupabase(updatedId, true);
          if (fullTx) {
            onUpdateOrder?.(fullTx);
            triggerHighlight(fullTx.id, 'updated');
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'sale_transactions',
        },
        (payload) => {
          const deletedId = payload.old?.id;
          if (!deletedId) return;

          console.log('[Realtime] Sale transaction deleted:', deletedId);
          onDeleteOrder?.(deletedId);
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.warn('[Realtime] sale_transactions subscription warning:', err);
        } else {
          console.log('[Realtime] sale_transactions channel status:', status);
        }
      });

    return () => {
      console.log('[Realtime] Cleaning up sale_transactions channel...');
      supabase.removeChannel(channel);

      // Clean up all active highlight timers to prevent memory leaks
      highlightTimersRef.current.forEach((t) => clearTimeout(t));
      highlightTimersRef.current.clear();
    };
  }, [enabled, onNewOrder, onUpdateOrder, onDeleteOrder, triggerHighlight, localEchoIdsRef]);

  return {
    realtimeHighlights,
    triggerHighlight,
  };
}
