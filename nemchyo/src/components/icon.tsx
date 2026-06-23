import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'emoji'
  | 'keyboard'
  | 'attach'
  | 'camera'
  | 'mic'
  | 'send'
  | 'check'
  | 'trash'
  | 'backspace';

// Hand-drawn line icons via react-native-svg (already native in the build, so
// these ship over-the-air with no new dependency and no icon-font to load).
export function Icon({ name, size = 24, color = '#54656F' }: { name: IconName; size?: number; color?: string }) {
  const s = { stroke: color, strokeWidth: 2, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const box = { width: size, height: size, viewBox: '0 0 24 24' };

  switch (name) {
    case 'emoji':
      return (
        <Svg {...box}>
          <Circle cx={12} cy={12} r={9.3} {...s} />
          <Path d="M8.3 14.3 Q12 17.6 15.7 14.3" {...s} />
          <Circle cx={8.8} cy={10} r={1.15} fill={color} />
          <Circle cx={15.2} cy={10} r={1.15} fill={color} />
        </Svg>
      );
    case 'keyboard':
      return (
        <Svg {...box}>
          <Rect x={2.5} y={6} width={19} height={12} rx={2.5} {...s} />
          {[6, 9.25, 12.5, 15.75].map((x) => (
            <Circle key={'a' + x} cx={x} cy={10} r={0.85} fill={color} />
          ))}
          {[6, 9.25, 12.5, 15.75].map((x) => (
            <Circle key={'b' + x} cx={x} cy={13} r={0.85} fill={color} />
          ))}
          <Line x1={8} y1={15.6} x2={16} y2={15.6} {...s} />
          <Circle cx={18.6} cy={10} r={0.85} fill={color} />
          <Circle cx={18.6} cy={13} r={0.85} fill={color} />
        </Svg>
      );
    case 'attach':
      return (
        <Svg {...box}>
          <Path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" {...s} />
        </Svg>
      );
    case 'camera':
      return (
        <Svg {...box}>
          <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" {...s} />
          <Circle cx={12} cy={13} r={4} {...s} />
        </Svg>
      );
    case 'mic':
      return (
        <Svg {...box}>
          <Path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" {...s} />
          <Path d="M19 10v1a7 7 0 0 1-14 0v-1" {...s} />
          <Line x1={12} y1={19} x2={12} y2={22} {...s} />
          <Line x1={8} y1={22} x2={16} y2={22} {...s} />
        </Svg>
      );
    case 'send':
      return (
        <Svg {...box}>
          <Path d="M2.2 21L23 12 2.2 3 2.1 10l14 2-14 2z" fill={color} />
        </Svg>
      );
    case 'check':
      return (
        <Svg {...box}>
          <Path d="M20 6L9 17l-5-5" {...s} />
        </Svg>
      );
    case 'trash':
      return (
        <Svg {...box}>
          <Line x1={3.5} y1={6} x2={20.5} y2={6} {...s} />
          <Path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" {...s} />
          <Path d="M18.5 6v14a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V6" {...s} />
          <Line x1={10} y1={11} x2={10} y2={17} {...s} />
          <Line x1={14} y1={11} x2={14} y2={17} {...s} />
        </Svg>
      );
    case 'backspace':
      return (
        <Svg {...box}>
          <Path d="M21 5H8.5a2 2 0 0 0-1.6.8L2.5 12l4.4 6.2a2 2 0 0 0 1.6.8H21a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z" {...s} />
          <Line x1={17} y1={9.5} x2={12} y2={14.5} {...s} />
          <Line x1={12} y1={9.5} x2={17} y2={14.5} {...s} />
        </Svg>
      );
  }
}
