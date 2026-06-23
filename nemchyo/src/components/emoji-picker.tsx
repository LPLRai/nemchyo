import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/lib/theme';
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
      <FlatList
        key={current.key}
        data={current.emojis}
        keyExtractor={(e, i) => current.key + i}
        numColumns={8}
        style={styles.grid}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable style={styles.cell} onPress={() => onPick(item)} android_ripple={{ color: '#00000010', borderless: true }}>
            <Text style={styles.emoji}>{item}</Text>
          </Pressable>
        )}
      />
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
      ) : (
        <FlatList
          key="gif2"
          data={gifs}
          numColumns={2}
          keyExtractor={(g) => g.id}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 5 }}
          renderItem={({ item }) => (
            <Pressable style={styles.gifCell} onPress={() => onPickGif(item.gif)}>
              <Image source={{ uri: item.preview }} style={styles.gifImg} contentFit="cover" />
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.gifCenter}>
              <Text style={{ color: theme.textFaint }}>No GIFs found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 312, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: theme.border },
  modeBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 4 },
  modeTab: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F2F1F8' },
  modeTabOn: { backgroundColor: theme.primary },
  modeText: { fontSize: 13.5, fontWeight: '700', color: theme.textMuted },
  modeTextOn: { color: '#fff' },
  gifSearch: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 8, paddingHorizontal: 12, height: 38, borderRadius: 19, backgroundColor: '#F2F1F8' },
  gifInput: { flex: 1, fontSize: 15, color: theme.text, paddingVertical: 0 },
  gifCenter: { flex: 1, minHeight: 160, alignItems: 'center', justifyContent: 'center' },
  gifCell: { flex: 1, aspectRatio: 1, margin: 3, borderRadius: 10, overflow: 'hidden', backgroundColor: '#ECEAF6' },
  gifImg: { width: '100%', height: '100%' },
  grid: { flex: 1 },
  cell: { width: `${100 / 8}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 27 },
  tabBar: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: '#F7F6FB', paddingHorizontal: 4 },
  tab: { paddingHorizontal: 9, paddingVertical: 9, borderRadius: 8, marginVertical: 4 },
  tabOn: { backgroundColor: theme.primarySoft },
  tabIcon: { fontSize: 20 },
  backspace: { paddingHorizontal: 14, paddingVertical: 11 },
});
