export const formatMemoryDate = (dateLike: string | Date) =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(dateLike));

export const formatUploadTime = (dateLike: string | Date) =>
  new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(
    Math.round((new Date(dateLike).getTime() - Date.now()) / 86_400_000),
    'day',
  );
