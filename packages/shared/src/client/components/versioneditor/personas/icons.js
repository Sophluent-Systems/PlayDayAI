
import * as LucideIcons from 'lucide-react';

const iconNameMap = {
  Psychology: 'Brain',
  RunCircle: 'Running',
  DesktopWindows: 'Monitor',
  Compress: 'Minimize2',
  Handyman: 'Hammer',
  Warning: 'TriangleAlert',
  Chat: 'MessageCircle',
  Person: 'UserRound',
  Add: 'Plus',
  AccountCircle: 'CircleUser',
  AccessibilityNew: 'Accessibility',
  AirlineSeatIndividualSuite: 'BedSingle',
  Android: 'Bot',
  Pets: 'PawPrint',
  Work: 'BriefcaseBusiness',
  School: 'GraduationCap',
  LocalHospital: 'Hospital',
  FitnessCenter: 'Dumbbell',
  Kitchen: 'CookingPot',
  LocalCafe: 'Coffee',
  LocalFlorist: 'Flower2',
  LocalLibrary: 'Library',
  LocalBar: 'Wine',
  Brush: 'Paintbrush2',
  CameraAlt: 'Camera',
  DirectionsBike: 'Bike',
  EmojiPeople: 'Smile',
  Face: 'SmilePlus',
  Favorite: 'Heart',
  Flight: 'Plane',
  Group: 'Users',
  Hearing: 'Ear',
  Hiking: 'Mountain',
  Home: 'House',
  HourglassEmpty: 'Hourglass',
  Language: 'Languages',
  LaptopMac: 'Laptop',
  MusicNote: 'Music',
  Notifications: 'Bell',
  Palette: 'Palette',
  Park: 'Trees',
  PhoneAndroid: 'Smartphone',
  Pool: 'Waves',
  Restaurant: 'UtensilsCrossed',
  Rowing: 'Sailboat',
  ShoppingCart: 'ShoppingCart',
  Spa: 'Lotus',
  SportsEsports: 'Gamepad2',
  SportsSoccer: 'Football',
  ThumbUp: 'ThumbsUp',
  Train: 'Train',
  Visibility: 'Eye',
  WbSunny: 'Sun',
  Weekend: 'BedDouble',
};

const fallbackIconName = 'UserRound';

export const personaIconOptions = Object.keys(iconNameMap);

export const PersonaIcons = new Proxy(
  {},
  {
    get(_, prop) {
      const iconName = typeof prop === 'string' ? iconNameMap[prop] : undefined;
      return (iconName && LucideIcons[iconName]) || LucideIcons[fallbackIconName] || (() => null);
    },
    has(_, prop) {
      return typeof prop === 'string' ? iconNameMap.hasOwnProperty(prop) : false;
    },
  }
);
