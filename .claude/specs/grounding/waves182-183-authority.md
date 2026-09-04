# Waves182-183 authority

- Current local CT-P08 character TSV SHA-256:
  `74f2a658cf64fb970aa22f0db6ef7fa925b08a36acd8162791ed75f802c93545`.
- The prior reviewed whole-file hash differs because unrelated local official
  raw data drift exists; `qa:adjudication:verify-local` first reports CT-D01.
- The ten selected cards contain 30 Q&A rows. Re-normalizing those rows from
  the current TSV produces exactly the tracked 30 `qaId` and `answerHash`
  values in `qa-hash-snapshot.json`, with zero additions, removals, or conflicts.
- Therefore only the selected B08062-B08073 subset is used here. The broader
  official sync remains a separate re-review and publication task.
- Fresh dossiers: `C:/Users/arumi/AppData/Local/Temp/conan-ground-wave182-183-20260826-a`.
