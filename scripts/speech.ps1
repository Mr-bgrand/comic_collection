<#
.SYNOPSIS
  Speech for the guided scanner: say a line, or listen for one word.

.DESCRIPTION
  Uses System.Speech, which ships with Windows - no install, no account, no
  network. Must run under Windows PowerShell 5.1 (full .NET Framework), which
  is what Node spawns as `powershell`.

  Prints exactly one machine-readable line so the caller never has to parse
  prose:

    READY | NOSPEECH | NOMIC        (-Check)
    SPOKE | NOSPEECH                (-Speak)
    HEARD|<word>|<confidence> | NONE | NOMIC   (-Listen)

.EXAMPLE
  powershell -File scripts/speech.ps1 -Speak "Bin 8. Deadpool number 1."
  powershell -File scripts/speech.ps1 -Loop -Words next,again,skip,stop
#>
[CmdletBinding()]
param(
    [string]   $Speak,
    [switch]   $Listen,
    [switch]   $Loop,
    [switch]   $Check,
    [int]      $Seconds = 20,
    [string]   $Words = 'next,again,skip,stop'
)

$ErrorActionPreference = 'Stop'

try {
    Add-Type -AssemblyName System.Speech
} catch {
    Write-Output 'NOSPEECH'
    exit 3
}

# --- speak -----------------------------------------------------------------
if ($Speak) {
    try {
        $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
        $synth.Speak($Speak)
        $synth.Dispose()
        Write-Output 'SPOKE'
        exit 0
    } catch {
        Write-Output 'NOSPEECH'
        exit 3
    }
}

# --- check -----------------------------------------------------------------
if ($Check) {
    try {
        $installed = [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers()
        if ($installed.Count -eq 0) { Write-Output 'NOMIC'; exit 4 }
        Write-Output 'READY'
        exit 0
    } catch {
        Write-Output 'NOMIC'
        exit 4
    }
}

# --- continuous listen -----------------------------------------------------
# One process, one open microphone, for the whole session. Spawning a fresh
# recogniser per prompt cost two to three seconds each time and could not hear
# anything said before it had started - which is most of what people say.
if ($Loop) {
    $engine = $null
    try {
        $engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine
        $choices = New-Object System.Speech.Recognition.Choices
        $choices.Add([string[]]($Words -split ','))
        $builder = New-Object System.Speech.Recognition.GrammarBuilder
        $builder.Append($choices)
        $engine.LoadGrammar((New-Object System.Speech.Recognition.Grammar $builder))
        $engine.SetInputToDefaultAudioDevice()

        [Console]::Out.WriteLine('READY')
        [Console]::Out.Flush()

        # Long windows so the gaps between them are negligible; the engine and
        # the microphone stay open across the whole loop either way.
        while ($true) {
            $result = $engine.Recognize([TimeSpan]::FromSeconds(30))
            if ($null -ne $result) {
                [Console]::Out.WriteLine(("HEARD|{0}|{1:N2}" -f $result.Text, $result.Confidence))
                [Console]::Out.Flush()
            }
        }
    } catch {
        [Console]::Out.WriteLine('NOMIC')
        [Console]::Out.Flush()
        exit 4
    } finally {
        if ($null -ne $engine) { $engine.Dispose() }
    }
}

# --- listen ----------------------------------------------------------------
if ($Listen) {
    $engine = $null
    try {
        $engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine

        # A closed grammar, not dictation. This is what makes recognition
        # dependable across a room; open dictation is not close.
        $choices = New-Object System.Speech.Recognition.Choices
        $choices.Add([string[]]($Words -split ','))
        $builder = New-Object System.Speech.Recognition.GrammarBuilder
        $builder.Append($choices)
        $engine.LoadGrammar((New-Object System.Speech.Recognition.Grammar $builder))

        $engine.SetInputToDefaultAudioDevice()
        $result = $engine.Recognize([TimeSpan]::FromSeconds($Seconds))

        if ($null -eq $result) {
            Write-Output 'NONE'
        } else {
            # Confidence is reported as a fraction; the caller applies the floor.
            Write-Output ("HEARD|{0}|{1:N2}" -f $result.Text, $result.Confidence)
        }
        exit 0
    } catch {
        Write-Output 'NOMIC'
        exit 4
    } finally {
        if ($null -ne $engine) { $engine.Dispose() }
    }
}

Write-Output 'NOSPEECH'
exit 1
