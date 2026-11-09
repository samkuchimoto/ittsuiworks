import { IBM_Plex_Sans, IBM_Plex_Sans_JP, Newsreader, Shippori_Mincho } from "next/font/google";

// English: an editorial serif for headings, IBM Plex Sans for reading.
export const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", display: "swap", weight: ["400", "500", "600"], style: ["normal", "italic"] });
export const plex = IBM_Plex_Sans({ subsets: ["latin"], variable: "--font-plex", display: "swap", weight: ["400", "500", "600", "700"] });

// Japanese: a Mincho for headings, Plex Sans JP for reading. Not preloaded: the browser fetches
// only the slices that hold the characters on the page.
export const mincho = Shippori_Mincho({ subsets: ["latin"], variable: "--font-mincho", display: "swap", weight: ["500", "600", "700"], preload: false });
export const plexJp = IBM_Plex_Sans_JP({ subsets: ["latin"], variable: "--font-plex-jp", display: "swap", weight: ["400", "500", "600", "700"], preload: false });

export const fontVariables = `${newsreader.variable} ${plex.variable} ${mincho.variable} ${plexJp.variable}`;
