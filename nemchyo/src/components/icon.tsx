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
  | 'backspace'
  | 'phone'
  | 'video'
  | 'search'
  | 'bell'
  | 'bell-off'
  | 'calendar'
  | 'image'
  | 'document'
  | 'poll'
  | 'chevron-down'
  | 'phone-off'
  | 'mic-off'
  | 'video-off'
  | 'switch-camera';

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
    case 'phone':
      return (
        <Svg {...box}>
          <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" {...s} />
        </Svg>
      );
    case 'video':
      return (
        <Svg {...box}>
          <Path d="M23 7l-7 5 7 5V7z" {...s} />
          <Rect x={1} y={5} width={15} height={14} rx={2} {...s} />
        </Svg>
      );
    case 'search':
      return (
        <Svg {...box}>
          <Circle cx={11} cy={11} r={8} {...s} />
          <Line x1={21} y1={21} x2={16.65} y2={16.65} {...s} />
        </Svg>
      );
    case 'bell':
      return (
        <Svg {...box}>
          <Path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" {...s} />
          <Path d="M13.73 21a2 2 0 0 1-3.46 0" {...s} />
        </Svg>
      );
    case 'bell-off':
      return (
        <Svg {...box}>
          <Path d="M13.73 21a2 2 0 0 1-3.46 0" {...s} />
          <Path d="M18.63 13A17.89 17.89 0 0 1 18 8" {...s} />
          <Path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" {...s} />
          <Path d="M18 8a6 6 0 0 0-9.33-5" {...s} />
          <Line x1={1} y1={1} x2={23} y2={23} {...s} />
        </Svg>
      );
    case 'calendar':
      return (
        <Svg {...box}>
          <Rect x={3} y={4} width={18} height={18} rx={2} {...s} />
          <Line x1={16} y1={2} x2={16} y2={6} {...s} />
          <Line x1={8} y1={2} x2={8} y2={6} {...s} />
          <Line x1={3} y1={10} x2={21} y2={10} {...s} />
        </Svg>
      );
    case 'image':
      return (
        <Svg {...box}>
          <Rect x={3} y={3} width={18} height={18} rx={2} {...s} />
          <Circle cx={8.5} cy={8.5} r={1.5} {...s} />
          <Path d="M21 15l-5-5L5 21" {...s} />
        </Svg>
      );
    case 'document':
      return (
        <Svg {...box}>
          <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" {...s} />
          <Path d="M14 2v6h6" {...s} />
          <Line x1={16} y1={13} x2={8} y2={13} {...s} />
          <Line x1={16} y1={17} x2={8} y2={17} {...s} />
          <Line x1={10} y1={9} x2={8} y2={9} {...s} />
        </Svg>
      );
    case 'poll':
      return (
        <Svg {...box}>
          <Line x1={18} y1={20} x2={18} y2={10} {...s} />
          <Line x1={12} y1={20} x2={12} y2={4} {...s} />
          <Line x1={6} y1={20} x2={6} y2={14} {...s} />
        </Svg>
      );
    case 'chevron-down':
      return (
        <Svg {...box}>
          <Path d="M6 9l6 6 6-6" {...s} />
        </Svg>
      );
    case 'phone-off':
      return (
        <Svg {...box}>
          <Path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" {...s} />
          <Line x1={23} y1={1} x2={1} y2={23} {...s} />
        </Svg>
      );
    case 'mic-off':
      return (
        <Svg {...box}>
          <Line x1={1} y1={1} x2={23} y2={23} {...s} />
          <Path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6" {...s} />
          <Path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" {...s} />
          <Line x1={12} y1={19} x2={12} y2={22} {...s} />
          <Line x1={8} y1={22} x2={16} y2={22} {...s} />
        </Svg>
      );
    case 'video-off':
      return (
        <Svg {...box}>
          <Path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" {...s} />
          <Line x1={1} y1={1} x2={23} y2={23} {...s} />
        </Svg>
      );
    case 'switch-camera':
      return (
        <Svg {...box}>
          <Path d="M23 4v6h-6" {...s} />
          <Path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" {...s} />
        </Svg>
      );
  }
}
