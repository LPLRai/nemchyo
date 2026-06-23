import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/lib/theme';
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

export function EmojiPicker({ onPick, onBackspace }: { onPick: (e: string) => void; onBackspace: () => void }) {
  const insets = useSafeAreaInsets();
  const [cat, setCat] = useState(0);
  const current = CATEGORIES[cat];

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 6) }]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 300, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: theme.border },
  grid: { flex: 1 },
  cell: { width: `${100 / 8}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 27 },
  tabBar: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: '#F7F6FB', paddingHorizontal: 4 },
  tab: { paddingHorizontal: 9, paddingVertical: 9, borderRadius: 8, marginVertical: 4 },
  tabOn: { backgroundColor: theme.primarySoft },
  tabIcon: { fontSize: 20 },
  backspace: { paddingHorizontal: 14, paddingVertical: 11 },
});
