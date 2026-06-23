import DateTimePicker from '@react-native-community/datetimepicker';
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { pb } from '@/lib/pb';
import { useColors, useThemedStyles, type Colors } from '@/lib/theme';

function combine(date: Date, time: Date) {
  const d = new Date(date);
  d.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return d;
}
const fmtD = (d: Date) => d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const fmtT = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export default function NewEvent() {
  const { date: dateParam, id } = useLocalSearchParams<{ date?: string; id?: string }>();
  const { isValid, user } = useAuth();
  const router = useRouter();
  const theme = useColors();
  const styles = useThemedStyles(makeStyles);
  const init = dateParam ? new Date(dateParam) : new Date();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(init);
  const [start, setStart] = useState(() => { const d = new Date(init); d.setHours(12, 0, 0, 0); return d; });
  const [end, setEnd] = useState(() => { const d = new Date(init); d.setHours(13, 0, 0, 0); return d; });
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState('');
  const [desc, setDesc] = useState('');
  const [show, setShow] = useState<null | 'date' | 'start' | 'end'>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const ev = await pb.collection('calendar_events').getOne(id);
        setTitle(ev.title || '');
        setDate(new Date(ev.starts_at));
        setStart(new Date(ev.starts_at));
        if (ev.ends_at) setEnd(new Date(ev.ends_at));
        setAllDay(!!ev.all_day);
        setLocation(ev.location || '');
        setDesc(ev.description || '');
      } catch {}
    })();
  }, [id]);

  if (!isValid) return <Redirect href="/" />;

  async function save() {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      let startsAt: Date;
      if (allDay) { startsAt = new Date(date); startsAt.setHours(0, 0, 0, 0); }
      else startsAt = combine(date, start);
      const endsAt = allDay ? '' : combine(date, end).toISOString();
      const data: any = {
        title: title.trim(),
        description: desc.trim(),
        starts_at: startsAt.toISOString(),
        ends_at: endsAt,
        all_day: allDay,
        location: location.trim(),
      };
      if (id) await pb.collection('calendar_events').update(id, data);
      else await pb.collection('calendar_events').create({ ...data, created_by: user.id });
      router.back();
    } catch (e: any) {
      setSaving(false);
      Alert.alert("Couldn't save", e?.message || 'Please try again.');
    }
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: id ? 'Edit event' : 'New event',
          headerRight: () => (
            <Pressable onPress={save} disabled={!title.trim() || saving} hitSlop={8}>
              <Text style={[styles.save, (!title.trim() || saving) && { opacity: 0.4 }]}>Save</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <TextInput
          style={styles.titleInput}
          placeholder="Event title"
          placeholderTextColor={theme.textFaint}
          value={title}
          onChangeText={setTitle}
          maxLength={200}
        />

        <Pressable style={styles.row} onPress={() => setShow('date')}>
          <Text style={styles.rowLabel}>Date</Text>
          <Text style={styles.rowValue}>{fmtD(date)}</Text>
        </Pressable>

        <Pressable style={styles.row} onPress={() => setAllDay((a) => !a)}>
          <Text style={styles.rowLabel}>All day</Text>
          <Text style={{ fontSize: 22, color: allDay ? theme.primary : theme.textFaint }}>{allDay ? '☑' : '☐'}</Text>
        </Pressable>

        {!allDay ? (
          <>
            <Pressable style={styles.row} onPress={() => setShow('start')}>
              <Text style={styles.rowLabel}>Starts</Text>
              <Text style={styles.rowValue}>{fmtT(start)}</Text>
            </Pressable>
            <Pressable style={styles.row} onPress={() => setShow('end')}>
              <Text style={styles.rowLabel}>Ends</Text>
              <Text style={styles.rowValue}>{fmtT(end)}</Text>
            </Pressable>
          </>
        ) : null}

        <TextInput
          style={styles.field}
          placeholder="Location (optional)"
          placeholderTextColor={theme.textFaint}
          value={location}
          onChangeText={setLocation}
          maxLength={200}
        />
        <TextInput
          style={[styles.field, styles.multiline]}
          placeholder="Description (optional)"
          placeholderTextColor={theme.textFaint}
          value={desc}
          onChangeText={setDesc}
          multiline
          maxLength={1000}
        />
      </ScrollView>

      {show ? (
        <DateTimePicker
          value={show === 'date' ? date : show === 'start' ? start : end}
          mode={show === 'date' ? 'date' : 'time'}
          onChange={(e, d) => {
            setShow(null);
            if (e.type === 'set' && d) {
              if (show === 'date') setDate(d);
              else if (show === 'start') setStart(d);
              else setEnd(d);
            }
          }}
        />
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  save: { color: theme.primary, fontSize: 16, fontWeight: '700' },
  titleInput: { backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 18, fontWeight: '600', color: theme.text, borderWidth: 1, borderColor: theme.border, marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, paddingVertical: 15, marginBottom: 10 },
  rowLabel: { fontSize: 16, fontWeight: '600', color: theme.text },
  rowValue: { fontSize: 15.5, color: theme.primary, fontWeight: '600' },
  field: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15.5, color: theme.text, marginTop: 4, marginBottom: 10 },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
});
