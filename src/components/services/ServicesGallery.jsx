import React, { useState, useEffect, useCallback } from 'react';

const images = [
  'https://firebasestorage.googleapis.com/v0/b/broquelizate-8d060.appspot.com/o/Assets%2FPerfos%2Fconch.jpg?alt=media&token=7b232e1f-24a6-4fa4-bf1b-6d1fbcec4ff9',
  'https://firebasestorage.googleapis.com/v0/b/broquelizate-8d060.appspot.com/o/Assets%2FPerfos%2Fcontraconch.jpg?alt=media&token=17983f66-feb2-4753-b35f-eb8fe0e00d8b',
  'https://firebasestorage.googleapis.com/v0/b/broquelizate-8d060.appspot.com/o/Assets%2FPerfos%2Fdait.jpg?alt=media&token=2dd084f7-d169-4d37-9b1f-4f1a302c7e08',
  'https://firebasestorage.googleapis.com/v0/b/broquelizate-8d060.appspot.com/o/Assets%2FPerfos%2Fdoble-lobulo.jpg?alt=media&token=e62cba3a-e1ab-4675-8e9a-74e3a5ec0d27',
  'https://firebasestorage.googleapis.com/v0/b/broquelizate-8d060.appspot.com/o/Assets%2FPerfos%2Fflat.jpg?alt=media&token=be831aff-391b-45a1-997b-8730b2c99fcc',
  'https://firebasestorage.googleapis.com/v0/b/broquelizate-8d060.appspot.com/o/Assets%2FPerfos%2Fhelix.jpg?alt=media&token=0a837867-84f4-4f94-96e5-94f1138f3590',
  'https://firebasestorage.googleapis.com/v0/b/broquelizate-8d060.appspot.com/o/Assets%2FPerfos%2Findustrial.jpg?alt=media&token=4449cf85-104e-4354-be62-7d995613d874',
  'https://firebasestorage.googleapis.com/v0/b/broquelizate-8d060.appspot.com/o/Assets%2FPerfos%2Flobulo.jpg?alt=media&token=09bb5ea8-6105-46ad-bed6-2e2bbcc677bd',
  'https://firebasestorage.googleapis.com/v0/b/broquelizate-8d060.appspot.com/o/Assets%2FPerfos%2Ftragus.jpg?alt=media&token=66e70eec-08da-40f8-b506-5496c6d91172'
];

export default function ServicesGallery() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Función para ir a la siguiente imagen
  const nextSlide = useCallback(() => {
    setCurrentIndex((prevIndex) => (prevIndex === images.length - 1 ? 0 : prevIndex + 1));
  }, []);

  // Función para ir a la imagen anterior
  const prevSlide = () => {
    setCurrentIndex((prevIndex) => (prevIndex === 0 ? images.length - 1 : prevIndex - 1));
  };

  // Autoplay
  useEffect(() => {
    if (!isHovered) {
      const interval = setInterval(() => {
        nextSlide();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [nextSlide, isHovered]);

  return (
    <div 
      className="bg-white/5 border border-white/10 rounded-3xl p-5 backdrop-blur-sm w-full max-w-4xl mx-auto"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      
      {/* --- HEADER --- */}
      <div className="flex justify-between items-center mb-4">
        <span className="flex items-center gap-2 text-xs font-bold text-white/60 uppercase tracking-widest">
          <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
          Nuestros Trabajos
        </span>

        {/* Botones de navegación */}
        <div className="flex gap-2">
          <button 
            onClick={prevSlide}
            className="w-9 h-9 flex items-center justify-center bg-white/5 border border-white/10 rounded-lg text-white transition-all hover:bg-yellow-500/20 hover:border-yellow-500/40 hover:text-yellow-500 active:scale-95"
            aria-label="Anterior"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <button 
            onClick={nextSlide}
            className="w-9 h-9 flex items-center justify-center bg-white/5 border border-white/10 rounded-lg text-white transition-all hover:bg-yellow-500/20 hover:border-yellow-500/40 hover:text-yellow-500 active:scale-95"
            aria-label="Siguiente"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      </div>

      {/* --- CARROUSEL --- */}
      <div className="relative overflow-hidden rounded-xl bg-black/20 group">
        <div 
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {images.map((src, index) => (
            <div key={index} className="w-full flex-shrink-0">
              <img 
                src={src} 
                alt={`Trabajo realizado ${index + 1}`} 
                className="w-full h-[450px] md:h-[550px] lg:h-[650px] object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
        
        {/* Gradiente decorativo inferior */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/60 to-transparent pointer-events-none"></div>
      </div>

      {/* --- PAGINACIÓN --- */}
      <div className="flex justify-center gap-2 mt-4">
        {images.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`transition-all duration-300 rounded-full ${
              currentIndex === index 
                ? 'w-6 h-2 bg-yellow-500' 
                : 'w-2 h-2 bg-white/30 hover:bg-white/50'
            }`}
            aria-label={`Ir a imagen ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}