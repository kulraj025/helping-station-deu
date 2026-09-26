import "server-only";
import QRCode from "qrcode";
import { env } from "./env";

/**
 * QR code + printable poster generation.
 *
 * The QR always points at a public, shareable registration URL so a printed
 * poster can be scanned by anyone.
 */

export function registerUrl(eventSlug: string): string {
  return `${env.appUrl}/register?event=${encodeURIComponent(eventSlug)}`;
}

export async function qrSvg(data: string, options: { width?: number; margin?: number } = {}): Promise<string> {
  return QRCode.toString(data, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: options.margin ?? 1,
    width: options.width ?? 512,
    color: { dark: "#14532d", light: "#ffffff" },
  });
}

export async function qrPngBuffer(data: string, px = 1024): Promise<Buffer> {
  return QRCode.toBuffer(data, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 1,
    width: px,
    color: { dark: "#14532d", light: "#ffffff" },
  });
}

export async function qrDataUrl(data: string, px = 320): Promise<string> {
  return QRCode.toDataURL(data, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: px,
    color: { dark: "#14532d", light: "#ffffff" },
  });
}

export interface PosterOptions {
  eventName: string;
  tagline: string;
  eventSlug: string;
  dateLabel: string;
  timeLabel: string;
  locationLabel: string;
  deadlineLabel: string;
  contactLabel: string;
}

/**
 * A4-proportioned SVG poster (print ready). The QR is embedded as a data URL so
 * the file stays a single self-contained document.
 */
export async function posterSvg(options: PosterOptions): Promise<string> {
  const url = registerUrl(options.eventSlug);
  const qr = await qrDataUrl(url, 900);

  const escape = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="794" height="1123" viewBox="0 0 794 1123" font-family="'Segoe UI', 'Apple SD Gothic Neo', 'Malgun Gothic', Arial, sans-serif">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f0fdf4"/>
      <stop offset="100%" stop-color="#ffffff"/>
    </linearGradient>
    <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse">
      <circle cx="3" cy="3" r="1.6" fill="#bbf7d0" opacity="0.7"/>
    </pattern>
  </defs>
  <rect width="794" height="1123" fill="url(#bg)"/>
  <rect width="794" height="1123" fill="url(#dots)"/>
  <rect x="34" y="34" width="726" height="1055" rx="28" fill="none" stroke="#166534" stroke-width="3"/>
  <rect x="34" y="34" width="726" height="150" rx="28" fill="#166534"/>
  <rect x="34" y="150" width="726" height="34" fill="#166534"/>
  <text x="70" y="105" font-size="42" font-weight="800" fill="#ffffff">${escape(options.eventName)}</text>
  <text x="70" y="150" font-size="19" fill="#bbf7d0">${escape(options.tagline)}</text>

  <text x="70" y="265" font-size="30" font-weight="700" fill="#14532d">Learn &#183; Participate &#183; Take Action &#183; Grow</text>
  <rect x="70" y="290" width="160" height="8" rx="4" fill="#16a34a"/>

  <text x="70" y="360" font-size="22" font-weight="700" fill="#0f172a">When</text>
  <text x="70" y="392" font-size="20" fill="#334155">${escape(options.dateLabel)}</text>
  <text x="70" y="446" font-size="22" font-weight="700" fill="#0f172a">Time</text>
  <text x="70" y="478" font-size="20" fill="#334155">${escape(options.timeLabel)}</text>
  <text x="70" y="532" font-size="22" font-weight="700" fill="#0f172a">Where</text>
  <text x="70" y="564" font-size="20" fill="#334155">${escape(options.locationLabel)}</text>
  <text x="70" y="618" font-size="22" font-weight="700" fill="#0f172a">Registration closes</text>
  <text x="70" y="650" font-size="20" fill="#334155">${escape(options.deadlineLabel)}</text>

  <rect x="70" y="700" width="654" height="270" rx="22" fill="#ffffff" stroke="#bbf7d0" stroke-width="2"/>
  <image x="330" y="716" width="240" height="240" xlink:href="${qr}"/>
  <text x="397" y="940" font-size="21" font-weight="700" fill="#166534" text-anchor="middle">Scan to register</text>

  <text x="397" y="985" font-size="15" fill="#64748b" text-anchor="middle">or visit</text>
  <text x="397" y="1008" font-size="15" fill="#0f172a" text-anchor="middle">${escape(url.replace(/^https?:\/\//, ""))}</text>

  <text x="70" y="1055" font-size="16" font-weight="700" fill="#166534">Serving Beyond Borders &#8212; Together We Grow.</text>
  <text x="724" y="1055" font-size="14" fill="#64748b" text-anchor="end">${escape(options.contactLabel)}</text>
</svg>`;
}
