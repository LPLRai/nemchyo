import { Redirect, Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/avatar';
import { useAuth } from '@/lib/auth';
import { pb } from '@/lib/pb';
import { theme } from '@/lib/theme';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
function fmtDay(d: Date) {
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}
function monthCells(year: number, month: number): (number | null)[] {
  const startWeekday = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function Calendar() {
  const { isValid, user } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<any[]>([]);
  const [rsvps, setRsvps] = useState<any[]>([]);
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState<Date>(new Date());
  const [detail, setDetail] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      setEvents(await pb.collection('calendar_events').getFullList({ sort: 'starts_at', expand: 'created_by' }));
      setRsvps(await pb.collection('event_rsvps').getFullList({ expand: 'user' }));
    } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const eventsByDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const e of events) {
      const k = dayKey(new Date(e.starts_at));
      (map[k] = map[k] || []).push(e);
    }
    return map;
  }, [events]);

  if (!isValid) return <Redirect href="/" />;

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells = monthCells(year, month);
  const todayKey = dayKey(new Date());
  const selKey = dayKey(selected);
  const dayEvents = eventsByDay[selKey] || [];

  const rsvpCount = (eventId: string, status: string) => rsvps.filter((r) => r.event === eventId && r.status === status).length;
  const myRsvp = (eventId: string) => rsvps.find((r) => r.event === eventId && r.user === user?.id)?.status;

  async function setMyRsvp(eventId: string, status: string) {
    const existing = rsvps.find((r) => r.event === eventId && r.user === user?.id);
    try {
      if (existing && existing.status === status) await pb.collection('event_rsvps').delete(existing.id);
      else if (existing) await pb.collection('event_rsvps').update(existing.id, { status });
      else await pb.collection('event_rsvps').create({ event: eventId, user: user.id, status });
      load();
    } catch {}
  }

  async function deleteEvent(ev: any) {
    setDetail(null);
    try {
      await pb.collection('calendar_events').delete(ev.id);
      load();
    } catch {}
  }

  const detailRsvps = detail ? rsvps.filter((r) => r.event === detail.id) : [];
  const now = new Date();
  const upcoming = events.filter((e) => new Date(e.ends_at || e.starts_at) >= now).slice(0, 15);

  function renderCard(ev: any, showDate: boolean) {
    const d = new Date(ev.starts_at);
    const when = ev.all_day ? 'All day' : fmtTime(ev.starts_at) + (ev.ends_at ? ' – ' + fmtTime(ev.ends_at) : '');
    return (
      <Pressable key={ev.id + (showDate ? '-u' : '-d')} style={styles.card} onPress={() => setDetail(ev)}>
        {showDate ? (
          <View style={styles.dateBadge}>
            <Text style={styles.badgeMonth}>{MONTHS[d.getMonth()].slice(0, 3).toUpperCase()}</Text>
            <Text style={styles.badgeDay}>{d.getDate()}</Text>
          </View>
        ) : (
          <View style={styles.cardAccent} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>{ev.title}</Text>
          <Text style={styles.cardWhen} numberOfLines={1}>{when}{ev.location ? '  ·  ' + ev.location : ''}</Text>
          <Text style={styles.cardGoing}>{rsvpCount(ev.id, 'going')} going{myRsvp(ev.id) ? ` · you: ${myRsvp(ev.id)}` : ''}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Calendar' }} />

      <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <View style={styles.calCard}>
          <View style={styles.monthBar}>
            <Pressable onPress={() => setCursor(new Date(year, month - 1, 1))} hitSlop={10} style={styles.navBtn}>
              <Text style={styles.navArrow}>‹</Text>
            </Pressable>
            <Text style={styles.monthLabel}>{MONTHS[month]} {year}</Text>
            <Pressable onPress={() => setCursor(new Date(year, month + 1, 1))} hitSlop={10} style={styles.navBtn}>
              <Text style={styles.navArrow}>›</Text>
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map((w, i) => (
              <Text key={i} style={styles.weekday}>{w}</Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((d, i) => {
              if (d === null) return <View key={i} style={styles.cell} />;
              const cellDate = new Date(year, month, d);
              const k = dayKey(cellDate);
              const isSel = k === selKey;
              const isToday = k === todayKey;
              const has = (eventsByDay[k] || []).length > 0;
              return (
                <Pressable key={i} style={styles.cell} onPress={() => setSelected(cellDate)}>
                  <View style={[styles.dayCircle, isSel && styles.daySel, !isSel && isToday && styles.dayToday]}>
                    <Text style={[styles.dayNum, isSel && { color: '#fff', fontWeight: '800' }, !isSel && isToday && { color: theme.primary, fontWeight: '800' }]}>{d}</Text>
                  </View>
                  <View style={[styles.dot, has ? { backgroundColor: isSel ? '#fff' : theme.primary } : null]} />
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text style={styles.sectionLabel}>{fmtDay(selected)}</Text>
        {dayEvents.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.noEvents}>No events this day</Text>
          </View>
        ) : (
          dayEvents.map((ev) => renderCard(ev, false))
        )}

        {upcoming.length > 0 ? (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Upcoming</Text>
            {upcoming.map((ev) => renderCard(ev, true))}
          </>
        ) : null}
      </ScrollView>

      <Pressable
        style={styles.fab}
        onPress={() => router.push({ pathname: '/new-event', params: { date: selected.toISOString() } })}>
        <Text style={styles.fabIcon}>＋</Text>
      </Pressable>

      <Modal visible={!!detail} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <Pressable style={styles.backdrop} onPress={() => setDetail(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {detail ? (
              <>
                <Text style={styles.dTitle}>{detail.title}</Text>
                <Text style={styles.dWhen}>
                  {fmtDay(new Date(detail.starts_at))}
                  {detail.all_day ? ' · All day' : ` · ${fmtTime(detail.starts_at)}${detail.ends_at ? '–' + fmtTime(detail.ends_at) : ''}`}
                </Text>
                {detail.location ? <Text style={styles.dLoc}>📍 {detail.location}</Text> : null}
                {detail.description ? <Text style={styles.dDesc}>{detail.description}</Text> : null}

                <View style={styles.rsvpRow}>
                  {(['going', 'maybe', 'no'] as const).map((s) => (
                    <Pressable
                      key={s}
                      style={[styles.rsvpBtn, myRsvp(detail.id) === s && styles.rsvpBtnOn]}
                      onPress={() => setMyRsvp(detail.id, s)}>
                      <Text style={[styles.rsvpText, myRsvp(detail.id) === s && { color: '#fff' }]}>
                        {s === 'going' ? 'Going' : s === 'maybe' ? 'Maybe' : "Can't go"}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {(['going', 'maybe', 'no'] as const).map((s) => {
                  const list = detailRsvps.filter((r) => r.status === s);
                  if (list.length === 0) return null;
                  return (
                    <View key={s} style={styles.whoRow}>
                      <Text style={styles.whoLabel}>{s === 'going' ? 'Going' : s === 'maybe' ? 'Maybe' : "Can't go"} ({list.length})</Text>
                      <View style={styles.whoAvatars}>
                        {list.slice(0, 8).map((r) => (
                          <View key={r.id} style={{ marginRight: 4 }}>
                            <Avatar user={r.expand?.user} size={28} />
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })}

                {detail.created_by === user?.id ? (
                  <View style={styles.ownerRow}>
                    <Pressable
                      style={styles.ownerBtn}
                      onPress={() => {
                        const ev = detail;
                        setDetail(null);
                        router.push({ pathname: '/new-event', params: { id: ev.id } });
                      }}>
                      <Text style={styles.ownerBtnText}>Edit</Text>
                    </Pressable>
                    <Pressable style={styles.ownerBtn} onPress={() => deleteEvent(detail)}>
                      <Text style={[styles.ownerBtnText, { color: '#DC2626' }]}>Delete</Text>
                    </Pressable>
                  </View>
                ) : null}
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  calCard: { backgroundColor: '#fff', borderRadius: 20, marginHorizontal: 12, marginTop: 12, paddingBottom: 12, shadowColor: '#2A1F6E', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 10 },
  monthLabel: { fontSize: 19, fontWeight: '800', color: theme.text },
  navBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.primarySoft },
  navArrow: { fontSize: 24, color: theme.primary, fontWeight: '500', marginTop: -3 },
  weekRow: { flexDirection: 'row', paddingHorizontal: 6 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: theme.textFaint, paddingBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 6 },
  cell: { width: `${100 / 7}%`, height: 46, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  daySel: { backgroundColor: theme.primary },
  dayToday: { backgroundColor: theme.primarySoft },
  dayNum: { fontSize: 15.5, color: theme.text, fontWeight: '600' },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 1, backgroundColor: 'transparent' },
  sectionLabel: { fontSize: 15, fontWeight: '800', color: theme.text, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 8 },
  emptyCard: { marginHorizontal: 12, paddingVertical: 18, alignItems: 'center', backgroundColor: '#fff', borderRadius: 14 },
  noEvents: { fontSize: 14, color: theme.textFaint },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, marginHorizontal: 12, marginBottom: 8, paddingVertical: 12, paddingHorizontal: 12, shadowColor: '#2A1F6E', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  cardAccent: { width: 4, height: 42, borderRadius: 2, backgroundColor: theme.primary },
  dateBadge: { width: 46, height: 46, borderRadius: 12, backgroundColor: theme.primarySoft, alignItems: 'center', justifyContent: 'center' },
  badgeMonth: { fontSize: 10.5, fontWeight: '800', color: theme.primary, letterSpacing: 0.5 },
  badgeDay: { fontSize: 18, fontWeight: '800', color: theme.primary, marginTop: -1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: theme.text },
  cardWhen: { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  cardGoing: { fontSize: 12.5, color: theme.primary, marginTop: 3, fontWeight: '600' },
  fab: { position: 'absolute', right: 20, bottom: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#2A1F6E', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  fabIcon: { color: '#fff', fontSize: 32, fontWeight: '300', marginTop: -2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 22, paddingBottom: 34 },
  dTitle: { fontSize: 21, fontWeight: '800', color: theme.text },
  dWhen: { fontSize: 14.5, color: theme.textMuted, marginTop: 6 },
  dLoc: { fontSize: 14.5, color: theme.text, marginTop: 6 },
  dDesc: { fontSize: 14.5, color: theme.text, marginTop: 10, lineHeight: 20 },
  rsvpRow: { flexDirection: 'row', gap: 8, marginTop: 18 },
  rsvpBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F3F2F9', alignItems: 'center' },
  rsvpBtnOn: { backgroundColor: theme.primary },
  rsvpText: { fontSize: 15, fontWeight: '700', color: theme.text },
  whoRow: { marginTop: 14 },
  whoLabel: { fontSize: 13, color: theme.textMuted, fontWeight: '700', marginBottom: 6 },
  whoAvatars: { flexDirection: 'row', flexWrap: 'wrap' },
  ownerRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  ownerBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F3F2F9', alignItems: 'center' },
  ownerBtnText: { fontSize: 15, fontWeight: '700', color: theme.text },
});
