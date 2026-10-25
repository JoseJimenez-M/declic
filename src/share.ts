import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export type OutFile = { name: string; content: string; mime: string };

/** On the phone: write to the cache and open the Android share sheet. In a browser: download each file. */
export async function shareFiles(files: OutFile[]): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const uris: string[] = [];
    for (const f of files) {
      const written = await Filesystem.writeFile({ path: f.name, data: f.content, directory: Directory.Cache, encoding: Encoding.UTF8 });
      uris.push(written.uri);
    }
    await Share.share({ title: "Déclic", files: uris });
    return;
  }
  for (const f of files) {
    const url = URL.createObjectURL(new Blob([f.content], { type: f.mime }));
    const a = document.createElement("a");
    a.href = url;
    a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
