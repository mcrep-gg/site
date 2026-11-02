/** A Player's skin face, rendered by mc-heads.net from their UUID. Pixel art, so no smoothing. */
export function SkinHead({ uuid, username, size = 40 }: { uuid: string; username: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny pixel-art avatar from a third party; no optimization wanted
    <img
      src={`https://mc-heads.net/avatar/${uuid}/${Math.max(size, 8) * 2}`}
      alt={`${username}'s skin`}
      width={size}
      height={size}
      loading="lazy"
      className="shrink-0 rounded-[3px] bg-surface-3 [image-rendering:pixelated]"
      style={{ width: size, height: size }}
    />
  );
}
