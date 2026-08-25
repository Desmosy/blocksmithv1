import { format, formatDistanceToNowStrict } from "date-fns";

export const formatDate = (value: string | Date) => format(new Date(value), "MMM d, yyyy");
export const formatDateTime = (value: string | Date) => format(new Date(value), "MMM d, yyyy, h:mm a");
export const formatRelativeDate = (value: string | Date) => formatDistanceToNowStrict(new Date(value), { addSuffix: true });
