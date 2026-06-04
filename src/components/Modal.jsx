import React from 'react';

export default function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
        
        {/* Header Modal */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-red-600 text-2xl leading-none font-bold transition"
            aria-label="Tutup Modal"
          >
            &times;
          </button>
        </div>
        
        {/* Konten Modal (Formulir dll akan masuk ke sini) */}
        <div className="overflow-y-auto">
          {children}
        </div>

      </div>
    </div>
  );
}