import { ReactNode } from 'react';

interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => ReactNode);
  className?: string;
}

interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  isLoading?: boolean;
  emptyMessage?: string;
}

export default function Table<T extends Record<string, any>>({
  data,
  columns,
  isLoading = false,
  emptyMessage = 'No data available',
}: TableProps<T>) {
  const getCellValue = (row: T, column: Column<T>): ReactNode => {
    if (typeof column.accessor === 'function') {
      return column.accessor(row);
    }
    return row[column.accessor];
  };

  if (isLoading) {
    return (
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            <p className="text-text2 text-sm">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-surface2">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={index}
                  className={`
                    px-3.5 py-2.5 text-left text-[11px] font-semibold
                    text-text3 uppercase tracking-wide border-b border-border
                    whitespace-nowrap
                    ${column.className || ''}
                  `}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3.5 py-16 text-center text-text3 text-sm"
                >
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-4xl opacity-50">📭</span>
                    <p>{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="hover:bg-white/[0.02] transition-colors"
                >
                  {columns.map((column, colIndex) => (
                    <td
                      key={colIndex}
                      className={`
                        px-3.5 py-3 border-b border-border text-[13px] text-text2
                        ${rowIndex === data.length - 1 ? 'border-b-0' : ''}
                        ${column.className || ''}
                      `}
                    >
                      {getCellValue(row, column)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
