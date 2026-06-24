import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, useThemedStyles, type Colors } from '@/lib/theme';
import { tenorSearch, type TenorGif } from '@/lib/tenor';
import { Icon } from './icon';

const CATEGORIES: { key: string; label: string; emojis: string[] }[] = [
  {
    key: 'smileys',
    label: '😀',
    emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','😎','🤓','🧐','😕','😟','🙁','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','💩','🤡','👻','👽','🤖'],
  },
  {
    key: 'gestures',
    label: '👍',
    emojis: ['👋','🤚','✋','🖐️','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','💪','🦾','✍️','💅','👀','👁️','👅','👄','👶','🧒','👦','👧','🧑','👨','👩','🧓','👴','👵','🙍','🙎','🙅','🙆','💁','🙋','🧏','🤦','🤷','👮','🕵️','💂','👷','🤴','👸','👰','🤵','🦸','🦹','🎅','🤶','💆','💇','🚶','🏃','💃','🕺','👯'],
  },
  {
    key: 'hearts',
    label: '❤️',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','💋','💯','💢','💥','💫','💦','💨','🕳️','💬','💭','🔥','⭐','🌟','✨','⚡','☄️','🌈','☀️','🌤️','⛅','🌧️','⛈️','❄️','💧','🌊'],
  },
  {
    key: 'animals',
    label: '🐶',
    emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦗','🕷️','🦂','🐢','🐍','🦎','🐙','🦑','🦐','🦀','🐠','🐟','🐡','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🐘','🦏','🐪','🐫','🦒','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🐐','🦌','🐓','🦃','🕊️','🐕','🐩','🐈','🐇','🌵','🎄','🌲','🌳','🌴','🌱','🌿','☘️','🍀','🎍','🌾','🌷','🌹','🥀','🌺','🌸','🌼','🌻'],
  },
  {
    key: 'food',
    label: '🍔',
    emojis: ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🌽','🥕','🧄','🧅','🥔','🍠','🥐','🥯','🍞','🥖','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🥪','🌮','🌯','🥙','🧆','🥗','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🍤','🍙','🍚','🍘','🍢','🍡','🍧','🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','☕','🍵','🧃','🥤','🍶','🍺','🍷','🥂','🥃','🍸','🍹'],
  },
  {
    key: 'activity',
    label: '⚽',
    emojis: ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🏑','🥍','🏏','⛳','🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛷','⛸️','🥌','🎿','⛷️','🏂','🏋️','🤼','🤸','⛹️','🤺','🤾','🏌️','🏇','🧘','🏄','🏊','🤽','🚣','🧗','🚵','🚴','🏆','🥇','🥈','🥉','🏅','🎖️','🏵️','🎗️','🎫','🎟️','🎪','🤹','🎭','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🎷','🎺','🎸','🪕','🎻','🎲','♟️','🎯','🎳','🎮','🎰','🧩'],
  },
  {
    key: 'travel',
    label: '✈️',
    emojis: ['🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🚚','🚛','🚜','🛴','🚲','🛵','🏍️','🚨','🚔','🚍','🚘','🚖','🚡','🚠','🚟','🚃','🚋','🚞','🚝','🚄','🚅','🚈','🚂','🚆','🚇','🚊','🚉','✈️','🛫','🛬','🛩️','💺','🚁','🚟','🚀','🛸','🚢','⛵','🚤','🛥️','🛳️','⛴️','⚓','⛽','🚧','🚦','🚥','🗺️','🗿','🗽','🗼','🏰','🏯','🏟️','🎡','🎢','🎠','⛲','⛱️','🏖️','🏝️','🏔️','⛰️','🌋','🏕️','⛺','🏠','🏡','🏘️','🏢','🏬','🏣','🏥','🏦','🏨','🏪','🏫','💒','⛪','🕌','🕍','🛕'],
  },
  {
    key: 'objects',
    label: '💡',
    emojis: ['⌚','📱','💻','⌨️','🖥️','🖨️','🖱️','🕹️','💾','💿','📷','📸','📹','🎥','📽️','📞','☎️','📟','📠','📺','📻','⏰','⏱️','⏲️','🕰️','💡','🔦','🏮','📔','📕','📖','📚','📒','📃','📄','📰','📑','🔖','💰','💴','💵','💳','💎','⚖️','🔧','🔨','⚒️','🛠️','⛏️','🔩','⚙️','🧰','🧲','🔫','💣','🔪','🛡️','🚬','🔮','📿','💈','🔭','🔬','🕳️','💊','💉','🩹','🩺','🌡️','🧹','🧺','🧻','🚽','🚿','🛁','🧼','🧽','🔑','🗝️','🚪','🛋️','🛏️','🖼️','🛒','🎁','🎈','🎏','🎀','🎊','🎉','🧧'],
  },
  {
    key: 'symbols',
    label: '✅',
    emojis: ['✅','❌','❎','✔️','☑️','❓','❔','❗','❕','‼️','⁉️','⚠️','🚫','🔞','📵','🚭','❌','⭕','🔴','🟠','🟡','🟢','🔵','🟣','🟤','⚫','⚪','🟥','🟧','🟨','🟩','🟦','🟪','⬛','⬜','🔶','🔷','🔸','🔹','🔺','🔻','💠','🔘','🔳','🔲','♻️','🔱','📛','⚜️','〽️','🉑','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','🆔','🆕','🆖','🆗','🆙','🆒','🆓','ℹ️','🔤','🔡','🔠','🔣','🎵','🎶','➕','➖','➗','✖️','💲','💱','™️','©️','®️','〰️','🔚','🔙','🔛','🔝','🔜','✳️','❇️','™️'],
  },
];

export function EmojiPicker({
  onPick,
  onBackspace,
  onPickGif,
}: {
  onPick: (e: string) => void;
  onBackspace: () => void;
  onPickGif: (url: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const theme = useColors();
  const styles = useThemedStyles(makeStyles);
  const [mode, setMode] = useState<'emoji' | 'gif'>('emoji');
  const [cat, setCat] = useState(0);
  const current = CATEGORIES[cat];

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      <View style={styles.modeBar}>
        <Pressable style={[styles.modeTab, mode === 'emoji' && styles.modeTabOn]} onPress={() => setMode('emoji')}>
          <Text style={[styles.modeText, mode === 'emoji' && styles.modeTextOn]}>Emoji</Text>
        </Pressable>
        <Pressable style={[styles.modeTab, mode === 'gif' && styles.modeTabOn]} onPress={() => setMode('gif')}>
          <Text style={[styles.modeText, mode === 'gif' && styles.modeTextOn]}>GIF</Text>
        </Pressable>
      </View>

      {mode === 'gif' ? (
        <GifPanel onPickGif={onPickGif} />
      ) : (
      <>
      <ScrollView
        key={current.key}
        style={styles.grid}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.gridContent}>
        {current.emojis.map((item, i) => (
          <Pressable
            key={current.key + i}
            style={styles.cell}
            onPress={() => onPick(item)}
            android_ripple={{ color: '#00000010', borderless: true }}>
            <Text style={styles.emoji}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.tabBar}>
        <FlatList
          horizontal
          data={CATEGORIES}
          keyExtractor={(c) => c.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
          renderItem={({ item, index }) => (
            <Pressable style={[styles.tab, index === cat && styles.tabOn]} onPress={() => setCat(index)}>
              <Text style={styles.tabIcon}>{item.label}</Text>
            </Pressable>
          )}
        />
        <Pressable style={styles.backspace} onPress={onBackspace} hitSlop={6}>
          <Icon name="backspace" size={22} color={theme.textMuted} />
        </Pressable>
      </View>
      </>
      )}
    </View>
  );
}

function GifPanel({ onPickGif }: { onPickGif: (url: string) => void }) {
  const theme = useColors();
  const styles = useThemedStyles(makeStyles);
  const [q, setQ] = useState('');
  const [gifs, setGifs] = useState<TenorGif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await tenorSearch(q);
        if (active) setGifs(r);
      } catch {
        if (active) setGifs([]);
      } finally {
        if (active) setLoading(false);
      }
    }, q ? 350 : 0);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.gifSearch}>
        <Icon name="search" size={16} color={theme.textFaint} />
        <TextInput
          style={styles.gifInput}
          value={q}
          onChangeText={setQ}
          placeholder="Search Tenor GIFs"
          placeholderTextColor={theme.textFaint}
          returnKeyType="search"
        />
      </View>
      {loading ? (
        <View style={styles.gifCenter}>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : gifs.length === 0 ? (
        <View style={styles.gifCenter}>
          <Text style={{ color: theme.textFaint }}>No GIFs found</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.gifWrap}>
          {gifs.map((item) => (
            <Pressable key={item.id} style={styles.gifCell} onPress={() => onPickGif(item.gif)}>
              <Image source={{ uri: item.preview }} style={styles.gifImg} contentFit="cover" />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (theme: Colors) => StyleSheet.create({
  wrap: { height: 312, backgroundColor: theme.sheet, borderTopWidth: 1, borderTopColor: theme.border },
  modeBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 4 },
  modeTab: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16, backgroundColor: theme.field },
  modeTabOn: { backgroundColor: theme.primary },
  modeText: { fontSize: 13.5, fontWeight: '700', color: theme.textMuted },
  modeTextOn: { color: '#fff' },
  gifSearch: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 8, paddingHorizontal: 12, height: 38, borderRadius: 19, backgroundColor: theme.field },
  gifInput: { flex: 1, fontSize: 15, color: theme.text, paddingVertical: 0 },
  gifCenter: { flex: 1, minHeight: 160, alignItems: 'center', justifyContent: 'center' },
  gifWrap: { flexDirection: 'row', flexWrap: 'wrap', padding: 4 },
  gifCell: { width: 96, height: 96, margin: 3, borderRadius: 10, overflow: 'hidden', backgroundColor: theme.chatBg },
  gifImg: { width: '100%', height: '100%' },
  grid: { flex: 1 },
  gridContent: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 6, paddingTop: 2 },
  cell: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 26 },
  tabBar: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.bg, paddingHorizontal: 4 },
  tab: { paddingHorizontal: 9, paddingVertical: 9, borderRadius: 8, marginVertical: 4 },
  tabOn: { backgroundColor: theme.primarySoft },
  tabIcon: { fontSize: 20 },
  backspace: { paddingHorizontal: 14, paddingVertical: 11 },
});
