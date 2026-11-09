// Turns the source photos (Documents/GitHub/blue collar) into web images in public/media.
// Usage: npm run media -- "<source folder>"
import sharp from "sharp";
import path from "node:path";
import { mkdir } from "node:fs/promises";

const source = process.argv[2] ?? "../blue collar";
const out = "public/media";

// name: [source file, widths]
const PHOTOS = {
  "hero-us-1": ["Rooftop Industrial Equipment Inspection.png", [1672, 1100, 720]],
  "hero-us-2": ["Rooftop HVAC Team at Work.png", [1672, 1100, 720]],
  "hero-jp-1": ["Rooftop HVAC Inspection Over the City-2.png", [1672, 1100, 720]],
  "hero-jp-2": ["Rooftop Technician Over City Skyline-1.png", [1672, 1100, 720]],
  "hvac-us": ["Rooftop HVAC Technician at Work.png", [1100, 720]],
  "hvac-jp": ["HVAC Technician Inspecting Pressure Gauge.png", [1100, 720]],
  "datacenter": ["Technician Inspecting Server Cooling Manifold.png", [1100, 720]],
  "marine": ["Maritime Engineer Inspecting Ship Turbine.png", [1100, 720]],
  "meeting-us": ["Professional Industrial Partnership.png", [1100, 720]],
  "meeting-jp": ["Friendly Business Meeting by the Harbor.png", [1100, 720]],
  "crew-us": ["Industrial Team by the Plant.png", [1100, 720]],
  "crew-jp": ["Tokyo Engineering Team Portrait.png", [1100, 720]],
};

await mkdir(out, { recursive: true });
for (const [name, [file, widths]] of Object.entries(PHOTOS)) {
  for (const width of widths) {
    const target = path.join(out, `${name}-${width}.webp`);
    const info = await sharp(path.join(source, file)).resize({ width, withoutEnlargement: true }).webp({ quality: 78, effort: 6 }).toFile(target);
    console.log(target, `${Math.round(info.size / 1024)} KB`);
  }
}

// Link preview: the US hero, cropped to 1200 x 630.
await sharp(path.join(source, PHOTOS["hero-us-1"][0])).resize(1200, 630, { fit: "cover", position: "right" }).jpeg({ quality: 82 }).toFile(path.join(out, "og.jpg"));
console.log("og.jpg done");
