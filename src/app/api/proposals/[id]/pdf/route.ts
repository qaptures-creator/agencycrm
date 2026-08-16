import { NextResponse } from "next/server";
import { TimeoutError } from "puppeteer-core";
import { prisma } from "@/lib/prisma";
import { getBrowser } from "@/lib/pdf/browser";
import { getPdfInternalToken, PDF_INTERNAL_TOKEN_HEADER } from "@/lib/pdf/internal-token";
import { proposalPdfFilename } from "@/lib/pdf/filename";

const NAV_TIMEOUT_MS = 20_000;
const OVERALL_TIMEOUT_MS = 30_000;
const ASSET_WAIT_TIMEOUT_MS = 8_000;

class PdfTimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new PdfTimeoutError(`Timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function renderProposalPdf(id: string): Promise<ArrayBuffer> {
  const port = process.env.PORT || 3000;
  const internalUrl = `http://127.0.0.1:${port}/proposals/${id}/print`;

  let browser;
  try {
    browser = await getBrowser();
  } catch (err) {
    throw new Error(`Chromium failed to start: ${err instanceof Error ? err.message : String(err)}`, { cause: "browser" });
  }

  const page = await browser.newPage();
  try {
    await page.setExtraHTTPHeaders({ [PDF_INTERNAL_TOKEN_HEADER]: getPdfInternalToken() });
    await page.setViewport({ width: 1400, height: 1800 });

    const response = await page.goto(internalUrl, { waitUntil: "networkidle0", timeout: NAV_TIMEOUT_MS });
    if (!response || !response.ok()) {
      throw new Error(`Proposal page failed to render (status ${response?.status() ?? "unknown"})`, { cause: "render" });
    }

    // Best-effort: wait for web fonts and any <img> tags to finish loading,
    // but never let a stalled font/image hang the whole PDF.
    await Promise.race([
      page.evaluate(async () => {
        await (document.fonts?.ready ?? Promise.resolve());
        const images = Array.from(document.images);
        await Promise.all(
          images.map((img) =>
            img.complete ? Promise.resolve() : new Promise((resolve) => { img.addEventListener("load", resolve, { once: true }); img.addEventListener("error", resolve, { once: true }); })
          )
        );
      }),
      new Promise((resolve) => setTimeout(resolve, ASSET_WAIT_TIMEOUT_MS)),
    ]);

    await page.emulateMediaType("print");

    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      timeout: NAV_TIMEOUT_MS,
    });

    // Puppeteer's Uint8Array's underlying buffer can't be typed as a plain
    // ArrayBuffer (it's generic over ArrayBufferLike), which Response/
    // NextResponse bodies require — copy out a concrete ArrayBuffer.
    return pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
  } finally {
    await page.close().catch(() => {});
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const proposal = await prisma.proposal.findUnique({
    where: { id },
    select: { id: true, client: { select: { companyName: true } } },
  });
  if (!proposal) {
    return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
  }

  try {
    const pdfBuffer = await withTimeout(renderProposalPdf(id), OVERALL_TIMEOUT_MS);
    const filename = proposalPdfFilename(proposal.client.companyName);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Content-Length": String(pdfBuffer.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof PdfTimeoutError || err instanceof TimeoutError) {
      return NextResponse.json({ error: "PDF generation timed out. Please try again." }, { status: 504 });
    }
    const cause = err instanceof Error ? (err.cause as string | undefined) : undefined;
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Proposal PDF generation failed:", message);

    if (cause === "browser") {
      return NextResponse.json({ error: "The PDF renderer is unavailable right now. Please try again shortly." }, { status: 502 });
    }
    return NextResponse.json({ error: "Couldn't generate the PDF for this proposal." }, { status: 500 });
  }
}
