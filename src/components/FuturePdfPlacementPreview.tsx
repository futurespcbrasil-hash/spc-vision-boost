import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export type PdfSignaturePlacement = {
  pageIndex: number;
  widgetRect: [number, number, number, number];
};

type Props = {
  file: File;
  onPlacementChange: (placement: PdfSignaturePlacement | null) => void;
};

export default function FuturePdfPlacementPreview({ file, onPlacementChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<PdfSignaturePlacement | null>(null);
  const [renderError, setRenderError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const renderTasks: Array<{ cancel: () => void }> = [];
    let loadingTask: ReturnType<typeof pdfjsLib.getDocument> | null = null;
    let documentProxy: pdfjsLib.PDFDocumentProxy | null = null;

    setSelected(null);
    setRenderError("");
    onPlacementChange(null);

    const renderDocument = async () => {
      try {
        const data = new Uint8Array(await file.arrayBuffer());
        if (cancelled) return;
        loadingTask = pdfjsLib.getDocument({ data });
        documentProxy = await loadingTask.promise;
        const container = containerRef.current;
        if (!container || cancelled) return;
        container.replaceChildren();

        for (let pageIndex = 0; pageIndex < documentProxy.numPages; pageIndex += 1) {
          if (cancelled) return;
          const page = await documentProxy.getPage(pageIndex + 1);
          const viewport = page.getViewport({ scale: 1.15 });
          const pageView = page.view;
          const wrapper = document.createElement("div");
          wrapper.className = "relative mx-auto mb-4 w-fit max-w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm";
          wrapper.style.width = `${viewport.width}px`;
          wrapper.style.maxWidth = "100%";
          wrapper.setAttribute("data-pdf-page", String(pageIndex));
          wrapper.dataset.viewLeft = String(pageView[0]);
          wrapper.dataset.viewBottom = String(pageView[1]);

          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          canvas.style.display = "block";
          canvas.style.width = "100%";
          canvas.style.height = "auto";
          canvas.dataset.viewportWidth = String(viewport.width);
          canvas.dataset.viewportHeight = String(viewport.height);
          canvas.setAttribute("aria-label", `Página ${pageIndex + 1}; clique no local desejado para a assinatura`);

          const overlay = document.createElement("div");
          overlay.className = "pointer-events-none absolute z-10 hidden border-2 border-violet-600 bg-violet-300/40";
          overlay.setAttribute("data-signature-selection", "true");
          wrapper.append(canvas, overlay);
          container.appendChild(wrapper);

          const context = canvas.getContext("2d");
          if (!context) throw new Error("Não foi possível preparar a pré-visualização do PDF.");
          const renderTask = page.render({ canvasContext: context, viewport });
          renderTasks.push(renderTask);
          await renderTask.promise;
          if (cancelled) return;

          wrapper.addEventListener("click", (event) => {
            const bounds = canvas.getBoundingClientRect();
            const scaleX = viewport.width / bounds.width;
            const scaleY = viewport.height / bounds.height;
            const x = (event.clientX - bounds.left) * scaleX;
            const y = (event.clientY - bounds.top) * scaleY;
            const [pdfX, pdfY] = viewport.convertToPdfPoint(x, y);
            const signatureWidth = 180;
            const signatureHeight = 54;
            const left = Math.max(pageView[0], Math.min(pdfX, pageView[2] - signatureWidth));
            const top = Math.max(pageView[1] + signatureHeight, Math.min(pdfY, pageView[3]));
            const placement: PdfSignaturePlacement = {
              pageIndex,
              widgetRect: [left, top - signatureHeight, left + signatureWidth, top],
            };

            container.querySelectorAll<HTMLElement>("[data-signature-selection]").forEach((item) => item.classList.add("hidden"));
            const [leftX, topY] = viewport.convertToViewportPoint(left, top);
            const [rightX, bottomY] = viewport.convertToViewportPoint(left + signatureWidth, top - signatureHeight);
            const displayScaleX = bounds.width / viewport.width;
            const displayScaleY = bounds.height / viewport.height;
            overlay.style.left = `${Math.min(leftX, rightX) * displayScaleX}px`;
            overlay.style.top = `${Math.min(topY, bottomY) * displayScaleY}px`;
            overlay.style.width = `${Math.abs(rightX - leftX) * displayScaleX}px`;
            overlay.style.height = `${Math.abs(bottomY - topY) * displayScaleY}px`;
            overlay.classList.remove("hidden");
            setSelected(placement);
            onPlacementChange(placement);
          });
        }
      } catch (error) {
        if (!cancelled) {
          console.error("[Future Assinador] Falha ao renderizar PDF para posicionamento.", error);
          setRenderError("Não foi possível renderizar este PDF para escolher o local da assinatura. Tente outro PDF.");
        }
      }
    };

    void renderDocument();
    return () => {
      cancelled = true;
      renderTasks.forEach((task) => { try { task.cancel(); } catch { /* render já encerrado */ } });
      if (documentProxy) void documentProxy.destroy();
      else if (loadingTask) void loadingTask.destroy();
    };
  }, [file, onPlacementChange]);

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-violet-100 bg-slate-50 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-extrabold text-slate-900">Clique no local da assinatura</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">Clique em qualquer página. O retângulo roxo marca a área de assinatura de 180 × 54 pontos.</p>
        </div>
        {selected && <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-800">Página {selected.pageIndex + 1} selecionada</span>}
      </div>
      {renderError ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{renderError}</p>
      ) : (
        <div ref={containerRef} className="max-h-[620px] overflow-auto" />
      )}
    </div>
  );
}
