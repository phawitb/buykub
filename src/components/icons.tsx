import type { SVGProps } from "react";

/**
 * One drawn icon set: 24x24 box, 1.75 stroke, round caps and joins, currentColor.
 * Unicode glyphs and emoji are not an icon system — every mark here is authored
 * so stroke weight and corner radius stay consistent wherever icons sit together.
 *
 * Icons are decorative by default (`aria-hidden`). Pass a `title` only when the
 * icon is the control's sole label; prefer giving the control real text.
 */
export type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  title?: string;
};

function Icon({
  title,
  className = "size-4",
  ...rest
}: IconProps & { children?: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      {...rest}
    />
  );
}

type Glyph = (props: IconProps) => React.ReactElement;

function glyph(path: React.ReactNode, displayName: string): Glyph {
  const Component = ({ title, ...rest }: IconProps) => (
    <Icon title={title} {...rest}>
      {title ? <title>{title}</title> : null}
      {path}
    </Icon>
  );
  Component.displayName = displayName;
  return Component;
}

export const CheckIcon = glyph(<path d="m4.5 12.75 5 5 10-10.5" />, "CheckIcon");

export const CloseIcon = glyph(<path d="M6 6l12 12M18 6L6 18" />, "CloseIcon");

export const PlusIcon = glyph(<path d="M12 5v14M5 12h14" />, "PlusIcon");

export const MinusIcon = glyph(<path d="M5 12h14" />, "MinusIcon");

export const ArrowRightIcon = glyph(
  <path d="M4 12h15m0 0-5.5-5.5M19 12l-5.5 5.5" />,
  "ArrowRightIcon",
);

export const ArrowLeftIcon = glyph(
  <path d="M20 12H5m0 0 5.5-5.5M5 12l5.5 5.5" />,
  "ArrowLeftIcon",
);

export const ArrowDownIcon = glyph(
  <path d="M12 4v15m0 0 5.5-5.5M12 19l-5.5-5.5" />,
  "ArrowDownIcon",
);

export const ArrowUpIcon = glyph(
  <path d="M12 20V5m0 0 5.5 5.5M12 5 6.5 10.5" />,
  "ArrowUpIcon",
);

export const ChevronDownIcon = glyph(<path d="m6 9.5 6 6 6-6" />, "ChevronDownIcon");

export const ChevronRightIcon = glyph(<path d="m9.5 6 6 6-6 6" />, "ChevronRightIcon");

export const FileIcon = glyph(
  <>
    <path d="M14 3.5H7.5A1.5 1.5 0 0 0 6 5v14a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19V7.5z" />
    <path d="M14 3.5V7a.5.5 0 0 0 .5.5H18" />
  </>,
  "FileIcon",
);

export const DocumentIcon = glyph(
  <>
    <path d="M14 3.5H7.5A1.5 1.5 0 0 0 6 5v14a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19V7.5z" />
    <path d="M14 3.5V7a.5.5 0 0 0 .5.5H18M9 12.5h6M9 16h4" />
  </>,
  "DocumentIcon",
);

export const DownloadIcon = glyph(
  <>
    <path d="M12 4v10m0 0 4-4m-4 4-4-4" />
    <path d="M5 16.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1.5" />
  </>,
  "DownloadIcon",
);

export const PlayIcon = glyph(
  <path d="M8.5 6.3a.6.6 0 0 1 .9-.52l8.1 5.18a.6.6 0 0 1 0 1.01L9.4 17.16a.6.6 0 0 1-.9-.52z" />,
  "PlayIcon",
);

export const KeyIcon = glyph(
  <>
    <circle cx="8" cy="8" r="3.5" />
    <path d="m10.6 10.6 7.4 7.4M15.5 15.5l1.8-1.8M18 18l1.8-1.8" />
  </>,
  "KeyIcon",
);

export const LinkIcon = glyph(
  <>
    <path d="M10.5 13.5 13.5 10.5" />
    <path d="M9.8 16.3l-1.4 1.4a3.4 3.4 0 0 1-4.8-4.8l1.4-1.4" />
    <path d="M14.2 7.7l1.4-1.4a3.4 3.4 0 0 1 4.8 4.8l-1.4 1.4" />
  </>,
  "LinkIcon",
);

export const ShareIcon = glyph(
  <>
    <path d="M12 15.5V4m0 0 4 4m-4-4-4 4" />
    <path d="M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" />
  </>,
  "ShareIcon",
);

export const CopyIcon = glyph(
  <>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" />
  </>,
  "CopyIcon",
);

export const ExternalIcon = glyph(
  <>
    <path d="M14 5h5v5" />
    <path d="M19 5l-7.5 7.5" />
    <path d="M18 14.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.5" />
  </>,
  "ExternalIcon",
);

export const ShopIcon = glyph(
  <>
    <path d="M4 9.5h16V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
    <path d="M4 9.5 5.8 5a1.5 1.5 0 0 1 1.38-.9h9.64A1.5 1.5 0 0 1 18.2 5L20 9.5" />
    <path d="M9.5 13.5h5" />
  </>,
  "ShopIcon",
);

export const ChartIcon = glyph(
  <>
    <path d="M4 20h16" />
    <path d="M7 20v-5.5M12 20V8M17 20v-9" />
  </>,
  "ChartIcon",
);

export const SettingsIcon = glyph(
  <>
    <circle cx="12" cy="12" r="2.75" />
    <path d="M12 3.5v2.2M12 18.3v2.2M4.65 7.75l1.9 1.1M17.45 15.15l1.9 1.1M4.65 16.25l1.9-1.1M17.45 8.85l1.9-1.1" />
  </>,
  "SettingsIcon",
);

export const LibraryIcon = glyph(
  <>
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v13a1.75 1.75 0 0 0-1.75-1.75H5.5A1.5 1.5 0 0 1 4 15.75z" />
    <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v13a1.75 1.75 0 0 1 1.75-1.75h4.75A1.5 1.5 0 0 0 20 15.75z" />
  </>,
  "LibraryIcon",
);

export const WalletIcon = glyph(
  <>
    <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
    <path d="M20 11h-3.5a1.5 1.5 0 0 0 0 3H20" />
  </>,
  "WalletIcon",
);

export const QrIcon = glyph(
  <>
    <rect x="4" y="4" width="6" height="6" rx="1.2" />
    <rect x="14" y="4" width="6" height="6" rx="1.2" />
    <rect x="4" y="14" width="6" height="6" rx="1.2" />
    <path d="M14 14h2.5M20 14v2.5M17.5 17.5H20M14 20h3.5" />
  </>,
  "QrIcon",
);

export const ImageIcon = glyph(
  <>
    <rect x="4" y="5" width="16" height="14" rx="2" />
    <circle cx="9" cy="10" r="1.4" />
    <path d="m5 17 4.2-4.2a1.5 1.5 0 0 1 2.1 0L15 16.5l1.6-1.6a1.5 1.5 0 0 1 2.1 0L20 16.2" />
  </>,
  "ImageIcon",
);

export const TrashIcon = glyph(
  <>
    <path d="M5 7.5h14M10 4.5h4M6.5 7.5 7.2 19a1.5 1.5 0 0 0 1.5 1.4h6.6a1.5 1.5 0 0 0 1.5-1.4l.7-11.5" />
    <path d="M10.5 11v6M13.5 11v6" />
  </>,
  "TrashIcon",
);

export const PencilIcon = glyph(
  <>
    <path d="M16.1 4.9a2 2 0 0 1 2.83 0l.17.17a2 2 0 0 1 0 2.83L8.5 18.5l-4 1 1-4z" />
    <path d="m14.5 6.5 3 3" />
  </>,
  "PencilIcon",
);

export const WarningIcon = glyph(
  <>
    <path d="M12 4.8 3.9 18.2a1.3 1.3 0 0 0 1.1 2h14a1.3 1.3 0 0 0 1.1-2z" />
    <path d="M12 10v4" />
    <circle cx="12" cy="17" r=".6" fill="currentColor" stroke="none" />
  </>,
  "WarningIcon",
);

export const GripIcon = glyph(
  <path d="M8 7.5h8M8 12h8M8 16.5h8" />,
  "GripIcon",
);

export const MailIcon = glyph(
  <>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
    <path d="m4.5 7.5 6.6 5.1a1.5 1.5 0 0 0 1.8 0l6.6-5.1" />
  </>,
  "MailIcon",
);

export const ClockIcon = glyph(
  <>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 7.8V12l3 1.9" />
  </>,
  "ClockIcon",
);

export const BoxIcon = glyph(
  <>
    <path d="M20.5 8.2v7.6a1.5 1.5 0 0 1-.78 1.32l-7 3.78a1.5 1.5 0 0 1-1.44 0l-7-3.78A1.5 1.5 0 0 1 3.5 15.8V8.2a1.5 1.5 0 0 1 .78-1.32l7-3.78a1.5 1.5 0 0 1 1.44 0l7 3.78A1.5 1.5 0 0 1 20.5 8.2Z" />
    <path d="m3.8 7.4 8.2 4.4 8.2-4.4M12 11.8V20.5" />
  </>,
  "BoxIcon",
);

/** Filled by default — a rating star reads as a solid mark, not an outline. */
export const StarIcon = ({ title, className = "size-4", ...rest }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden={title ? undefined : true}
    role={title ? "img" : undefined}
    {...rest}
  >
    {title ? <title>{title}</title> : null}
    <path d="M12 3.2l2.68 5.43 5.99.87-4.33 4.22 1.02 5.96L12 16.87l-5.36 2.81 1.02-5.96L3.33 9.5l5.99-.87z" />
  </svg>
);
StarIcon.displayName = "StarIcon";
