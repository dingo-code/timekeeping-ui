export default function DataTableFooter({
  totalItems,
  currentPage,
  totalPages,
  pageSize,
  searchTerm = '',
  onPageChange,
}) {
  const safePage = Math.min(currentPage, totalPages);
  const firstItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const lastItem = Math.min(safePage * pageSize, totalItems);

  return (
    <div className="mt-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-gray-50 p-3 rounded border border-gray-100">
      <span className="text-xs text-gray-600">
        Menampilkan {firstItem}-{lastItem} dari {totalItems} data
        {searchTerm ? ` untuk pencarian "${searchTerm}"` : ''}
      </span>
      {totalPages > 1 && (
        <div className="space-x-2">
          <span className="text-xs font-bold text-gray-700">Halaman {safePage} dari {totalPages}</span>
          <button
            onClick={() => onPageChange(Math.max(safePage - 1, 1))}
            disabled={safePage === 1}
            className="px-3 py-1 border rounded text-xs font-bold bg-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Sebelumnya
          </button>
          <button
            onClick={() => onPageChange(Math.min(safePage + 1, totalPages))}
            disabled={safePage === totalPages}
            className="px-3 py-1 border rounded text-xs font-bold bg-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Selanjutnya
          </button>
        </div>
      )}
    </div>
  );
}
