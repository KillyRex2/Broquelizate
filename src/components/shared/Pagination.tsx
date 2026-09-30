// src/components/products/Pagination.tsx
import { navigate } from "astro:transitions/client";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

interface Props {
  currentPage: number;
  totalPages: number;
  baseUrl?: string;
  searchParams?: Record<string, string>;
}

export const Pagination = ({ 
  currentPage, 
  totalPages, 
  baseUrl = "/products",
  searchParams = {}
}: Props) => {
  if (totalPages <= 1) return null;

  const getPageUrl = (page: number) => {
    const params = new URLSearchParams({ ...searchParams, page: page.toString() });
    return `${baseUrl}?${params.toString()}`;
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    navigate(getPageUrl(page));
  };

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | "dots")[] = [];
    const showPages = 5;
    
    if (totalPages <= showPages + 2) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      // Always show first page
      pages.push(1);
      
      if (currentPage <= 3) {
        // Near start
        pages.push(2, 3, 4, "dots", totalPages);
      } else if (currentPage >= totalPages - 2) {
        // Near end
        pages.push("dots", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        // Middle
        pages.push("dots", currentPage - 1, currentPage, currentPage + 1, "dots", totalPages);
      }
    }
    
    return pages;
  };

  const pages = getPageNumbers();

  return (
    <nav 
      className="pagination-wrapper" 
      aria-label="Navegación de páginas"
      suppressHydrationWarning
    >
      {/* Previous Button */}
      <button
        onClick={() => goToPage(currentPage - 1)}
        disabled={currentPage === 1}
        className={`page-btn prev ${currentPage === 1 ? "disabled" : ""}`}
        aria-label="Página anterior"
        suppressHydrationWarning
      >
        <FaChevronLeft />
      </button>

      {/* Page Numbers */}
      <div className="page-numbers" suppressHydrationWarning>
        {pages.map((page, index) => 
          page === "dots" ? (
            <span key={`dots-${index}`} className="page-dots">•••</span>
          ) : (
            <button
              key={page}
              onClick={() => goToPage(page)}
              className={`page-number ${currentPage === page ? "active" : ""}`}
              aria-current={currentPage === page ? "page" : undefined}
              suppressHydrationWarning
            >
              {page}
            </button>
          )
        )}
      </div>

      {/* Next Button */}
      <button
        onClick={() => goToPage(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`page-btn next ${currentPage === totalPages ? "disabled" : ""}`}
        aria-label="Página siguiente"
        suppressHydrationWarning
      >
        <FaChevronRight />
      </button>

      {/* Page info */}
      <span className="page-info" suppressHydrationWarning>
        Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
      </span>

      <style>{`
        .pagination-wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 56px;
          padding-top: 40px;
          border-top: 1px solid rgba(0, 0, 0, 0.06);
        }

        .page-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 52px;
          background: #fff;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 16px;
          color: #666;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .page-btn:hover:not(.disabled) {
          background: linear-gradient(135deg, #111 0%, #222 100%);
          border-color: transparent;
          color: #fff;
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
        }

        .page-btn.disabled {
          opacity: 0.35;
          cursor: not-allowed;
          pointer-events: none;
        }

        .page-numbers {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .page-number {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 52px;
          height: 52px;
          padding: 0 8px;
          background: #fff;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 16px;
          color: #555;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .page-number:hover:not(.active) {
          border-color: rgba(234, 179, 8, 0.5);
          color: #b45309;
          transform: translateY(-2px);
        }

        .page-number.active {
          background: linear-gradient(135deg, #eab308 0%, #f59e0b 100%);
          border-color: transparent;
          color: #000;
          font-weight: 800;
          box-shadow: 0 6px 20px rgba(234, 179, 8, 0.4);
          transform: translateY(-2px);
        }

        .page-dots {
          padding: 0 6px;
          color: #bbb;
          font-size: 1rem;
          letter-spacing: 2px;
        }

        .page-info {
          margin-left: 20px;
          font-size: 0.9rem;
          color: #888;
        }

        .page-info strong {
          color: #333;
          font-weight: 700;
        }

        @media (max-width: 768px) {
          .pagination-wrapper {
            gap: 8px;
            margin-top: 40px;
            padding-top: 32px;
          }

          .page-btn,
          .page-number {
            width: 46px;
            height: 46px;
            min-width: 46px;
            border-radius: 14px;
            font-size: 0.9rem;
          }

          .page-numbers {
            gap: 6px;
          }

          .page-info {
            width: 100%;
            text-align: center;
            margin-left: 0;
            margin-top: 16px;
          }
        }

        @media (max-width: 480px) {
          .page-btn,
          .page-number {
            width: 42px;
            height: 42px;
            min-width: 42px;
            border-radius: 12px;
          }

          /* Hide middle pages on very small screens */
          .page-number:not(.active):nth-child(n+3):nth-last-child(n+3) {
            display: none;
          }
        }
      `}</style>
    </nav>
  );
};