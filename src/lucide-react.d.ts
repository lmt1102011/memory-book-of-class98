declare module 'lucide-react' {
  import * as React from 'react';

  export interface LucideProps extends React.SVGProps<SVGSVGElement> {
    size?: number | string;
    absoluteStrokeWidth?: boolean;
  }

  export type LucideIcon = React.ForwardRefExoticComponent<
    Omit<LucideProps, 'ref'> & React.RefAttributes<SVGSVGElement>
  >;

  export const ArrowLeft: LucideIcon;
  export const BadgeCheck: LucideIcon;
  export const Bell: LucideIcon;
  export const BookOpen: LucideIcon;
  export const Camera: LucideIcon;
  export const CameraIcon: LucideIcon;
  export const Check: LucideIcon;
  export const CheckCheck: LucideIcon;
  export const Download: LucideIcon;
  export const Eye: LucideIcon;
  export const Filter: LucideIcon;
  export const Heart: LucideIcon;
  export const Home: LucideIcon;
  export const Image: LucideIcon;
  export const Images: LucideIcon;
  export const ImagePlus: LucideIcon;
  export const Layers: LucideIcon;
  export const Lock: LucideIcon;
  export const Menu: LucideIcon;
  export const MessageCircle: LucideIcon;
  export const Music: LucideIcon;
  export const Music2: LucideIcon;
  export const RefreshCw: LucideIcon;
  export const RotateCcw: LucideIcon;
  export const Search: LucideIcon;
  export const Send: LucideIcon;
  export const Sparkles: LucideIcon;
  export const Trash2: LucideIcon;
  export const Trophy: LucideIcon;
  export const Upload: LucideIcon;
  export const UserRound: LucideIcon;
  export const Users: LucideIcon;
  export const Video: LucideIcon;
  export const X: LucideIcon;
}
