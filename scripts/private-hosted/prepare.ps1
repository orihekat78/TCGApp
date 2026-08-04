param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $PrepareArgs
)

$ErrorActionPreference = "Stop"

$processEnvironment = [System.EnvironmentVariableTarget]::Process
$programFiles = [System.Environment]::GetFolderPath(
  [System.Environment+SpecialFolder]::ProgramFiles
)
$localAppData = [System.Environment]::GetFolderPath(
  [System.Environment+SpecialFolder]::LocalApplicationData
)
$tempRoot = [System.IO.Path]::Combine($localAppData, "Temp")
$scriptPath = [System.IO.Path]::GetFullPath($MyInvocation.MyCommand.Path)
$scriptRoot = [System.IO.Path]::GetDirectoryName($scriptPath)
$repoRoot = [System.IO.Path]::GetFullPath(
  [System.IO.Path]::Combine($scriptRoot, "..", "..")
)
$nodePath = [System.IO.Path]::Combine($programFiles, "nodejs", "node.exe")
$gitPath = [System.IO.Path]::Combine($programFiles, "Git", "cmd", "git.exe")
$entry = [System.IO.Path]::Combine($scriptRoot, "prepare.ts")
$tsxLoader = [System.IO.Path]::Combine(
  $repoRoot,
  "node_modules",
  "tsx",
  "dist",
  "loader.mjs"
)

foreach ($path in @($nodePath, $gitPath, $entry, $tsxLoader)) {
  if (-not [System.IO.File]::Exists($path)) {
    throw "fixed release launcher file is missing"
  }
  $attributes = [System.IO.File]::GetAttributes($path)
  if (
    ($attributes -band [System.IO.FileAttributes]::Directory) -or
    ($attributes -band [System.IO.FileAttributes]::ReparsePoint)
  ) {
    throw "fixed release launcher path is not a regular file"
  }
}
if (-not [System.IO.Directory]::Exists($tempRoot)) {
  throw "fixed temporary directory is missing"
}
if (
  [System.IO.File]::GetAttributes($tempRoot) -band
  [System.IO.FileAttributes]::ReparsePoint
) {
  throw "fixed temporary directory must not be a reparse point"
}
$privateTempPrefix = "conan-private-hosted-launcher-temp-"
$privateTempPath = [System.IO.Path]::Combine(
  $tempRoot,
  $privateTempPrefix + [System.Guid]::NewGuid().ToString("N")
)
[void] [System.IO.Directory]::CreateDirectory($privateTempPath)
if (
  [System.IO.File]::GetAttributes($privateTempPath) -band
  [System.IO.FileAttributes]::ReparsePoint
) {
  throw "private temporary directory must not be a reparse point"
}
$trustedTsconfig = [System.IO.Path]::Combine(
  $privateTempPath,
  "tsx-tsconfig.json"
)
[System.IO.File]::WriteAllText(
  $trustedTsconfig,
  "{}" + [char] 10,
  [System.Text.UTF8Encoding]::new($false)
)

foreach (
  $name in
  [System.Environment]::GetEnvironmentVariables($processEnvironment).Keys
) {
  [System.Environment]::SetEnvironmentVariable(
    [string] $name,
    $null,
    $processEnvironment
  )
}
$env:PATH = @(
  [System.IO.Path]::GetDirectoryName($nodePath)
  [System.IO.Path]::GetDirectoryName($gitPath)
  "C:\Windows\System32"
) -join ";"
$env:PATHEXT = ".COM;.EXE;.BAT;.CMD"
$env:SystemRoot = "C:\Windows"
$env:SYSTEMROOT = "C:\Windows"
$env:windir = "C:\Windows"
$env:WINDIR = "C:\Windows"
$env:ComSpec = "C:\Windows\System32\cmd.exe"
$env:COMSPEC = "C:\Windows\System32\cmd.exe"
$env:TEMP = $privateTempPath
$env:TMP = $privateTempPath
$env:TSX_DISABLE_CACHE = "1"
$env:TSX_TSCONFIG_PATH = $trustedTsconfig

[System.IO.Directory]::SetCurrentDirectory($repoRoot)
[void] $ExecutionContext.SessionState.Path.SetLocation($repoRoot)

$tsxImport = [System.Uri]::new($tsxLoader).AbsoluteUri
$bootstrap = @'
process.chdir(process.argv[1]);
import(`node:url`)
  .then(({ pathToFileURL }) => import(pathToFileURL(process.argv[2]).href))
  .then(({ runPrepareCli }) => runPrepareCli(process.argv.slice(3)))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
'@
& $nodePath --import $tsxImport --eval $bootstrap -- $repoRoot $entry @PrepareArgs
$exitCode = $LASTEXITCODE
try {
  [System.IO.Directory]::Delete($privateTempPath, $true)
} catch {
  if ($exitCode -eq 0) {
    throw "private temporary directory cleanup failed"
  }
}
exit $exitCode
