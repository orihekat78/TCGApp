export type ManifestEntry = {
  path: string;
  bytes: number;
  sha256: string;
};

export type BuildManifests = {
  schemaVersion: 1;
  upload: ManifestEntry[];
  response: ManifestEntry[];
};
