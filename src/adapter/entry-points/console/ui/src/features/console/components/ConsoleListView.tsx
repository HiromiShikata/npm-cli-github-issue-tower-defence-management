import { Badge } from '@/components/ui/badge';
import type { ConsoleListItem } from '../types';

export type ConsoleListViewProps = {
  items: ConsoleListItem[];
  isLoading: boolean;
  error: string | null;
};

export const ConsoleListView = ({
  items,
  isLoading,
  error,
}: ConsoleListViewProps) => {
  if (error !== null) {
    return (
      <p role="alert" className="p-4 text-sm text-destructive">
        Failed to load list: {error}
      </p>
    );
  }

  if (isLoading) {
    return <p className="p-4 text-sm text-muted-foreground">Loading list...</p>;
  }

  if (items.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">No items.</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {items.map((item) => (
        <li key={item.itemId} className="flex flex-col gap-1 p-3">
          <div className="flex items-center gap-2">
            <Badge variant={item.isPr ? 'default' : 'secondary'}>
              {item.isPr ? 'PR' : 'Issue'}
            </Badge>
            <a
              href={item.url}
              className="font-medium underline-offset-2 hover:underline"
            >
              {item.title}
            </a>
            <span className="text-sm text-muted-foreground">
              #{item.number}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{item.repo}</span>
            {item.story !== '' && <span>story: {item.story}</span>}
            <span>{new Date(item.createdAt).toISOString()}</span>
          </div>
        </li>
      ))}
    </ul>
  );
};
