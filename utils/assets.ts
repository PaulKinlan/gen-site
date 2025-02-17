const assets: Record<string, string> = {};

// Todo - add caching.
export async function getAssetContent(asset: string): Promise<string> {
  if (assets[asset]) {
    return assets[asset];
  }
  const data = await Deno.readTextFile(`./${asset}`);
  assets[asset] = data;
  return data;
}
