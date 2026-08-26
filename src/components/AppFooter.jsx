export default function AppFooter({ admin = false }) {
  return (
    <footer
      className={`fixed bottom-0 z-30 border-t border-gray-200 bg-white px-4 py-4 text-center text-xs text-gray-500 shadow-[0_-1px_4px_rgba(0,0,0,0.04)] ${
        admin ? 'left-64 right-0' : 'inset-x-0'
      }`}
    >
      &copy; 2026 Cyverra Studio. All rights reserved.
    </footer>
  );
}
